"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import styles from "./account.module.css";

type Feedback = {
  kind: "idle" | "pending" | "success" | "error";
  message: string;
  fields?: { email?: string; password?: string };
};
const uncertain = "The sign-in result could not be confirmed. You may already be signed in. Try signing in again to confirm.";

export function AccountSignInForm() {
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
    const email = form.elements.namedItem("email") as HTMLInputElement;
    const password = form.elements.namedItem("password") as HTMLInputElement;
    const fields = {
      email: email.validity.valueMissing ? "Enter your email address." : !email.validity.valid ? "Enter a valid email address." : undefined,
      password: password.validity.valueMissing ? "Enter your password." : undefined,
    };
    if (fields.email || fields.password) {
      setFeedback({ kind: "error", message: "Check the highlighted fields.", fields });
      return;
    }
    submitting.current = true;
    setFeedback({ kind: "pending", message: "Signing in…" });
    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.value, password: password.value }),
        credentials: "same-origin", cache: "no-store", referrerPolicy: "no-referrer", redirect: "error",
      });
      if (response.status === 200) {
        const result: unknown = await response.json();
        if (!result || typeof result !== "object" || !("status" in result) || result.status !== "SIGNED_IN") {
          setFeedback({ kind: "error", message: uncertain });
          return;
        }
        form.reset();
        setFeedback({ kind: "success", message: "Sign-in completed. You can stay on this screen. Publishing, inquiries and offers still require adult eligibility and verified email." });
        return;
      }
      setFeedback({ kind: "error", message: response.status === 401 ?
        "Email or password was not accepted. Check both and try again." : response.status === 429 ?
        "Too many sign-in attempts. Wait before trying again. People sharing your connection share this limit." : response.status === 400 ?
        "Check your email and password and try again." : response.status === 403 ?
        "This sign-in request was not accepted. Open Halaga directly at its configured address and try again." : uncertain });
    } catch {
      setFeedback({ kind: "error", message: uncertain });
    } finally {
      password.value = "";
      submitting.current = false;
    }
  }

  return <>
    {/* A full navigation obtains a fresh private workspace after sign-in. */}
    {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
    <p><a href="/drafts" className={styles.back}>Open your private laptop drafts</a></p>
    <form method="post" className={styles.form} onSubmit={submit} noValidate aria-busy={pending}>
      <div className={styles.field}>
        <label htmlFor="email">Email (required)</label>
        <input id="email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false}
          required readOnly={pending} aria-invalid={Boolean(feedback.fields?.email)}
          aria-describedby={feedback.fields?.email ? "email-error" : undefined} />
        {feedback.fields?.email && <p id="email-error" className={styles.hint}>{feedback.fields.email}</p>}
      </div>
      <div className={styles.field}>
        <label htmlFor="password">Password (required)</label>
        <p id="password-help" className={styles.hint}>You can paste a password or use your password manager.</p>
        <input id="password" name="password" type="password" autoComplete="current-password" required readOnly={pending}
          aria-invalid={Boolean(feedback.fields?.password)}
          aria-describedby={`password-help${feedback.fields?.password ? " password-error" : ""}`} />
        {feedback.fields?.password && <p id="password-error" className={styles.hint}>{feedback.fields.password}</p>}
      </div>
      <button type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
    <div ref={summary} tabIndex={-1} role={feedback.kind === "error" ? "alert" : "status"}
      aria-atomic="true" className={styles.feedback}>
      <p>{feedback.message}</p>
      {feedback.fields && <ul>
        {feedback.fields.email && <li><a href="#email">{feedback.fields.email}</a></li>}
        {feedback.fields.password && <li><a href="#password">{feedback.fields.password}</a></li>}
      </ul>}
    </div>
  </>;
}
