"use client";

/* eslint-disable @next/next/no-img-element -- Authorized no-store derivatives must bypass shared image optimization. */
import { useRef, useState } from "react";
import { photoPolicy, type DraftPhoto } from "../../domain/draft-photo-policy";

const button = "min-h-12 rounded-md border border-[#75837c] bg-white px-4 py-2 font-semibold hover:bg-[#e7f2ee] disabled:opacity-60";
const names: Record<string, string> = { UPLOADING: "Waiting for upload", PENDING: "Waiting for processing", PROCESSING: "Processing",
  APPROVED: "Safely processed synthetic image", FAILED: "Processing failed; upload a new copy to try again", REJECTED: "File rejected; choose another image",
  QUARANTINED: "File quarantined; unavailable", DELETION_PENDING: "Removal in progress", DELETED: "Image unavailable" };

export function DraftPhotoGallery({ photos }: { photos: DraftPhoto[] }) {
  return <ol className="mt-4 grid gap-5 sm:grid-cols-2">{photos.map((photo) => <li key={photo.id} className="min-w-0">
    {photo.src && <img src={photo.src} alt={`Synthetic laptop evidence, photo ${photo.position}. Fictional item.`}
      width={640} height={420} className="h-auto max-h-80 w-full rounded-md border border-[#75837c] object-contain" />}
    <p className="mt-2">Photo {photo.position} · {names[photo.status] ?? "Unavailable"}</p>
  </li>)}</ol>;
}

type Props = { listingId: string; revision: number; initialPhotos: DraftPhoto[]; locked: boolean; dirty: boolean;
  onBusy(value: boolean): void; onRevision(value: number): void; onConflict(): void; onUnauthorized(): void };
type Upload = { kind: "upload"; file: File; admission: { requestId: string; expectedRevision: number; sha256: string; byteSize: number; mediaType: string } };
type Change = { kind: "change"; body: { action: "remove"; photoId: string; requestId: string; expectedRevision: number } |
  { action: "order"; photoIds: string[]; requestId: string; expectedRevision: number } };

export default function DraftPhotos(props: Props) {
  const [photos, setPhotos] = useState(props.initialPhotos);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [phase, setPhase] = useState<"ready" | "pending" | "uncertain">("ready");
  const [error, setError] = useState(false);
  const [canDiscard, setCanDiscard] = useState(false);
  const pending = useRef<Upload | Change | null>(null);
  const active = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  const movedPhoto = useRef<string | null>(null);
  const target = `/api/laptop-drafts/${props.listingId}/photos`;
  const disabled = props.locked || props.dirty || phase !== "ready";
  function announce(text: string, failed = false) { setMessage(text); setError(failed); if (failed) requestAnimationFrame(() => feedback.current?.focus()); }
  async function check(response: Response) {
    if (response.status === 401) { props.onUnauthorized(); throw new Error("SESSION"); }
    if ([404, 409].includes(response.status)) { props.onConflict(); throw new Error("CONFLICT"); }
    if ([400, 403].includes(response.status)) throw new Error(response.status === 403 ? "RESTRICTED" : "INVALID");
    if (!response.ok) throw new Error("UNCERTAIN");
    return response.json();
  }
  async function refresh(expected = props.revision) {
    const result = await check(await fetch(target, { credentials: "same-origin", cache: "no-store", referrerPolicy: "no-referrer", redirect: "error" }));
    if (result.currentRevision !== expected) { props.onConflict(); throw new Error("CONFLICT"); }
    setPhotos(result.photos);
  }
  function sendFile(command: Upload) {
    return new Promise<Response>((accept, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", `${target}/${command.admission.requestId}`);
      xhr.withCredentials = true; xhr.timeout = 30000;
      xhr.setRequestHeader("content-type", command.admission.mediaType);
      xhr.upload.onprogress = (event) => { if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100)); };
      xhr.onload = () => accept(new Response(xhr.responseText, { status: xhr.status }));
      xhr.onerror = xhr.ontimeout = xhr.onabort = () => reject(new Error("UNCERTAIN"));
      xhr.send(command.file);
    });
  }
  async function execute(command: Upload | Change) {
    if (active.current) return;
    active.current = true; pending.current = command;
    props.onBusy(true); setPhase("pending"); announce(command.kind === "upload" ? "Uploading private synthetic image…" : "Saving photo order…");
    try {
      let result;
      if (command.kind === "upload") {
        await check(await fetch(target, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(command.admission),
          credentials: "same-origin", cache: "no-store", referrerPolicy: "no-referrer", redirect: "error" }));
        result = await check(await sendFile(command));
      } else result = await check(await fetch(target, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(command.body),
        credentials: "same-origin", cache: "no-store", referrerPolicy: "no-referrer", redirect: "error" }));
      await refresh(result.revision);
      props.onRevision(result.revision);
      pending.current = null; setCanDiscard(false); props.onBusy(false); setPhase("ready"); setProgress(null);
      if (input.current) input.current.value = "";
      const removed = command.kind === "change" && command.body.action === "remove";
      announce(command.kind === "upload" ? "Upload saved. Processing is separate; refresh status after local processing runs." : removed ? "Photo removed from the current revision. Historical references remain until draft expiry." : `Photo order saved. Moved photo is now at position ${command.kind === "change" && command.body.action === "order" ? command.body.photoIds.indexOf(movedPhoto.current ?? "") + 1 : ""}.`);
      requestAnimationFrame(() => {
        if (command.kind === "upload" || removed) input.current?.focus();
        else document.getElementById(`photo-control-${movedPhoto.current}`)?.focus();
      });
    } catch (failure) {
      const reason = failure instanceof Error ? failure.message : "UNCERTAIN";
      if (["INVALID", "RESTRICTED", "CONFLICT", "SESSION"].includes(reason)) {
        setPhase("ready"); props.onBusy(false);
        // Keep an unfinalized upload available for explicit discard; no automatic failed-job retry.
        if (command.kind === "change" || reason !== "INVALID") pending.current = null;
        setCanDiscard(command.kind === "upload" && reason === "INVALID");
        announce(reason === "INVALID" ? "Upload or change rejected. Use a valid JPEG/PNG within the displayed limits. An unfinished upload can be discarded below." :
          reason === "RESTRICTED" ? "A current account restriction prevents this photo action. Saved photos remain readable." : "The draft or session changed. Reload before further edits.", true);
      } else { setPhase("uncertain"); announce("The result could not be confirmed. Retry the same request and file, or reload to inspect the saved draft.", true); }
    } finally { active.current = false; }
  }
  async function upload() {
    const file = input.current?.files?.[0];
    if (!file || disabled || active.current) return;
    if (!file.size || file.size > photoPolicy.maxBytes || !["image/jpeg", "image/png"].includes(file.type)) {
      announce("Choose a JPEG or PNG, no larger than 10 MiB. Other formats are not supported here.", true); return;
    }
    active.current = true; props.onBusy(true); setPhase("pending"); announce("Preparing private upload…");
    try {
      const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const sha256 = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
      active.current = false;
      await execute({ kind: "upload", file, admission: { requestId: crypto.randomUUID(), expectedRevision: props.revision, sha256, byteSize: file.size, mediaType: file.type } });
    } catch { active.current = false; props.onBusy(false); setPhase("ready"); announce("The file could not be read. Select it again.", true); }
  }
  async function discard() {
    const command = pending.current;
    if (command?.kind !== "upload" || active.current) return;
    active.current = true;
    try {
      await check(await fetch(`${target}/${command.admission.requestId}`, { method: "DELETE", credentials: "same-origin", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer" }));
      pending.current = null; setCanDiscard(false); props.onBusy(false); setPhase("ready"); setProgress(null); announce("Unfinished upload discarded."); input.current?.focus();
    } catch { announce("Discard could not be confirmed. Retry the same upload or reload to inspect saved state.", true); }
    finally { active.current = false; }
  }
  function change(index: number, direction?: number) {
    if (disabled) return;
    const requestId = crypto.randomUUID(), expectedRevision = props.revision;
    if (direction === undefined) void execute({ kind: "change", body: { action: "remove", requestId, expectedRevision, photoId: photos[index].id } });
    else {
      movedPhoto.current = photos[index].id;
      const photoIds = photos.map((photo) => photo.id);
      [photoIds[index], photoIds[index + direction]] = [photoIds[index + direction], photoIds[index]];
      void execute({ kind: "change", body: { action: "order", requestId, expectedRevision, photoIds } });
    }
  }
  return <section id="photos" aria-labelledby="photos-title" className="mt-9 border-t border-[#d9dfda] pt-7" tabIndex={-1}>
    <h2 id="photos-title" className="text-xl font-semibold">Private synthetic photos</h2>
    <p id="photo-help" className="mt-2">Use fictional or generated laptop images only. JPEG/PNG, up to 10 MiB each, 24 million pixels and 10,000 pixels per side. Maximum 10 current photos; total private storage is limited to 256 MiB per owner.</p>
    <p className="mt-2">Originals stay private. Only safely processed copies appear here. Synthetic images never qualify as actual-item publication evidence.</p>
    <p className="mt-2">Removal creates a new revision. Earlier revisions keep their photos until this draft expires after 30 days without a successful content or photo change. Originals expire after processing or 24 hours from admission; physical cleanup runs when the local worker is invoked.</p>
    {props.dirty && <p className="mt-3 font-semibold">Save your text changes before changing photos.</p>}
    <label htmlFor="draft-photo-file" className="mt-5 block font-semibold">Choose a synthetic laptop photo</label>
    <input ref={input} id="draft-photo-file" type="file" accept="image/jpeg,image/png" aria-describedby="photo-help photo-feedback"
      disabled={disabled} className="mt-2 block min-h-12 w-full max-w-full rounded-md border border-[#75837c] p-2" />
    <div className="mt-3 flex flex-wrap gap-3">
      <button type="button" className={button} disabled={disabled || photos.length >= 10} onClick={() => void upload()}>Upload synthetic photo</button>
      <button type="button" className={button} disabled={props.locked || phase !== "ready"} onClick={() => void refresh().then(() => announce("Photo status refreshed.")).catch(() => announce("Photo status could not be refreshed. Reload if your session or draft changed.", true))}>Refresh photo status</button>
    </div>
    {progress !== null && <div className="mt-4"><label htmlFor="photo-progress">Upload progress: {progress}%</label><progress id="photo-progress" className="block w-full" max={100} value={progress} /></div>}
    <p ref={feedback} id="photo-feedback" tabIndex={-1} role={error ? "alert" : "status"} aria-atomic="true" className="mt-4 font-medium">{message}</p>
    {phase === "uncertain" && <button type="button" className={button} onClick={() => pending.current && void execute(pending.current)}>Retry same photo request</button>}
    {canDiscard && phase === "ready" && <button type="button" className={`${button} mt-3`} onClick={() => void discard()}>Discard unfinished upload</button>}
    <p className="mt-4">{photos.length} of 10 photo slots used. {photos.filter((photo) => photo.status === "APPROVED").length} safely processed synthetic images. Actual-item evidence: 0 qualifying photos.</p>
    <ol className="mt-5 space-y-6">{photos.map((photo, index) => <li key={photo.id} className="min-w-0 border-t border-[#d9dfda] pt-4">
      {photo.src && <img src={photo.src} alt={`Synthetic laptop evidence, photo ${index + 1}. Fictional item.`} width={640} height={420} className="h-auto max-h-80 max-w-full rounded-md border border-[#75837c] object-contain" />}
      <p className="mt-2 font-semibold">Photo {index + 1} · {names[photo.status] ?? "Unavailable"}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" className={button} disabled={disabled || index === 0} aria-label={`Move photo ${index + 1} earlier`} onClick={() => change(index, -1)}>Move earlier{index === 0 && " (first)"}</button>
        <button type="button" className={button} disabled={disabled || index === photos.length - 1} aria-label={`Move photo ${index + 1} later`} onClick={() => change(index, 1)}>Move later{index === photos.length - 1 && " (last)"}</button>
        <button id={`photo-control-${photo.id}`} type="button" className={button} disabled={disabled} aria-label={`Remove photo ${index + 1}`} onClick={() => change(index)}>Remove</button>
        {["FAILED", "REJECTED", "QUARANTINED"].includes(photo.status) && <button type="button" className={button} disabled={disabled} onClick={() => input.current?.focus()}>Retry with a new upload</button>}
      </div>
    </li>)}</ol>
  </section>;
}
