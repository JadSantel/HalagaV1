# Laptop Diagnostic Prototype

- Status: Accepted first English-language prototype
- Applies to: Laptop listings
- Last updated: 2026-10-11
- Decision record: ADR-068

## 1. Purpose

This prototype lets a non-technical seller report observable laptop facts without diagnosing repairability or choosing a condition label. Halaga derives one universal condition from the accepted answers and presents the explanation before publication.

The prototype does not ask the seller to open the laptop, remove parts, bypass a lock, install software, run a stress test, or continue testing when a battery or device may be unsafe.

## 2. Check classifications

### 2.1 Publication-required disclosures

These questions always require an answer before submission:

- Battery safety gate
- Test coverage
- Power response
- Built-in display behavior
- Startup behavior
- Built-in keyboard
- Built-in pointing device
- Power input and charging behavior
- Battery presence and operation
- Known intermittent or abnormal behavior
- Missing parts and included accessories
- Lock and management status

`Could not test` and `Not sure` are valid answers where offered. They satisfy disclosure but may prevent a sufficiently tested condition result.

### 2.2 Condition-required applicable checks

These checks must have a conclusive passing answer for `Fully functional` when the feature applies to the laptop:

- Power response
- Built-in display
- Startup to a usable system state
- Built-in keyboard
- Built-in pointing device
- Power input / ordinary external-power operation

A feature is `Not applicable` only when it is genuinely absent by the laptop's design or configuration. A missing or broken expected component is not `Not applicable`.

### 2.3 Optional enhanced checks

The seller may report these when safely tested:

- Wi-Fi
- Speakers or audio output
- Camera
- At least one USB port

Leaving an enhanced check untested does not by itself prevent `Fully functional`. If an enhanced check is tested and a defect is disclosed, the laptop derives `Functional with issues` when it otherwise performs an intended function.

### 2.4 Conditional battery check

Battery status is always disclosed prominently but is not a condition-required primary check in every configuration.

- `Not applicable by design/configuration` does not prevent `Fully functional`.
- `Present and operates normally` does not introduce an issue.
- `Present but degraded`, `Does not power the laptop`, `Does not charge`, or `Expected but absent` is a disclosed functional issue. If the laptop otherwise performs an intended function, the derived condition is `Functional with issues`, not `Not functional`.
- `Could not test` is shown prominently. It does not by itself prove a defect, but it may contribute to `Untested/unknown` when the overall required testing is insufficient.
- Any suspected hazardous condition exits ordinary derivation and follows the safety block/hold path.

## 3. Safe-testing preface

Show before the first diagnostic question:

> Only perform brief checks you already know how to do using the normal power button and a compatible charger. Do not open the laptop, remove or press the battery, bypass a password or device lock, install test software, or run demanding tests. Stop immediately if you notice swelling, leaking, puncture damage, unusual heat, smoke, sparks, or a strong chemical or burning odor.

The seller must be able to reopen this guidance from every diagnostic step.

## 4. Accepted English questions

### Q1. Battery safety gate

**Before testing, do you see or notice any sign that the battery may be unsafe?**

Help text: Look only from the outside. Do not press, remove, open, or handle the battery.

Answers:

- No sign of a battery safety problem
- Yes — swelling, leaking, puncture damage, unusual heat, smoke, sparks, or strong odor
- Not sure — something looks or feels unsafe
- No battery is installed or this configuration has no battery

Behavior:

- `Yes` stops testing and blocks ordinary publication with safe handling guidance.
- `Not sure` stops testing and creates the existing ambiguous-safety hold path.
- Neither result becomes ordinary `Untested/unknown`.
- `No battery` continues to the battery applicability questions; it is not automatically a safety issue.

### Q2. Test coverage

**How much of this laptop could you safely test?**

Answers:

- I completed all applicable required checks below
- I completed only some checks
- I could not safely test it

Optional follow-up for partial/no testing:

**Why could you not complete the checks?**

- No compatible charger
- Device lock or password prevented testing
- A required component is missing
- I do not know how to test it safely
- Another reason — describe

### Q3. Power response

**What happens when you press the normal power button?**

Answers:

- It powers on consistently
- It powers on only sometimes
- Lights or fans start, but there is no usable output
- Nothing happens
- Could not test

This records power response only. It does not answer whether the display works or the operating system starts.

### Q4. Built-in display

**What does the laptop's built-in screen do after power-on?**

Answers:

- Shows a clear and stable image
- Shows an image but has a visible problem — describe
- Lights up but shows no usable image
- Shows no image
- Not applicable — this configuration has no built-in display
- Could not test

Visible problems include lines, flickering, discoloration, dark areas, cracks affecting use, or intermittent image loss.

### Q5. Startup behavior

**How far does the laptop start?**

Answers:

- Reaches a usable sign-in, setup, or desktop screen
- Reaches firmware/BIOS only
- Reaches a recovery or error screen only — describe
- Stops at a disclosed activation, account, firmware, or organization lock
- Does not reach a usable screen
- Could not test

This remains separate from built-in display behavior. A laptop may display an image without reaching a usable system state.

### Q6. Built-in keyboard

**Did the built-in keyboard work during a brief normal check?**

Answers:

- Works for the keys I checked, with no known issue
- Has one or more known issues — describe
- Does not work
- Not applicable — no built-in keyboard by design
- Could not test

### Q7. Built-in pointing device

**Did the built-in trackpad or pointing device work during a brief normal check?**

Answers:

- Works with no known issue
- Has one or more known issues — describe
- Does not work
- Not applicable — none by design
- Could not test

### Q8. Power input and charging

**What happens when a compatible charger is connected?**

Answers:

- The laptop operates normally from external power
- External power works intermittently or only in a certain position — describe
- The laptop does not operate from external power
- No compatible charger was available
- Could not test for another reason

Follow-up disclosure:

**Is a compatible charger included with the listing?**

- Yes
- No

Charger inclusion is separate from whether the power input functions.

### Q9. Battery presence and operation

**Which statement best describes the installed battery?**

Answers:

- Present, charges, and powers the laptop with no known issue
- Present and powers the laptop, but performance is degraded — describe what you observed
- Present but does not power the laptop
- Present but does not charge
- Expected for this model but absent
- Not applicable by design or configuration — explain
- Could not test

Do not require a runtime estimate or battery-health software. The seller reports only what they observed.

### Q10. Optional enhanced checks

**Did you safely test any of these additional functions?**

For Wi-Fi, speakers/audio output, camera, and at least one USB port, select:

- Works with no known issue
- Has an issue — describe
- Does not work
- Not applicable
- Did not test

The interface must label this group `Optional additional checks`. `Did not test` does not by itself prevent `Fully functional`.

### Q11. Known abnormal or intermittent behavior

**During brief normal use, did you notice any of these issues? Select all that apply.**

- Unexpected shutdown or restart
- Unusual heat that did not trigger the safety stop
- Unusual fan, drive, electrical, or mechanical noise
- Evidence of past liquid exposure
- Intermittent behavior not already described
- Another known functional issue — describe
- None known
- Could not observe during testing

This question never instructs a seller to keep using an overheating device. If an answer suggests a hazardous battery or electrical condition, the safety flow takes precedence.

### Q12. Missing parts and included items

**Are any expected laptop parts missing?**

- No expected parts are known to be missing
- Yes — choose or describe: storage drive, memory, keyboard keys, bottom cover, screws, battery, or other
- Not sure

**What is included with the listing?**

Select and describe the laptop, charger, adapter, dock, bag, removable storage, or other supported accessories. Included items do not change condition unless their absence represents missing expected laptop functionality.

### Q13. Lock and management status

**Is the laptop restricted by an activation, account, firmware/BIOS, or organization-management lock?**

Answers:

- No known lock
- Activation or linked-account lock
- Firmware/BIOS password or lock
- Organization, school, or employer management
- Another restriction — describe
- Not sure

Lock status is prominently disclosed and handled under the locked-device eligibility policy. It is never used directly to raise or lower the condition label. When it prevents required testing, those checks remain `Could not test` and may cause `Untested/unknown`.

## 5. Deterministic derived-condition rules

Safety eligibility is evaluated before ordinary condition derivation.

```text
if hazardous_battery_suspected:
    stop testing
    route to deterministic rejection or ambiguous-safety human hold
else if testing conclusively shows no intended computing function:
    Not functional
else if required applicable testing is insufficient:
    Untested/unknown
else if any required applicable check fails
     or any tested optional check has a defect
     or an expected battery/component is absent or defective
     or another known functional defect exists:
    Functional with issues
else:
    Fully functional
```

### 5.1 Sufficient required testing

Testing is sufficient only when every applicable condition-required check has a conclusive answer:

- Power response
- Built-in display
- Startup behavior
- Built-in keyboard
- Built-in pointing device
- External-power operation

`Could not test`, `No compatible charger`, `Not sure`, or an unexplained `Not applicable` on any applicable required check makes required testing insufficient. Optional enhanced checks do not affect sufficiency when left untested.

A conclusive terminal failure is evaluated before this general sufficiency rule. For example, `Nothing happens` together with a conclusive failed external-power check can establish that the tested laptop performs no intended computing function; downstream display, startup, keyboard, and pointing-device checks do not need artificial answers. Likewise, observed power signs with no usable screen, system response, or input response may establish no intended computing function when the seller completed every safe check that could distinguish those outcomes. Ambiguous or incomplete observations still derive `Untested/unknown`.

### 5.2 Intended computing function

For this prototype, an intended computing function means the laptop reaches a usable system, setup, sign-in, firmware, recovery, or clearly disclosed locked screen with observable input or system response. Power lights, fan motion, charging indication, or a blank illuminated panel alone do not establish an intended computing function.

Lock status stays separate: a lock does not itself change condition. However, if the lock prevents enough applicable checks to make testing insufficient, the condition is `Untested/unknown`.

### 5.3 Battery examples

- Laptop works normally on external power; battery is expected but absent -> `Functional with issues`, with prominent `Battery absent` disclosure.
- Laptop works normally; battery operates but has observed degradation -> `Functional with issues`, with the observation shown.
- Laptop configuration genuinely has no applicable battery; all required applicable checks pass -> may be `Fully functional`.
- Laptop has a suspected swollen battery -> no ordinary condition; stop and route through the safety block/hold path.

## 6. Pre-publication explanation

The review step shows condition, source facts, separate safety/battery/lock disclosures, and correction links before the publish action.

```text
Condition derived from your answers

FUNCTIONAL WITH ISSUES

Why Halaga derived this:
✓ Powers on consistently
✓ Built-in display shows a clear, stable image
✓ Reaches a usable sign-in screen
✓ Keyboard and trackpad worked during your check
! Battery is present but does not power the laptop
! Camera was tested and does not work

Separate disclosures
Battery safety: No reported safety warning
Battery operation: Does not power the laptop
Lock status: No known lock
Testing coverage: All applicable required checks completed

This condition is based on the facts you provided. It is not a
professional diagnosis, repairability assessment, or price estimate.

[Change power answers]
[Change component answers]
[Change battery answer]
[Change lock answer]
```

Rules:

- Use text and icons, not color alone.
- Never merge battery safety, battery operation, or lock status into the condition label.
- Explain every failing fact that affected derivation.
- Explain which unanswered required check caused `Untested/unknown`.
- For `Not functional`, explain the observed facts supporting that no intended computing function was performed.
- Recompute immediately after an answer changes, but announce the new result without moving focus.
- The seller cannot override the result directly.

## 7. Prototype validation tasks

Test whether a non-technical seller can:

1. Stop safely when shown a suspected swollen battery scenario.
2. Distinguish power response, built-in display, and startup behavior.
3. Use `Could not test` without guessing.
4. Understand why optional Wi-Fi/audio/camera/USB tests are helpful but not required.
5. Distinguish a failed battery from a hazardous battery.
6. Understand that a disclosed lock is separate from condition.
7. Predict the derived label from the explanation.
8. Correct a source answer rather than trying to override the label.

English wording must be usability-tested before translation. The paired Cebuano/Bisaya version requires human language review for safety-critical meaning before pilot use.
