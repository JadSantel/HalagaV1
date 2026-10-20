"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import styles from "./account.module.css";

type FieldName = "currentPassword" | "newPassword";
type Feedback = {
  kind: "idle" | "pending" | "success" | "error";
  message: string;
  fields?: Partial<Record<FieldName, string>>;
  signIn?: boolean;
};
const inputs = [
  { name: "currentPassword", label: "Current password", autoComplete: "current-password" },
  { name: "newPassword", label: "New password", autoComplete: "new-password" },
] as const;
const uncertain = "The password-change result could not be confirmed. Your password may already have changed. Do not automatically repeat this request. Sign in with your new password to check, or use password reset if you cannot sign in.";

export function AccountPasswordChangeForm() {
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle", message: "" });
  const summary = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const submitting = useRef(false);
  const pending = feedback.kind === "pending";

  useEffect(() => {
    if (feedback.kind === "error" || feedback.kind === "success") summary.current?.focus();
  }, [feedback]);

  useEffect(() => {
    const form = formRef.current;
    const clear = () => form?.reset();
    window.addEventListener("pagehide", clear);
    return () => { clear(); window.removeEventListener("pagehide", clear); };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const control = (name: FieldName) => form.elements.namedItem(name) as HTMLInputElement;
    const fields: Feedback["fields"] = {};
    for (const input of inputs) {
      const value = control(input.name).value;
      if (!value) fields[input.name] = `Enter your ${input.label.toLowerCase()}.`;
      else if (value.length > 128 || (input.name === "newPassword" && value.length < 8)) {
        fields[input.name] = input.name === "newPassword" ? "Use a password with 8 to 128 characters." : "Use at most 128 characters.";
      }
    }
    if (Object.keys(fields).length) {
      setFeedback({ kind: "error", message: "Check the highlighted fields.", fields });
      return;
    }
    submitting.current = true;
    setFeedback({ kind: "pending", message: "Changing password…" });
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: control("currentPassword").value, newPassword: control("newPassword").value }),
        credentials: "same-origin", cache: "no-store", referrerPolicy: "no-referrer", redirect: "error",
      });
      if (response.status === 200) {
        const result: unknown = await response.json();
        if (!result || typeof result !== "object" || !("status" in result) || result.status !== "PASSWORD_CHANGED") {
          setFeedback({ kind: "error", message: uncertain, signIn: true });
          return;
        }
        setFeedback({ kind: "success", message: "Password changed. This session stayed signed in. Your other sessions were signed out at the time of the change." });
        return;
      }
      setFeedback({ kind: "error", signIn: response.status === 401 || response.status === 403 || response.status >= 500,
        message: response.status === 400 ? "Password change was not accepted. Check your current password and use 8 to 128 characters for your new password." :
          response.status === 401 || response.status === 403 ? "Sign in again at Halaga’s configured address, then change your password within 15 minutes. This request may also have been rejected for security reasons." :
          response.status === 429 ? "Too many password-change attempts. Wait before trying again. People sharing your connection share this limit." : uncertain });
    } catch {
      setFeedback({ kind: "error", message: uncertain, signIn: true });
    } finally {
      form.reset();
      submitting.current = false;
    }
  }

  return <>
    <form ref={formRef} method="post" className={styles.form} onSubmit={submit} noValidate aria-busy={pending}>
      {inputs.map((input) => <div key={input.name} className={styles.field}>
        <label htmlFor={input.name}>{input.label} (required)</label>
        <p id={`${input.name}-help`} className={styles.hint}>
          {input.name === "newPassword" ? "Use 8 to 128 characters. " : ""}You can paste a password or use your password manager.
        </p>
        <input id={input.name} name={input.name} type="password" autoComplete={input.autoComplete} required readOnly={pending}
          aria-invalid={Boolean(feedback.fields?.[input.name])}
          aria-describedby={`${input.name}-help${feedback.fields?.[input.name] ? ` ${input.name}-error` : ""}`} />
        {feedback.fields?.[input.name] && <p id={`${input.name}-error`} className={styles.hint}>{feedback.fields[input.name]}</p>}
      </div>)}
      <button type="submit" disabled={pending}>{pending ? "Changing password…" : "Change password"}</button>
    </form>
    <div ref={summary} tabIndex={-1} role={feedback.kind === "error" ? "alert" : "status"}
      aria-atomic="true" className={styles.feedback}>
      <p>{feedback.message}</p>
      {feedback.fields && <ul>{inputs.map((input) => feedback.fields?.[input.name] &&
        <li key={input.name}><a href={`#${input.name}`}>{feedback.fields[input.name]}</a></li>)}</ul>}
      {feedback.signIn && <p><Link href="/account/sign-in">Sign in again</Link>{" · "}<Link href="/account/forgot-password">Reset password</Link></p>}
    </div>
  </>;
}
