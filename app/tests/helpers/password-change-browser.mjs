import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { createAccountFlowOperations } from "../../src/server/repositories/account-flows.ts";

/** Installed agent-browser, isolated profile, synthetic data and real mounted commands. */
export async function checkPasswordChangeBrowser(origin, database, auth) {
  const session = `halaga-password-${randomUUID()}`;
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
        assert.equal(code, 0, `${args[0]}: ${error || output}`);
        const result = JSON.parse(output);
        assert.equal(result.success, true, JSON.stringify(result)); resolve(result.data);
      } catch (failure) { reject(failure); }
    });
    child.stdin.end(source);
  });
  const evaluate = async (source) => (await run(["eval", "--stdin"], source)).result;
  const wait = (source) => run(["wait", "--fn", source]);
  const submit = () => run(["click", "button[type=submit]"]);
  const fill = async (current, next) => {
    await run(["fill", "#currentPassword", current]);
    await run(["fill", "#newPassword", next]);
  };
  const email = "browser-password-change@example.invalid", password = "synthetic-browser-current-password";
  const replacement = "synthetic-browser-new-password", final = "synthetic-browser-final-password";
  await createAccountFlowOperations(database, auth).signup({ email, password, displayName: "Synthetic browser owner",
    dateOfBirth: "2000-01-01", adultAttestationAccepted: true });
  const { id: userId } = await database.user.findUnique({ where: { email }, select: { id: true } });
  const owner = await database.userAccount.findUnique({ where: { authUserId: userId }, select: { id: true } });
  const notices = () => database.passwordChangeNotice.count({ where: { accountId: owner.id } });
  try {
    await run(["open", `${origin}/account/sign-in`]);
    await run(["wait", "#email"]);
    await submit();
    await wait(`document.querySelector('[role=alert]')?.textContent.includes('Check the highlighted fields')`);
    await run(["fill", "#email", email]); await run(["fill", "#password", password]);
    await submit();
    await wait(`document.querySelector('[role=status]')?.textContent.includes('Sign-in completed')`);
    const initiating = await database.session.findFirst({ where: { userId } });
    await fetch(`${origin}/api/auth/sign-in/email`, { method: "POST", headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({ email, password }) });
    assert.equal(await database.session.count({ where: { userId } }), 2);
    await run(["open", `${origin}/account/change-password`]);
    await run(["wait", "#currentPassword"]);
    const tree = await run(["snapshot", "-i"]);
    assert.ok(JSON.stringify(tree).includes("Current password"));
    await submit();
    await wait(`document.querySelector('[role=alert]')?.textContent.includes('Check the highlighted fields')`);
    assert.equal(await evaluate("document.activeElement.getAttribute('role')"), "alert");
    assert.equal(await evaluate("document.querySelectorAll('[aria-invalid=true]').length"), 2);
    await run(["click", 'a[href="#currentPassword"]']);
    assert.equal(await evaluate("document.activeElement.id"), "currentPassword");
    await run(["press", "Tab"]);
    assert.equal(await evaluate("document.activeElement.id"), "newPassword");
    await fill(password, "short"); await submit();
    await wait(`document.querySelector('#newPassword-error')?.textContent.includes('8 to 128')`);
    await fill("wrong-browser-password-sentinel", replacement); await submit();
    await wait(`document.querySelector('[role=alert]')?.textContent.includes('Check your current password')`);
    assert.equal(await notices(), 0);
    assert.equal(await evaluate("[...document.querySelectorAll('input')].every(input => input.value === '')"), true);

    await fill(password, replacement);
    await evaluate(`window.passwordOriginalFetch = window.fetch; window.passwordRequests = 0;
      window.fetch = (...args) => { window.passwordRequests++; return new Promise(resolve => {
        window.passwordRelease = () => resolve(window.passwordOriginalFetch(...args));
      }); }; true`);
    await run(["focus", "#newPassword"]); await run(["press", "Enter"]);
    await wait(`document.querySelector('form').getAttribute('aria-busy') === 'true'`);
    assert.equal(await evaluate("document.querySelector('button[type=submit]').disabled && [...document.querySelectorAll('input')].every(input => input.readOnly)"), true);
    assert.equal(await evaluate("document.querySelector('[role=status]').textContent.includes('Changing password')"), true);
    await evaluate("document.querySelector('form').requestSubmit(); document.querySelector('form').requestSubmit(); true");
    assert.equal(await evaluate("window.passwordRequests"), 1);
    await evaluate("window.passwordRelease(); true");
    await wait(`document.querySelector('[role=status]')?.textContent.includes('Password changed.')`);
    assert.equal(await evaluate("document.activeElement.getAttribute('role')"), "status");
    assert.equal(await evaluate("[...document.querySelectorAll('input')].every(input => input.value === '')"), true);
    assert.equal(await notices(), 1);
    assert.deepEqual(await database.session.findMany({ where: { userId } }), [initiating]);
    await run(["focus", "#currentPassword"]); await run(["press", "Tab"]);
    assert.equal(await evaluate("document.querySelector('[role=status]').textContent.includes('Password changed.')"), true);
    assert.equal(await database.outboxEvent.count({ where: { accountId: owner.id, eventType: { contains: "password-changed" } } }), 0);

    await evaluate("window.fetch = window.passwordOriginalFetch; true");
    await database.session.update({ where: { id: initiating.id }, data: { createdAt: new Date(Date.now() - 15 * 60 * 1000) } });
    await fill(replacement, final); await submit();
    await wait(`document.querySelector('[role=alert]')?.textContent.includes('within 15 minutes')`);
    assert.equal(await evaluate("document.querySelector('[role=alert] a').getAttribute('href')"), "/account/sign-in");
    await database.session.update({ where: { id: initiating.id }, data: { createdAt: initiating.createdAt } });

    for (const [substitute, message] of [
      ["async () => new Response('{}', { status: 429 })", "Too many password-change attempts"],
      ["async () => { throw new Error('private-browser-error-sentinel'); }", "could not be confirmed"],
      ["async () => new Response(JSON.stringify({ status: 'UNRECOGNIZED' }), { status: 200 })", "could not be confirmed"],
    ]) {
      await evaluate(`window.fetch = ${substitute}; true`);
      await fill(replacement, final); await submit();
      await wait(`document.querySelector('[role=alert]')?.textContent.includes('${message}')`);
      assert.equal(await evaluate("document.activeElement.getAttribute('role')"), "alert");
      assert.equal(await evaluate("[...document.querySelectorAll('input')].every(input => input.value === '')"), true);
      assert.equal(await notices(), 1);
    }
    // A committed response can be lost. Truthful uncertainty must never resubmit it.
    await evaluate(`window.passwordRequests = 0; window.fetch = async (...args) => {
      window.passwordRequests++; await window.passwordOriginalFetch(...args); throw new Error('synthetic-lost-response'); }; true`);
    await fill(replacement, final); await submit();
    await wait(`document.querySelector('[role=alert]')?.textContent.includes('may already have changed')`);
    assert.equal(await evaluate("window.passwordRequests"), 1);
    assert.equal(await notices(), 2);
    const credential = await database.account.findFirst({ where: { userId, providerId: "credential" } });
    assert.equal(await (await auth.$context).password.verify({ hash: credential.password, password: final }), true);
    assert.deepEqual(await evaluate(`({ noQuery: location.search === '',
      fieldAnchorOnly: ['', '#currentPassword', '#newPassword'].includes(location.hash),
      noStoredCredentials: !/synthetic-browser|private-browser|synthetic-navigation/.test(
        JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)])) })`),
    { noQuery: true, fieldAnchorOnly: true, noStoredCredentials: true });
    assert.equal(await evaluate("document.body.textContent.includes('private-browser-error-sentinel')"), false);

    await evaluate("window.fetch = window.passwordOriginalFetch; true");
    for (const [width, height] of [[1440, 900], [375, 812], [320, 800]]) {
      await run(["set", "viewport", String(width), String(height)]);
      assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, `Viewport ${width}`);
      if (width !== 320) await run(["screenshot", resolve(`.next/password-change-${width}.png`)]);
    }
    await evaluate("document.documentElement.style.fontSize = '200%'; true");
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, "200% text at 320px");
    await evaluate("document.documentElement.style.fontSize = ''; true");
    const audit = await run(["a11y", "--tags", "wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa"]);
    assert.equal(audit.violations.length, 0, JSON.stringify(audit.violations));

    await fill(final, "synthetic-navigation-password");
    // Real document departure fires pagehide; returning through history must not restore secrets.
    await run(["open", `${origin}/account`]);
    await run(["back"]);
    await run(["wait", "#currentPassword"]);
    assert.equal(await evaluate("[...document.querySelectorAll('input')].every(input => input.value === '')"), true);
    await fill(final, "synthetic-navigation-password");
    await run(["find", "text", "All account screens", "click", "--exact"]);
    await wait("location.pathname === '/account'");
    await run(["back"]);
    await run(["wait", "#currentPassword"]);
    assert.equal(await evaluate("[...document.querySelectorAll('input')].every(input => input.value === '')"), true);
    assert.equal(await notices(), 2);
  } catch (failure) {
    const state = await evaluate(`({ path: location.pathname, status: document.querySelector('[role=status]')?.textContent,
      alert: document.querySelector('[role=alert]')?.textContent, pending: document.querySelector('form')?.getAttribute('aria-busy') })`);
    throw new Error(`${failure.stack}\nSynthetic form state: ${JSON.stringify(state)}`);
  } finally { await run(["close"]); }
}
