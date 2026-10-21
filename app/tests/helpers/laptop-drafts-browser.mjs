import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

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

    // Commit the save, then lose its response. The UI must reuse the exact request.
    await run(["fill", "#model", "Synthetic retry model"]);
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

    // A second editor advances revision before this stale form submits.
    await evaluate(`(async () => {
      const detail = await (await fetch('/api/laptop-drafts/${listingId}')).json();
      const result = await fetch('/api/laptop-drafts/${listingId}', { method: 'PUT', headers: {'content-type':'application/json'},
        body: JSON.stringify({requestId:crypto.randomUUID(),expectedRevision:detail.revision,draft:{...detail.draft,model:'Newer model'}}) });
      return result.status;
    })()`);
    await run(["fill", "#model", "Stale model"]);
    await run(["click", "button[type=submit]"]);
    await wait(`document.querySelector('[role=alert]')?.textContent.includes('newer revision')`);
    assert.equal(await evaluate("document.querySelector('#model').value"), "Stale model");
    assert.equal(await database.listingRevision.count({ where: { listingId } }), 4);
    await evaluate("window.confirm = () => true; true");
    // Disarm only the test browser's native leave prompt after asserting retained stale edits.
    await run(["dialog", "accept"] ).catch(() => {});
    await button("Reload saved draft");
    await run(["dialog", "accept"]).catch(() => {});
    await wait(`document.querySelector('#model')?.value === 'Newer model'`);
    await run(["fill", "#privatePriceExpectation", "12.345"]);
    await run(["click", "button[type=submit]"]);
    await wait(`document.querySelector('[aria-invalid=true]')?.id === 'privatePriceExpectation'`);
    assert.equal(await evaluate("document.querySelector('#privatePriceExpectation').getAttribute('aria-describedby').includes('price-error') && Boolean(document.querySelector('#price-error'))"), true);
    await run(["fill", "#privatePriceExpectation", "2468135.79"]);
    await run(["click", "button[type=submit]"]);
    await wait(`document.querySelector('[role=status]')?.textContent.includes('saved at revision 5')`);

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
    await database.session.deleteMany({ where: { userId: id } });
    await run(["click", "button[type=submit]"]);
    await wait(`document.querySelector('main')?.textContent.includes('session is no longer available')`);
    assert.equal(await evaluate("document.querySelector('#privatePriceExpectation') === null"), true);
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
