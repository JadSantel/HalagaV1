import "server-only";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { lstat, mkdir, open, readdir, realpath, rename, unlink } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, dirname } from "node:path";
import sharp from "sharp";
import { photoPolicy } from "../domain/draft-photo-policy.ts";

export class PhotoInvalid extends Error { constructor() { super("INVALID_FILE"); } }
export const photoHash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const keyPattern = /^[0-9a-f-]{36}\.(original|upload|[0-9a-f-]{36}\.jpg)$/;

/** Private local blob directory only. Never used by a public/static file handler. */
export async function openPhotoStore(root: string) {
  if (!root || !isAbsolute(root)) throw new Error("PHOTO_STORAGE_UNAVAILABLE");
  root = resolve(root);
  const withinRepository = relative(resolve(process.cwd(), ".."), root);
  if (!withinRepository.startsWith("..") && !isAbsolute(withinRepository) &&
      root.toLowerCase() !== resolve(process.cwd(), "private-draft-photos").toLowerCase()) throw new Error("PHOTO_STORAGE_UNAVAILABLE");
  for (const folder of ["public", "src", ".next", "out", "build", ".git"]) {
    // Comparison only; never bundle private runtime data into the server artifact.
    const path = relative(resolve(/*turbopackIgnore: true*/ process.cwd(), folder), root);
    if (path === "" || (!path.startsWith("..") && !isAbsolute(path))) throw new Error("PHOTO_STORAGE_UNAVAILABLE");
  }
  // Check existing ancestors before mkdir can traverse them.
  let ancestor = root;
  while (true) {
    try { if ((await lstat(ancestor)).isSymbolicLink()) throw new Error("PHOTO_STORAGE_UNAVAILABLE"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    if (dirname(ancestor) === ancestor) break;
    ancestor = dirname(ancestor);
  }
  await mkdir(root, { recursive: true, mode: 0o700 });
  const checkRoot = async () => {
    let cursor = root;
    while (true) {
      if ((await lstat(cursor)).isSymbolicLink()) throw new Error("PHOTO_STORAGE_UNAVAILABLE");
      if (dirname(cursor) === cursor) break;
      cursor = dirname(cursor);
    }
    if (resolve(await realpath(root)).toLowerCase() !== root.toLowerCase()) throw new Error("PHOTO_STORAGE_UNAVAILABLE");
  };
  await checkRoot();
  async function pathFor(key: string) {
    if (!keyPattern.test(key)) throw new Error("PHOTO_STORAGE_UNAVAILABLE");
    await checkRoot();
    const path = join(root, key);
    try {
      const stat = await lstat(path);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error("PHOTO_STORAGE_UNAVAILABLE");
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    return path;
  }
  return {
    async write(key: string, bytes: Uint8Array) {
      const handle = await open(await pathFor(key), "wx", 0o600);
      try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
    },
    async read(key: string) {
      const handle = await open(await pathFor(key), "r");
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size > photoPolicy.maxBytes || stat.nlink !== 1) throw new PhotoInvalid();
        return await handle.readFile();
      } finally { await handle.close(); }
    },
    async remove(key: string) { try { await unlink(await pathFor(key)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; } },
    async commitUpload(id: string) { await rename(await pathFor(`${id}.upload`), await pathFor(`${id}.original`)); },
    async path(key: string) { return pathFor(key); },
    async inventory() { await checkRoot(); return Promise.all((await readdir(root)).filter((key) => keyPattern.test(key)).map(async (key) => ({ key,
      createdAt: (await lstat(await pathFor(key))).birthtime }))); },
  };
}
export type PhotoStore = Awaited<ReturnType<typeof openPhotoStore>>;

/** Read a single binary file, never an unbounded multipart/formData allocation. */
export async function readPhotoBody(body: ReadableStream<Uint8Array> | null, expected: number) {
  if (!body || expected < 1 || expected > photoPolicy.maxBytes) throw new PhotoInvalid();
  const reader = body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const read = async () => {
      const chunks: Uint8Array[] = []; let size = 0;
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        size += result.value.length;
        if (size > expected || size > photoPolicy.maxBytes) throw new PhotoInvalid();
        chunks.push(result.value);
      }
      if (size !== expected) throw new PhotoInvalid();
      return Buffer.concat(chunks);
    };
    return await Promise.race([read(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { void reader.cancel().catch(() => {}); reject(new PhotoInvalid()); }, photoPolicy.timeout);
    })]);
  } finally { clearTimeout(timer); await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export function hasPhotoSignature(bytes: Uint8Array, type: string) {
  return type === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 :
    type === "image/png" && Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
}

export async function createSafePhoto(bytes: Uint8Array, type: string) {
  if (!hasPhotoSignature(bytes, type) || bytes.length > photoPolicy.maxBytes) throw new PhotoInvalid();
  if (type === "image/png") {
    const input = Buffer.from(bytes);
    // Reject APNG explicitly even when a decoder would expose only its first frame.
    for (let offset = 8; offset + 12 <= input.length;) {
      const size = input.readUInt32BE(offset), kind = input.toString("ascii", offset + 4, offset + 8);
      if (kind === "acTL" || offset + size + 12 > input.length) throw new PhotoInvalid();
      offset += size + 12;
      if (kind === "IEND") { if (offset !== input.length) throw new PhotoInvalid(); break; }
    }
  }
  try {
    const options = { failOn: "warning" as const, limitInputPixels: photoPolicy.maxPixels };
    const metadata = await sharp(bytes, options).metadata();
    if (!metadata.width || !metadata.height || metadata.width > photoPolicy.maxAxis || metadata.height > photoPolicy.maxAxis ||
        (metadata.pages ?? 1) !== 1 || metadata.format !== (type === "image/jpeg" ? "jpeg" : "png")) throw new PhotoInvalid();
    // Fresh pixel encoding discards every source metadata container.
    const output = await sharp(bytes, options).autoOrient().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "white" }).toColourspace("srgb").jpeg({ quality: 85 }).timeout({ seconds: 30 }).toBuffer();
    const checked = await sharp(output, options).metadata();
    if (output.length > photoPolicy.maxBytes || checked.exif || checked.icc || checked.iptc || checked.xmp || checked.comments?.length ||
        checked.format !== "jpeg") throw new PhotoInvalid();
    await sharp(output, options).raw().toBuffer();
    return output;
  } catch { throw new PhotoInvalid(); }
}

/** Local command only; no shell, raw scanner output, network service or bypass flag. */
export async function scanPhoto(path: string, signal: AbortSignal) {
  const executable = process.env.DRAFT_PHOTO_CLAMSCAN ?? "";
  const version = process.env.DRAFT_PHOTO_CLAMSCAN_VERSION ?? "";
  if (!isAbsolute(executable) || !/^ClamAV \d+\.\d+\.\d+$/.test(version)) throw new Error("SCANNER_UNAVAILABLE");
  const run = (args: string[]) => new Promise<{ code: number | null; output: string }>((accept, reject) => {
    // Scanner is an explicitly installed local executable, never a bundled asset.
    const child = spawn(/*turbopackIgnore: true*/ executable, args, { windowsHide: true, shell: false, signal, stdio: ["ignore", "pipe", "ignore"] });
    let output = "";
    child.stdout.on("data", (chunk) => { if (output.length < 1024) output += chunk.toString().slice(0, 1024 - output.length); });
    child.once("error", () => reject(new Error("SCANNER_UNAVAILABLE")));
    child.once("close", (code) => accept({ code, output }));
  });
  const installed = await run(["--version"]);
  if (installed.code !== 0 || installed.output.split("/")[0].trim() !== version || !installed.output.includes("/")) throw new Error("SCANNER_UNAVAILABLE");
  const result = await run(["--no-summary", "--stdout", "--", path]);
  if (result.code === 1) throw new PhotoInvalid();
  if (result.code !== 0) throw new Error("SCANNER_UNAVAILABLE");
}
