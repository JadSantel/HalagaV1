"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import styles from "./account.module.css";

const inputs = [
  { name: "displayName", label: "Display name", type: "text", autoComplete: "nickname",
    hint: "Choose a display name. It will be public; you do not need to use your legal name." },
  { name: "email", label: "Email", type: "email", autoComplete: "email", hint: "Your email is private." },
  { name: "password", label: "Password", type: "password", autoComplete: "new-password",
    hint: "Use 8 to 128 characters. You can paste a password or use your password manager." },
  { name: "dateOfBirth", label: "Date of birth", type: "date", autoComplete: "bday",
    hint: "Private. Used to check that you are at least 18 years old." },
] as const;
type FieldName = typeof inputs[number]["name"] | "adultAttestationAccepted";
type Feedback = {
  kind: "idle" | "pending" | "success" | "error";
  message: string;
  fields?: Partial<Record<FieldName, string>>;
};
const uncertain = "The signup result could not be confirmed. Try again with the same details. This response does not confirm whether an account exists.";

export function AccountSignupForm() {
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle", message: "" });
  const summary = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);
  const pending = feedback.kind === "pending";

  useEffect(() => {
    if (feedback.kind === "error" || feedback.kind === "success") summary.current?.focus();
  }, [feedback]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const control = (name: FieldName) => form.elements.namedItem(name) as HTMLInputElement;
    const fields: Feedback["fields"] = {};
    for (const input of inputs) {
      const field = control(input.name);
      if (input.name === "displayName" ? !field.value.trim() : !field.value) fields[input.name] = `Enter your ${input.label.toLowerCase()}.`;
      else if (input.name === "password" && (field.value.length < 8 || field.value.length > 128)) {
        fields.password = "Use a password with 8 to 128 characters.";
      } else if (!field.validity.valid) fields[input.name] = `Enter a valid ${input.label.toLowerCase()}.`;
    }
    if (!control("adultAttestationAccepted").checked) {
      fields.adultAttestationAccepted = "Confirm adult eligibility to continue.";
    }
    if (Object.keys(fields).length) {
      setFeedback({ kind: "error", message: "Check the highlighted fields.", fields });
      return;
    }
    submitting.current = true;
    setFeedback({ kind: "pending", message: "Submitting signup…" });
    try {
      const response = await fetch("/api/auth/sign-up/email", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: control("displayName").value, email: control("email").value,
          password: control("password").value, dateOfBirth: control("dateOfBirth").value,
          adultAttestationAccepted: control("adultAttestationAccepted").checked }),
        credentials: "same-origin", cache: "no-store", referrerPolicy: "no-referrer", redirect: "error",
      });
      if (response.status === 200) {
        const result: unknown = await response.json();
        if (!result || typeof result !== "object" || !("status" in result) || result.status !== "REQUEST_RECEIVED") {
          setFeedback({ kind: "error", message: uncertain });
          return;
        }
        form.reset();
        setFeedback({ kind: "success", message: "Request received. This does not confirm whether an account exists. Signup does not sign you in. Email sending is disabled for this local synthetic test." });
        return;
      }
      setFeedback({ kind: "error", message: response.status === 429 ?
        "Too many signup attempts. Wait before trying again. People sharing your connection share this limit." : response.status === 400 ?
        "Check all fields and try again. Your date of birth must establish age 18 or older, and you must confirm adult eligibility." : response.status === 403 ?
        "This signup request was not accepted. Open Halaga directly at its configured address and try again." : uncertain });
    } catch {
      setFeedback({ kind: "error", message: uncertain });
    } finally {
      control("password").value = "";
      submitting.current = false;
    }
  }

  return <>
    <aside className={styles.notice} aria-label="Local testing only">
      <strong>Use made-up information only.</strong>
      <p>Local synthetic signup only. Email sending is disabled. Terms and privacy content and launch readiness remain incomplete.</p>
    </aside>
    <noscript>JavaScript is required for this local signup form.</noscript>
    <form method="post" className={styles.form} onSubmit={submit} noValidate aria-busy={pending}>
      {inputs.map((input) => <div className={styles.field} key={input.name}>
        <label htmlFor={input.name}>{input.label} (required)</label>
        <p id={`${input.name}-help`} className={styles.hint}>{input.hint}</p>
        <input id={input.name} name={input.name} type={input.type} autoComplete={input.autoComplete}
          autoCapitalize={input.name === "email" ? "none" : undefined} spellCheck={input.name === "email" ? false : undefined}
          minLength={input.name === "password" ? 8 : undefined} maxLength={input.name === "password" ? 128 : undefined}
          required readOnly={pending} aria-invalid={Boolean(feedback.fields?.[input.name])}
          aria-describedby={`${input.name}-help${feedback.fields?.[input.name] ? ` ${input.name}-error` : ""}`} />
        {feedback.fields?.[input.name] && <p id={`${input.name}-error`} className={styles.hint}>{feedback.fields[input.name]}</p>}
      </div>)}
      <div>
        <div className={styles.attestation}>
          <input id="adultAttestationAccepted" name="adultAttestationAccepted" type="checkbox" required disabled={pending}
            aria-invalid={Boolean(feedback.fields?.adultAttestationAccepted)}
            aria-describedby={feedback.fields?.adultAttestationAccepted ? "adultAttestationAccepted-error" : undefined} />
          <label htmlFor="adultAttestationAccepted">I confirm that I am at least 18 years old and eligible to participate in Halaga.</label>
        </div>
        {feedback.fields?.adultAttestationAccepted && <p id="adultAttestationAccepted-error" className={styles.hint}>{feedback.fields.adultAttestationAccepted}</p>}
      </div>
      <button type="submit" disabled={pending}>{pending ? "Submitting signup…" : "Create account"}</button>
    </form>
    <div ref={summary} tabIndex={-1} role={feedback.kind === "error" ? "alert" : "status"}
      aria-atomic="true" className={styles.feedback}>
      <p>{feedback.message}</p>
      {feedback.fields && <ul>{Object.entries(feedback.fields).map(([name, message]) =>
        <li key={name}><a href={`#${name}`}>{message}</a></li>)}</ul>}
    </div>
  </>;
}
