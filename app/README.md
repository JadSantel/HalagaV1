# Halaga local laptop diagnostic prototype

The English prototype now covers Q1–Q13 and their follow-ups from
`../docs/design/LAPTOP_DIAGNOSTICS.md` (ADR-068). It calculates the four accepted
conditions, explains the source answers, and shows battery safety, battery
operation, lock status, and test coverage separately.

Everything remains a local, synthetic-data exercise. Drafts are held only in
React browser memory. There are no form submission endpoints, database calls,
uploads, authentication, analytics, local-storage saves, emails, or publication
actions. Refreshing or closing the tab loses the draft. Metadata is static;
`noindex` is not an access control or permission to deploy this prototype.

## Try it locally

From PowerShell at the repository root:

```powershell
cd app
npm.cmd run dev -- --hostname 127.0.0.1
```

Open http://127.0.0.1:3000 (or the port printed by Next.js). The command binds
to the local loopback interface. Stop the server with Ctrl+C.

Choose an example, click **Load example**, and confirm replacement if asked.
For ordinary examples, click **Review sample draft** to see the explanation.

| Made-up example | Expected result | Why |
| --- | --- | --- |
| Safe | Fully functional | All primary checks pass; optional checks remain untested. Cosmetic scratches do not affect condition. |
| Defective | Functional with issues | Battery does not power the laptop and the camera fails; the laptop still performs an intended function. |
| Insufficiently tested | Untested/unknown | No compatible charger was available, so required external-power testing is incomplete. |
| Not functional | Not functional | Nothing happens when powered on and external-power testing conclusively fails. Downstream checks can truthfully remain Could not test. |
| Unsafe battery | Stop testing, no ordinary condition | A suspected hazardous battery blocks ordinary review. No actual rejection or publication occurs. |
| Uncertain safety | Stop testing, no ordinary condition | Ambiguous safety would require human review in the marketplace. No actual hold or operator request is created here. |

In review, click **Change battery presence and operation** or another source
correction button. It returns to the relevant field with focus. Correcting a
source answer recomputes the condition immediately without moving focus.

Try these additional checks:

- In Defective, change the battery to normal and the camera to Works or Did not
  test. With the other checks still passing, the result becomes Fully functional.
- In Safe, change a required check to Could not test. The result becomes
  Untested/unknown, with that check identified in review.
- For Not applicable on a primary feature, explain why it is genuinely absent
  by design/configuration. A missing or broken expected component is not Not
  applicable. Described defects also require explanatory text.
- Change safety to an unsafe/uncertain answer: testing controls disappear,
  previous diagnostics are cleared, and review is disabled. Returning to a
  safe answer requires fresh answers. Included-item selections are retained.
- Use **Stop testing — safety concern** if a later observation suggests a
  hazardous battery or electrical condition. It enters the uncertain-safety
  stop and returns focus to safety.
- Clear the form and attempt review to see linked errors. Before a safety
  answer, errors refer only to visible controls. Try keyboard navigation,
  narrow widths, and zoom manually.

## Checks

Inspected package scripts: `dev`, `build`, `start`, `lint`, and
`test:diagnostics`. The diagnostic checks use Node 24's built-in test runner
and TypeScript support; no dependency or separate test framework was added.

```powershell
npm.cmd run test:diagnostics
npm.cmd run lint
npm.cmd run build
```

The checks cover all six examples plus rule priorities, battery cases,
applicability, optional tests, missing parts, lock disclosures, contradictory
observations, correction validation, and clearing answers after a safety stop.
Node may print `MODULE_TYPELESS_PACKAGE_JSON` while detecting the TypeScript
module format; that warning is not a failed test. The whole application's
module configuration has not been changed solely to silence it.

Browser rendering, native select behavior, screen-reader announcements,
keyboard navigation, contrast, and zoom/reflow require manual verification.
Passing logic checks or a build does not establish WCAG compliance.

## Scope and mapping notes

- `../PROJECT.md`, accepted ADRs, and `../architecture.md` govern behavior;
  `../design.md` governs proposed layout and accessibility guidance.
- Question metadata and in-memory drafts carry `laptop-diagnostics-en-v1`.
  No schema version, listing revision, or diagnostic history is persisted.
- Derivation evaluates safety first, then conclusive terminal failure, then
  insufficient primary testing, then disclosed defects, then fully functional.
  Lights, fans, and battery status alone do not prove an intended computing
  function. Contradictory positive/negative observations remain unknown.
- The live result reflects current diagnostic answers; entering review also
  requires all mandatory disclosures and applicable explanations to validate.
- **Locked startup mapping:** Q5's "Stops at a disclosed ... lock" is treated
  as preventing the condition-required test of startup to a usable system
  state (prototype §2.2), so it yields Untested/unknown. A responsive locked
  screen can establish an intended function, so it is not treated as terminal
  failure or as a defect merely because it is locked. Q13's lock disclosure
  alone never changes condition when Q5 reaches a usable system state. This
  records the bounded interpretation used in this prototype, not a broader
  policy that every locked device is unknown. Validate this distinction in
  the accepted English prototype's usability review before participant use.
- English usability validation and human-reviewed paired Cebuano/Bisaya
  wording remain required before participant/pilot use. No translation has
  been invented or marked accepted.
- Actual-item photos, location/fulfillment, ownership declaration,
  authenticated server validation, persistence, and publication remain future
  slices. No hosting, storage, worker, or paid service decision is made here.
