import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import sharp from "sharp";
import { openPhotoStore, PhotoInvalid } from "../../src/server/draft-photo-processing.ts";
import { createDraftPhotoWorker } from "../../src/server/repositories/draft-photo-worker.ts";
import { samples } from "../../src/domain/laptop-diagnostics.ts";

/** Real browser -> mounted routes -> disposable synthetic database. */
export async function checkLaptopDraftBrowser(origin, database, auth) {
  const session = `halaga-drafts-${randomUUID()}`;
  const run = (args, source) => new Promise((resolve, reject) => {
    const child = spawn(process.env.SIGNUP_BROWSER_EXECUTABLE, ["--session", session, "--json", ...args], {
      env: process.env, windowsHide: true, stdio: ["pipe", "pipe", "pipe"], timeout: 30000,
    });
    let output = "", error = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { error += chunk; });
    child.on("error", reject);
    child.on("exit", (code) => {
      child.stdout.destroy(); child.stderr.destroy();
      try {
        assert.equal(code, 0, `${args.join(" ")}: ${error || output}`);
        const result = JSON.parse(output);
        assert.equal(result.success, true, JSON.stringify(result)); resolve(result.data);
      } catch (failure) { reject(failure); }
    });
    child.stdin.end(source);
  });
  const evaluate = async (source) => (await run(["eval", "--stdin"], source)).result;
  const wait = (source) => run(["wait", "--fn", source]);
  const follow = async (selector) => { await run(["focus", selector]); await run(["press", "Enter"]); };
  const button = (name) => run(["find", "role", "button", "click", "--name", name, "--exact"]);
  const focusButton = (name) => evaluate(`([...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(name)}).focus(),true)`);
  const id = randomUUID(), email = `${id}@example.invalid`, password = "synthetic-drafts-browser-password";
  const { password: hashing } = await auth.$context;
  await database.user.create({ data: { id, name: "Synthetic workspace owner", email, emailVerified: false } });
  await database.account.create({ data: { id: randomUUID(), userId: id, accountId: id,
    providerId: "credential", password: await hashing.hash(password) } });
  const owner = await database.userAccount.create({ data: { authUserId: id, displayName: "Synthetic workspace owner",
    adultEligibilityCheckedAt: new Date(), adultAttestedAt: new Date() } });

  try {
    await run(["open", `${origin}/drafts`]);
    await wait(`document.querySelector('main')?.textContent.includes('Sign in to find')`);
    await run(["open", `${origin}/account/sign-in`]);
    await run(["wait", "#email"]);
    await run(["fill", "#email", email]);
    await run(["fill", "#password", password]);
    await run(["focus", "#password"]);
    await run(["press", "Enter"]);
    await wait(`document.querySelector('[role=status]')?.textContent.includes('Sign-in completed')`);
    await follow('a[href="/drafts"]');
    await wait(`document.querySelector('main')?.textContent.includes('No laptop drafts yet')`);
    await evaluate(`window.listFetch = window.fetch;
      window.fetch = async (...args) => { const response = await window.listFetch(...args);
        if (args[1]?.method === 'POST') throw new Error('synthetic lost create response');
        return response;
      }; true`);
    await run(["click", "main button"]);
    await wait(`document.querySelector('[role=alert]')?.textContent.includes('could not be confirmed')`);
    assert.equal(await database.listing.count({ where: { sellerId: owner.id } }), 1);
    await evaluate("window.fetch = window.listFetch; true");
    await button("Retry same create");
    await run(["wait", "#title"]);
    assert.equal(await database.listing.count({ where: { sellerId: owner.id } }), 1);
    assert.equal(await evaluate("document.querySelector('#fulfillment').value"), "");
    assert.equal(await evaluate("document.querySelector('#fulfillment').required"), false);
    assert.equal(await evaluate("document.querySelector('#fulfillment').getAttribute('aria-describedby')"), "fulfillment-help");
    await run(["focus", "#fulfillment"]);
    await run(["press", "ArrowDown"]);
    await run(["press", "Enter"]);
    assert.equal(await evaluate("document.querySelector('#fulfillment').value"), "pickup");
    await run(["fill", "#title", "Synthetic browser unfinished laptop"]);
    await run(["fill", "#privatePriceExpectation", "2468135.79"]);
    await evaluate(`window.originalDraftFetch = window.fetch; window.draftBodies = [];
      window.fetch = (...args) => {
        if (args[1]?.method !== 'PUT') return window.originalDraftFetch(...args);
        window.draftBodies.push(args[1].body);
        return new Promise(resolve => { window.releaseDraftSave = () => resolve(window.originalDraftFetch(...args)); });
      }; true`);
    await run(["focus", "#title"]);
    await run(["press", "Enter"]);
    await wait(`document.querySelector('form')?.getAttribute('aria-busy') === 'true'`);
    assert.equal(await evaluate(`document.querySelector('fieldset').disabled && document.querySelector('button[type=submit]').disabled`), true);
    await evaluate(`document.querySelector('form').requestSubmit(); true`);
    assert.equal(await evaluate("window.draftBodies.length"), 1);
    await evaluate("window.releaseDraftSave(); true");
    await wait(`document.querySelector('[role=status]')?.textContent.includes('saved at revision 2')`);
    const listingId = await evaluate("location.pathname.split('/').pop()");
    let stored = await database.listing.findUnique({ where: { id: listingId }, include: { currentRevision: true } });
    assert.equal(stored.sellerId, owner.id);
    assert.equal(stored.status, "DRAFT");
    assert.equal(stored.currentRevision.conditionSummary, null);
    assert.equal(stored.currentRevision.priceExpectation.toFixed(2), "2468135.79");
    assert.equal(stored.currentRevision.fulfillment, "pickup");

    // Commit the save, then lose its response. The UI must reuse the exact request.
    await run(["fill", "#model", "Synthetic retry model"]);
    await run(["select", "#fulfillment", "meetup"]);
    await evaluate(`window.fetch = async (...args) => {
      if (args[1]?.method !== 'PUT') return window.originalDraftFetch(...args);
      window.draftBodies.push(args[1].body);
      await window.originalDraftFetch(...args); throw new Error('private-error-sentinel');
    }; true`);
    await run(["click", "button[type=submit]"]);
    await wait(`document.querySelector('[role=alert]')?.textContent.includes('could not be confirmed')`);
    assert.equal(await evaluate("document.activeElement.getAttribute('role')"), "alert");
    assert.equal(await evaluate("document.querySelector('fieldset').disabled"), true);
    await evaluate(`window.fetch = (...args) => {
      if (args[1]?.method === 'PUT') window.draftBodies.push(args[1].body);
      return window.originalDraftFetch(...args);
    }; true`);
    await button("Retry same save");
    await wait(`document.querySelector('[role=status]')?.textContent.includes('saved at revision 3')`);
    assert.equal(await evaluate("window.draftBodies[1] === window.draftBodies[2]"), true);
    assert.equal(await database.listingRevision.count({ where: { listingId } }), 3);
    await follow('a[href="/drafts"]');
    await wait(`document.querySelector('main')?.textContent.includes('Synthetic browser unfinished laptop')`);
    assert.equal(await evaluate("document.querySelector('main').textContent.includes('2468135.79')"), false);
    await follow('a[aria-label="Resume Synthetic browser unfinished laptop"]');
    await run(["wait", "#model"]);
    assert.equal(await evaluate("document.querySelector('#model').value"), "Synthetic retry model");
    assert.equal(await evaluate("document.querySelector('#privatePriceExpectation').value"), "2468135.79");
    assert.equal(await evaluate("document.querySelector('#fulfillment').value"), "meetup");
    await run(["reload"]);
    await wait(`document.querySelector('#fulfillment')?.value === 'meetup'`);

    // A second editor advances revision before this stale form submits.
    await evaluate(`(async () => {
      const detail = await (await fetch('/api/laptop-drafts/${listingId}')).json();
      const result = await fetch('/api/laptop-drafts/${listingId}', { method: 'PUT', headers: {'content-type':'application/json'},
        body: JSON.stringify({requestId:crypto.randomUUID(),expectedRevision:detail.revision,draft:{...detail.draft,model:'Newer model',fulfillment:'both'}}) });
      return result.status;
    })()`);
    await run(["fill", "#model", "Stale model"]);
    await run(["select", "#fulfillment", "pickup"]);
    await run(["click", "button[type=submit]"]);
    await wait(`document.querySelector('[role=alert]')?.textContent.includes('newer revision')`);
    assert.equal(await evaluate("document.querySelector('#model').value"), "Stale model");
    assert.equal(await evaluate("document.querySelector('#fulfillment').value"), "pickup");
    assert.equal(await database.listingRevision.count({ where: { listingId } }), 4);
    await evaluate("window.confirm = () => true; true");
    // Disarm only the test browser's native leave prompt after asserting retained stale edits.
    await run(["dialog", "accept"] ).catch(() => {});
    await button("Reload saved draft");
    await run(["dialog", "accept"]).catch(() => {});
    await wait(`document.querySelector('#model')?.value === 'Newer model'`);
    assert.equal(await evaluate("document.querySelector('#fulfillment').value"), "both");
    await run(["fill", "#privatePriceExpectation", "12.345"]);
    await run(["click", "button[type=submit]"]);
    await wait(`document.querySelector('[aria-invalid=true]')?.id === 'privatePriceExpectation'`);
    assert.equal(await evaluate("document.querySelector('#privatePriceExpectation').getAttribute('aria-describedby').includes('price-error') && Boolean(document.querySelector('#price-error'))"), true);
    await run(["fill", "#privatePriceExpectation", "2468135.79"]);
    await run(["select", "#fulfillment", ""]);
    await run(["click", "button[type=submit]"]);
    await wait(`document.querySelector('[role=status]')?.textContent.includes('saved at revision 5')`);
    await run(["reload"]);
    await run(["wait", "#fulfillment"]);
    assert.equal(await evaluate("document.querySelector('#fulfillment').value"), "");
    const revisions = await database.listingRevision.findMany({ where: { listingId }, orderBy: { version: "asc" }, select: { fulfillment: true } });
    assert.deepEqual(revisions.map(({ fulfillment }) => fulfillment), [null, "pickup", "meetup", "both", null]);

    await run(["check", 'input[name="safety"][value="clear"]']);
    await run(["wait", "#power"]);
    for (const [width, height] of [[1440, 900], [375, 812], [320, 800]]) {
      await run(["set", "viewport", String(width), String(height)]);
      assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, `Viewport ${width}`);
      if (width !== 320) {
        await evaluate("window.scrollTo(0, 0); true");
        await run(["screenshot", resolve(`.next/draft-workspace-${width}.png`)]);
      }
    }
    await evaluate("document.documentElement.style.fontSize = '200%'; true");
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, "200% text at 320px");
    await evaluate("document.documentElement.style.fontSize = ''; true");
    const audit = await run(["a11y", "--tags", "wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa"]);
    assert.equal(audit.violations.length, 0, JSON.stringify(audit.violations));
    await run(["focus", 'input[name="safety"][value="hazard"]']);
    await run(["press", "Space"]);
    assert.equal(await evaluate("document.querySelector('#power') === null"), true);
    await run(["click", "button[type=submit]"]);
    await wait(`document.querySelector('[role=status]')?.textContent.includes('saved at revision 6')`);

    // Keyboard entry reviews the saved revision, never the in-memory form.
    await follow(`a[href="/drafts/${listingId}/review?revision=6"]`);
    await wait(`Boolean(document.querySelector('#owner-private'))`);
    assert.equal(await evaluate("document.activeElement.tagName"), "H1");
    assert.equal(await evaluate("document.querySelector('#proposed-public').textContent.includes('No ordinary condition')"), true);
    assert.equal(await evaluate("document.querySelector('#proposed-public').textContent.includes('2,468,135.79')"), false);
    assert.equal(await evaluate("document.querySelector('#owner-private').textContent.includes('2,468,135.79')"), true);
    assert.equal(await evaluate("document.querySelector('main').textContent.includes('Nothing is published')"), true);
    assert.equal(await evaluate("document.querySelectorAll('form, input[type=checkbox]').length"), 0);
    await run(["focus", '[aria-labelledby="submission-title"] summary']); await run(["press", "Enter"]);
    assert.equal(await evaluate(`document.querySelector('[aria-labelledby="submission-title"] details').open`), true);
    await run(["press", "Enter"]);
    assert.equal(await evaluate(`document.querySelector('[aria-labelledby="submission-title"] details').open`), false);
    // A recheck never submits. Pending, response loss and retry retain this review.
    await evaluate(`window.checkFetch=window.fetch; window.checkBodies=[];
      window.fetch=(...args)=>{
        if(!String(args[0]).endsWith('/submission-check'))return window.checkFetch(...args);
        window.checkBodies.push(args[1].body);
        return new Promise(resolve=>{window.releaseCheck=()=>resolve(window.checkFetch(...args))});
      }; true`);
    await focusButton("Recheck saved revision 6"); await run(["press", "Enter"]);
    await wait(`document.querySelector('#submission-feedback')?.textContent.includes('Rechecking saved revision 6')`);
    assert.equal(await evaluate(`document.querySelector('[aria-labelledby="submission-title"] button').disabled`), true);
    assert.equal(await evaluate(`document.querySelector('[aria-labelledby="submission-title"] button').getAttribute('aria-busy')`), "true");
    await evaluate(`document.querySelector('[aria-labelledby="submission-title"] button').click(); true`);
    assert.equal(await evaluate("window.checkBodies.length"), 1);
    await evaluate("window.releaseCheck(); true");
    await wait(`document.querySelector('#submission-feedback')?.textContent.includes('was rechecked')`);
    assert.equal(await evaluate("document.activeElement.id"), "submission-feedback");
    assert.equal(await evaluate("document.querySelector('#submission-feedback').textContent.includes('Ineligible for normal publication')"), true);
    await evaluate(`window.fetch=async(...args)=>{
      if(!String(args[0]).endsWith('/submission-check'))return window.checkFetch(...args);
      window.checkBodies.push(args[1].body);await window.checkFetch(...args);throw new Error('PRIVATE_CHECK_ERROR');
    };true`);
    await focusButton("Recheck saved revision 6"); await run(["press", "Enter"]);
    await wait(`document.querySelector('#submission-feedback')?.textContent.includes('could not be confirmed')`);
    assert.equal(await evaluate("document.activeElement.id"), "submission-feedback");
    assert.equal(await evaluate("document.querySelector('#owner-private').textContent.includes('2,468,135.79')"), true);
    assert.equal(await evaluate("document.body.textContent.includes('PRIVATE_CHECK_ERROR')"), false);
    await evaluate(`window.fetch=(...args)=>{if(String(args[0]).endsWith('/submission-check'))window.checkBodies.push(args[1].body);return window.checkFetch(...args)};true`);
    await focusButton("Retry revision recheck"); await run(["press", "Enter"]);
    await wait(`document.querySelector('#submission-feedback')?.textContent.includes('was rechecked')`);
    assert.equal(await evaluate("window.checkBodies[1]===window.checkBodies[2]"), true);
    for (const [status, code, expected] of [[401, "UNAUTHORIZED", "Sign in again"], [403, "ACTION_RESTRICTED", "cannot proceed with publication"],
      [404, "NOT_FOUND", "no longer available"], [500, "INTERNAL_ERROR", "could not be confirmed"]]) {
      await evaluate(`window.fetch=(...args)=>String(args[0]).endsWith('/submission-check')
        ?Promise.resolve(new Response(JSON.stringify({code:${JSON.stringify(code)}}),{status:${status}})):window.checkFetch(...args);true`);
      await focusButton("Recheck saved revision 6"); await run(["press", "Enter"]);
      await wait(`document.querySelector('#submission-feedback')?.textContent.includes(${JSON.stringify(expected)})`);
      assert.equal(await evaluate("document.activeElement.id"), "submission-feedback");
      assert.equal(await evaluate("document.querySelector('#submission-feedback').getAttribute('role')"), "alert");
      assert.equal(await evaluate("Boolean(document.querySelector('#proposed-public'))"), true);
    }
    await evaluate("window.fetch=window.checkFetch;true");
    assert.equal(await database.ownershipDeclaration.count(), 0);
    assert.equal(await database.heldLaptopReview.count(), 0);
    assert.equal((await database.listing.findUnique({ where: { id: listingId } })).status, "DRAFT");
    await follow(`a[href="/drafts/${listingId}#safety"]`);
    await run(["wait", "#safety"]);
    await wait(`document.activeElement.id === 'safety'`);
    await run(["open", `${origin}/drafts/${listingId}/review?revision=5`]);
    await wait(`Boolean(document.querySelector('#owner-private'))`);
    assert.equal(await evaluate("document.querySelector('main').textContent.includes('A newer saved revision exists: 6')"), true);
    assert.equal(await evaluate(`document.querySelector('[aria-labelledby="submission-title"] button').disabled`), true);
    assert.equal(await evaluate("document.querySelector('#proposed-public').textContent.includes('Not answered')"), true);
    await follow('a[href="#requirement-geography"]');
    assert.equal(await evaluate("document.activeElement.id"), "requirement-geography");
    await follow(`a[href="/drafts/${listingId}#brand"]`);
    await wait(`document.activeElement.id === 'brand'`);

    // Exercise accepted derivations through mounted save/read routes and the real review UI.
    for (const [index, sample] of samples.entries()) {
      const created = await evaluate(`(async () => {
        const response = await fetch('/api/laptop-drafts', {method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({requestId:crypto.randomUUID(),draft:${JSON.stringify({ ...sample.draft, fulfillment: "both", privatePriceExpectation: "1357913.57" })}})});
        return response.json();
      })()`);
      await run(["open", `${origin}/drafts/${created.id}/review?revision=1`]);
      await wait(`Boolean(document.querySelector('#owner-private'))`);
      const expected = sample.expected ?? "No ordinary condition";
      assert.equal(await evaluate(`document.querySelector('#proposed-public').textContent.includes(${JSON.stringify(expected)})`), true);
      const evaluationStatus = sample.safety === "blocked" ? "Ineligible for normal publication"
        : sample.safety === "hold" ? "Human review required before publication" : "Missing requirements";
      assert.equal(await evaluate(`document.querySelector('[aria-labelledby="requirements-title"]').textContent.includes(${JSON.stringify(evaluationStatus)})`), true);
      assert.equal((await database.listing.findUnique({ where: { id: created.id } })).status, "DRAFT");
      assert.equal(await evaluate("document.querySelector('#proposed-public').textContent.includes('1,357,913.57')"), false);
      assert.equal(await evaluate("document.querySelector('#owner-private').textContent.includes('1,357,913.57')"), true);
      if (index === 0) {
        const audit = await run(["a11y", "--tags", "wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa"]);
        assert.equal(audit.violations.length, 0, JSON.stringify(audit.violations));
        for (const [width, height] of [[1440, 900], [375, 812], [320, 800]]) {
          await run(["set", "viewport", String(width), String(height)]);
          assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
          if (width !== 320) await run(["screenshot", resolve(`.next/draft-review-${width}.png`)]);
        }
        await evaluate("document.documentElement.style.fontSize = '200%'; true");
        assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
        await evaluate("document.documentElement.style.fontSize = ''; true");
        // Another tab saves after review loaded. Recheck must retain the old
        // preview and report stale, without manufacturing a declaration or hold.
        await evaluate(`(async()=>{const r=await fetch('/api/laptop-drafts/${created.id}',{method:'PUT',headers:{'content-type':'application/json'},
          body:JSON.stringify({requestId:crypto.randomUUID(),expectedRevision:1,draft:{title:'Newer synthetic saved revision'}})});return r.status})()`);
        await focusButton("Recheck saved revision 1"); await run(["press", "Enter"]);
        await wait(`document.querySelector('#submission-feedback')?.textContent.includes('A newer revision exists')`);
        assert.equal(await evaluate("document.activeElement.id"), "submission-feedback");
        assert.equal(await evaluate(`document.querySelector('[aria-labelledby="submission-title"] button').disabled`), true);
        assert.equal(await evaluate("document.querySelector('#proposed-public').textContent.includes('Newer synthetic saved revision')"), false);
      }
    }
    // Separate draft: real file input/XHR -> mounted handlers -> durable rows ->
    // internal fake scanner (test-only) -> authorized derivative -> keyboard UI.
    const photoDraft = await evaluate(`(async()=>{const r=await fetch('/api/laptop-drafts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),draft:{}})});return r.json()})()`);
    await run(["open", `${origin}/drafts/${photoDraft.id}`]);
    await run(["wait", "#draft-photo-file"]);
    await run(["snapshot", "-i"]);
    const fixturePath = resolve(process.env.DRAFT_PHOTO_ROOT, "synthetic-fixture.jpg");
    await writeFile(fixturePath, await sharp(Buffer.from('<svg width="320" height="200"><rect width="320" height="200" fill="#eef2ee"/><path d="M50 40h220v110H50z" fill="#36443f"/><path d="M35 150h250l20 20H15z" fill="#75837c"/></svg>')).jpeg().toBuffer());
    await run(["upload", "#draft-photo-file", fixturePath]);
    await evaluate(`window.photoSend=XMLHttpRequest.prototype.send; XMLHttpRequest.prototype.send=function(...args){
      this.upload.onprogress?.({lengthComputable:true,loaded:50,total:100});
      this.onload=()=>this.onerror?.(new Event('error'));
      window.releasePhotoUpload=()=>window.photoSend.apply(this,args);
    }; true`);
    await focusButton("Upload synthetic photo");
    await run(["press", "Enter"]);
    await wait(`document.querySelector('#photo-progress')?.value === 50`);
    assert.equal(await evaluate("document.querySelector('fieldset').disabled"), true);
    await evaluate("window.releasePhotoUpload(); true");
    await wait(`document.querySelector('#photo-feedback')?.textContent.includes('could not be confirmed')`);
    assert.equal(await database.draftPhoto.count({ where: { listingId: photoDraft.id } }), 1);
    await evaluate("XMLHttpRequest.prototype.send=window.photoSend; true");
    await focusButton("Retry same photo request");
    await run(["press", "Enter"]);
    await wait(`document.querySelector('#photo-feedback')?.textContent.includes('Upload saved')`);
    assert.equal(await database.draftPhoto.count({ where: { listingId: photoDraft.id } }), 1);
    const photoStore = await openPhotoStore(process.env.DRAFT_PHOTO_ROOT);
    await createDraftPhotoWorker(database, photoStore, async () => { throw new PhotoInvalid(); }).runOnce();
    await button("Refresh photo status");
    await wait(`document.querySelector('#photos')?.textContent.includes('File rejected')`);
    await focusButton("Retry with a new upload");
    await run(["press", "Enter"]);
    assert.equal(await evaluate("document.activeElement.id"), "draft-photo-file");
    await run(["upload", "#draft-photo-file", fixturePath]);
    await focusButton("Upload synthetic photo");
    await run(["press", "Enter"]);
    await wait(`document.querySelector('#photo-feedback')?.textContent.includes('Upload saved') && document.querySelector('#photos')?.textContent.includes('2 of 10')`);
    await createDraftPhotoWorker(database, photoStore, async () => {}).runOnce();
    await button("Refresh photo status");
    await wait(`document.querySelector('#photos img')?.complete && document.querySelector('#photos img')?.naturalWidth > 0`);
    const imageId = (await database.draftPhoto.findFirst({ where: { listingId: photoDraft.id, status: "APPROVED" }, select: { id: true } })).id;
    await run(["focus", '[aria-label="Move photo 2 earlier"]']); await run(["press", "Enter"]);
    await wait(`document.querySelector('#photo-feedback')?.textContent.includes('position 1')`);
    assert.equal(await evaluate("document.activeElement.id"), `photo-control-${imageId}`);
    await run(["focus", '[aria-label="Remove photo 2"]']); await run(["press", "Enter"]);
    await wait(`document.querySelector('#photo-feedback')?.textContent.includes('Photo removed')`);
    assert.equal(await evaluate("document.activeElement.id"), "draft-photo-file");
    assert.equal((await database.listing.findUnique({ where: { id: photoDraft.id } })).currentRevisionNumber, 5);
    assert.equal(await database.draftPhotoReference.count({ where: { listingId: photoDraft.id, revision: { version: 3 } } }), 2);
    const photoAudit = await run(["a11y", "--tags", "wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa"]);
    assert.equal(photoAudit.violations.length, 0, JSON.stringify(photoAudit.violations));
    for (const [width, height] of [[1440, 900], [375, 812], [320, 800]]) {
      await run(["set", "viewport", String(width), String(height)]);
      assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
      if (width !== 320) await run(["screenshot", resolve(`.next/draft-photos-${width}.png`)]);
    }
    await evaluate("document.documentElement.style.fontSize='200%'; true");
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
    await evaluate("document.documentElement.style.fontSize=''; true");
    await run(["open", `${origin}/drafts/${listingId}`]);
    await run(["wait", "#privatePriceExpectation"]);
    await database.session.deleteMany({ where: { userId: id } });
    await run(["click", "button[type=submit]"]);
    await wait(`document.querySelector('main')?.textContent.includes('session is no longer available')`);
    assert.equal(await evaluate("document.querySelector('#privatePriceExpectation') === null"), true);
    await run(["open", `${origin}/drafts/${listingId}/review?revision=6`]);
    await wait(`document.querySelector('[role=status]')?.textContent.includes('Sign in to review')`);
    assert.equal(await evaluate("document.querySelector('#owner-private') === null && document.querySelector('#proposed-public') === null"), true);
    stored = await database.listing.findUnique({ where: { id: listingId }, include: { currentRevision: true } });
    assert.equal(stored.currentRevisionNumber, 6);
    assert.equal(stored.currentRevision.barangayCode, null);
    assert.equal(await database.publicationCycle.count(), 0);
    assert.equal(await database.listingMedia.count(), 0);
    const beforePractice = await database.listing.count();
    await run(["open", origin]);
    await run(["wait", "#sample"]);
    await button("Load example");
    await button("Review sample draft");
    await wait(`document.querySelector('h1')?.textContent === 'Review your sample draft'`);
    assert.equal(await evaluate("document.querySelector('main').textContent.includes('Nothing is saved or published.')"), true);
    await run(["reload"]);
    await run(["wait", "#title"]);
    assert.equal(await evaluate("document.querySelector('#title').value"), "");
    assert.equal(await database.listing.count(), beforePractice);
  } catch (failure) {
    const state = await evaluate(`({ path: location.pathname,
      busy: document.querySelector('form')?.getAttribute('aria-busy'),
      feedback: [...document.querySelectorAll('[role=alert], [role=status]')].map(element => element.textContent) })`).catch(() => null);
    throw new Error(`${failure.message}\nSynthetic UI state: ${JSON.stringify(state)}`);
  } finally {
    await database.session.deleteMany({ where: { userId: id } });
    await run(["close"]).catch(() => {});
  }
}
