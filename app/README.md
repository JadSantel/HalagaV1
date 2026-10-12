# Halaga local laptop draft prototype

This first slice is an English-only, in-memory practice form for a single laptop.
It includes item identity, description, and the accepted laptop diagnostic
questions Q1 (battery safety), Q2 (test coverage), and Q3 (power response).
It deliberately does not derive a condition from these incomplete diagnostics.
This is a partial prototype, not the complete listing or publication workflow.

## Try it locally

From PowerShell at the repository root:

```powershell
cd app
npm.cmd run dev -- --hostname 127.0.0.1
```

Open http://127.0.0.1:3000. If Next.js selects another port, use the address
printed in the terminal. Stop the server with Ctrl+C.

1. Click **Load made-up example**, then **Review sample draft**.
2. Click **Edit answers** and change a field; review again.
3. Click **Clear form**, confirm, and attempt review to see linked errors.
4. Choose the hazardous or uncertain battery answer. Testing stops, the
   remaining diagnostic controls disappear, and review is disabled. No
   rejection, moderation hold, or operator request is persisted.
5. Switch back to a safe answer: previous diagnostic answers were cleared
   and must be entered again. Refresh the page to return to a blank form.
6. Try keyboard navigation and a narrow browser window.

Use made-up details only. Form values remain in React memory in the browser;
there is no form submission endpoint, authentication, database call, upload,
analytics, local-storage save, email, or publication action. Refreshing or
closing the tab loses the draft. Resetting/replacing answers asks for confirmation.
The dev command binds to the local loopback interface. Metadata uses noindex,
but that is not an access control or permission to deploy this prototype.

## Checks

The existing package scripts are `dev`, `build`, `start`, and `lint`.

```powershell
npm.cmd run lint
npm.cmd run build
```

No test runner or automated accessibility/browser suite is configured yet.

## Scope and decisions

- Product rules come from `../PROJECT.md`, architecture from `../architecture.md`,
  and layout/accessibility guidance from `../design.md`.
- Diagnostic wording follows `../docs/design/LAPTOP_DIAGNOSTICS.md` and ADR-068.
- The safe-testing guidance is always available while answering diagnostics.
- Colors use the proposed design tokens; no brand proposal is marked accepted.
- ADR-068 accepts the first English prototype. English usability validation
  and a human-reviewed paired Cebuano/Bisaya translation remain required before
  participant/pilot use; this prototype does not invent that translation.
- Complete diagnostics, derived-condition explanations, actual-item photos,
  location/fulfillment, ownership declaration, authenticated server validation,
  persistence, and publication are future slices. No hosting, storage, or
  worker decision is made here.
