import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

/** Optional installed agent-browser CLI; no download, shared profile or real data. */
export async function checkSignupBrowser(origin, database) {
  const existingSessions = await database.session.count();
  const session = `halaga-signup-${randomUUID()}`;
  const run = (args, source) => new Promise((resolve, reject) => {
    const child = spawn(process.env.SIGNUP_BROWSER_EXECUTABLE, ["--session", session, "--json", ...args], {
      env: process.env, windowsHide: true, stdio: ["pipe", "pipe", "pipe"], timeout: 30000,
    });
    let output = "";
    let error = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { error += chunk; });
    child.on("error", reject);
    // The Windows browser daemon may inherit the CLI pipes. Wait for CLI exit,
    // then release our pipe handles rather than waiting for daemon shutdown.
    child.on("exit", (code) => {
      child.stdout.destroy();
      child.stderr.destroy();
      try {
        assert.equal(code, 0, `${args.slice(0, 2).join(" ")}: ${error || output}`);
        const result = JSON.parse(output);
        assert.equal(result.success, true, JSON.stringify(result));
        resolve(result.data);
      } catch (failure) { reject(failure); }
    });
    child.stdin.end(source);
  });
  const evaluate = async (source) => (await run(["eval", "--stdin"], source)).result;
  const wait = (expression) => run(["wait", "--fn", expression]);
  const fill = async () => {
    for (const [field, value] of Object.entries({ displayName: "Synthetic browser adult", email: "browser-signup@example.invalid",
      password: "synthetic-browser-signup-password" })) await run(["fill", `#${field}`, value]);
    // The CLI's generic fill uses keystrokes that do not set Chromium's segmented
    // native date input. Set only the synthetic date fixture via the native value.
    assert.equal(await evaluate("document.querySelector('#dateOfBirth').value = '2000-01-01'"), "2000-01-01");
    await run(["check", "#adultAttestationAccepted"]);
  };
  const feedback = () => evaluate(`({ text: document.querySelector('[role="alert"]')?.textContent ??
    document.querySelector('[role="status"]')?.textContent, focusedRole: document.activeElement.getAttribute('role') })`);
  try {
    await run(["open", `${origin}/account/register`]);
    await run(["wait", "#displayName"]);
    // Allow hydration to install the submit handler; the form has no fake success path.
    await run(["click", "button[type=submit]"]);
    await wait(`document.querySelector('[role="alert"]')?.textContent.includes('Check the highlighted fields')`);
    assert.equal((await feedback()).focusedRole, "alert");
    assert.equal(await evaluate(`document.querySelectorAll('[aria-invalid="true"]').length`), 5);
    await run(["click", 'a[href="#displayName"]']);
    assert.equal(await evaluate("document.activeElement.id"), "displayName");
    await run(["press", "Tab"]);
    assert.equal(await evaluate("document.activeElement.id"), "email");

    await fill();
    await evaluate(`window.signupOriginalFetch = window.fetch; window.signupRequests = 0;
      window.fetch = (...args) => { window.signupRequests++; return new Promise(resolve => {
        window.signupRelease = () => resolve(window.signupOriginalFetch(...args));
      }); }; true`);
    await run(["focus", "#password"]);
    await run(["press", "Enter"]);
    await wait(`document.querySelector('form').getAttribute('aria-busy') === 'true'`);
    assert.deepEqual(await evaluate(`({ disabled: document.querySelector('button[type=submit]').disabled,
      readOnly: [...document.querySelectorAll('input:not([type=checkbox])')].every(input => input.readOnly),
      checkboxDisabled: document.querySelector('[type=checkbox]').disabled,
      text: document.querySelector('[role=status]').textContent.includes('Submitting signup') })`),
    { disabled: true, readOnly: true, checkboxDisabled: true, text: true });
    await evaluate("document.querySelector('form').requestSubmit(); document.querySelector('form').requestSubmit(); true");
    assert.equal(await evaluate("window.signupRequests"), 1);
    await evaluate("window.signupRelease(); true");
    await wait(`document.querySelector('[role=status]')?.textContent.includes('Request received')`);
    const successText = (await feedback()).text;
    assert.equal((await feedback()).focusedRole, "status");
    assert.equal(await evaluate("[...document.querySelectorAll('input:not([type=checkbox])')].every(input => input.value === '') && !document.querySelector('[type=checkbox]').checked"), true);
    assert.equal(await database.user.count({ where: { email: "browser-signup@example.invalid" } }), 1);
    assert.equal(await database.session.count(), existingSessions);
    const workCount = await database.outboxEvent.count();
    await evaluate("window.fetch = window.signupOriginalFetch; true");
    await fill();
    await run(["click", "button[type=submit]"]);
    await wait(`document.querySelector('form').getAttribute('aria-busy') === 'false' && document.querySelector('#email').value === ''`);
    assert.equal((await feedback()).text, successText);
    assert.equal(await database.outboxEvent.count(), workCount);

    for (const substitute of ["async () => { throw new Error('private-browser-error-sentinel'); }",
      "async () => new Response(JSON.stringify({ status: 'UNRECOGNIZED' }), { status: 200 })"]) {
      await fill();
      await evaluate(`window.fetch = ${substitute}; true`);
      await run(["click", "button[type=submit]"]);
      await wait(`document.querySelector('[role=alert]')?.textContent.includes('could not be confirmed')`);
      assert.equal((await feedback()).focusedRole, "alert");
      assert.doesNotMatch((await feedback()).text, /private-browser-error-sentinel/);
      assert.equal(await evaluate("document.querySelector('#password').value"), "");
    }
    await evaluate("window.fetch = window.signupOriginalFetch; true");
    await fill();
    await evaluate("document.querySelector('#dateOfBirth').value = '2009-01-01'");
    await run(["click", "button[type=submit]"]);
    await wait(`document.querySelector('[role=alert]')?.textContent.includes('must establish age 18')`);
    await fill();
    await run(["click", "button[type=submit]"]);
    await wait(`document.querySelector('[role=alert]')?.textContent.includes('Too many signup attempts')`);
    assert.equal(await database.outboxEvent.count(), workCount);

    for (const [width, height] of [[1440, 900], [375, 812], [320, 800]]) {
      await run(["set", "viewport", String(width), String(height)]);
      assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true, `Viewport ${width}`);
    }
    await evaluate("document.documentElement.style.fontSize = '200%'; true");
    assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true, "200% text at 320px");
    await evaluate("document.documentElement.style.fontSize = ''; true");
    const audit = await run(["a11y", "--tags", "wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa"]);
    assert.equal(audit.violations.length, 0, JSON.stringify(audit.violations));
  } catch (failure) {
    const overflow = await evaluate(`({ width: innerWidth, scroll: document.documentElement.scrollWidth,
      elements: [...document.querySelectorAll('body *')].filter(element => element.getBoundingClientRect().right > innerWidth)
        .map(element => ({ tag: element.tagName, id: element.id, width: element.getBoundingClientRect().width })) })`);
    throw new Error(`${failure.message}\nSynthetic layout: ${JSON.stringify(overflow)}`);
  } finally {
    await run(["close"]);
  }
}
