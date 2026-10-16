"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { readAndClearAccountEmailToken } from "../../domain/account-email-link";
import styles from "./account.module.css";

export type EmailFlow = "verify-email" | "forgot-password" | "reset-password" | "change-email" | "confirm-email-change";
const endpoints = {
  "verify-email": "verify-email", "forgot-password": "request-password-reset", "reset-password": "reset-password",
  "change-email": "change-email", "confirm-email-change": "confirm-email-change",
};
const success = {
  "verify-email": "Your email is verified. Sign in again to continue.",
  "forgot-password": "Request received. If eligible, you will receive an email. Sending may be delayed. Check that you used the latest link.",
  "reset-password": "Your password has been reset. Sign in again on each device.",
  "change-email": "Request received. If eligible, a confirmation will go to the proposed address. Your current address stays active until confirmation.",
  "confirm-email-change": "Your new email is verified and active. All sessions have ended. Sign in again using your new address.",
};

export function AccountEmailForm({ flow }: { flow: EmailFlow }) {
  const token = useRef<string | null>(null);
  const captured = useRef(false);
  const [linkState, setLinkState] = useState<"loading" | "ready" | "missing">("loading");
  const [status, setStatus] = useState<"idle" | "pending" | "complete" | "error">("idle");
  const [message, setMessage] = useState("");
  const feedback = useRef<HTMLParagraphElement>(null);
  const proof = ["verify-email", "reset-password", "confirm-email-change"].includes(flow);
  const resend = flow === "verify-email" && linkState === "missing";

  useEffect(() => {
    if (!captured.current) {
      captured.current = true;
      token.current = readAndClearAccountEmailToken(window.location, window.history);
      // Browser fragment is an external source, read only after hydration.
      setLinkState(token.current ? "ready" : "missing");
    }
    const forget = () => { token.current = null; setLinkState("missing"); };
    window.addEventListener("pagehide", forget);
    return () => window.removeEventListener("pagehide", forget);
  }, []);

  useEffect(() => { if (status === "error" || status === "complete") feedback.current?.focus(); }, [status]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "pending") return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const endpoint = resend ? "send-verification-email" : endpoints[flow];
    const body = resend || flow === "forgot-password" ? { email: data.get("email") } :
      flow === "change-email" ? { proposedEmail: data.get("proposedEmail") } :
      flow === "reset-password" ? { token: token.current, newPassword: data.get("newPassword") } : { token: token.current };
    setStatus("pending");
    setMessage("Submitting…");
    try {
      const response = await fetch(`/api/auth/${endpoint}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
        credentials: "same-origin", cache: "no-store", referrerPolicy: "no-referrer", redirect: "error",
      });
      if (!response.ok) {
        setStatus("error");
        setMessage(response.status === 429 ? "Too many requests. Wait before trying again." : response.status === 401 ?
          "Sign in again before requesting an email change." : response.status >= 500 ?
          "We could not complete this request. Try again." : proof && !resend ?
          "This link is invalid, expired or already used. Open the latest email or start a new request." :
          "We could not accept this request. Check the fields and try again.");
        return;
      }
      token.current = null;
      form.reset();
      setStatus("complete");
      setMessage(resend ? success["forgot-password"] : success[flow]);
    } catch {
      setStatus("error");
      setMessage("The response could not be confirmed. Try again. If the link was already used, sign in or start a new request.");
    }
  }

  if (proof && linkState === "loading") return <p role="status">Opening your link…</p>;
  const unavailable = proof && linkState === "missing" && !resend;
  return <>
    {unavailable && <p className={styles.notice}>Open the latest email link. Links expire and can be used once. Refreshing this page clears the link.</p>}
    {status !== "complete" && !unavailable && <form method="post" className={styles.form} onSubmit={submit} aria-busy={status === "pending"}>
      {(resend || flow === "forgot-password" || flow === "change-email") && <div className={styles.field}>
        <label htmlFor="email">{flow === "change-email" ? "New email" : "Email"} (required)</label>
        <input id="email" name={flow === "change-email" ? "proposedEmail" : "email"} type="email" autoComplete="email" required disabled={status === "pending"} />
      </div>}
      {flow === "reset-password" && <div className={styles.field}>
        <label htmlFor="newPassword">New password (required)</label>
        <p id="password-help" className={styles.hint}>Use 8–128 characters. You can paste a password or use your password manager.</p>
        <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128}
          required aria-describedby="password-help" disabled={status === "pending"} />
      </div>}
      <button type="submit" disabled={status === "pending"}>{status === "pending" ? "Submitting…" : resend ? "Resend verification email" :
        flow === "verify-email" ? "Verify email" : flow === "forgot-password" ? "Request password reset" :
        flow === "reset-password" ? "Reset password" : flow === "change-email" ? "Request email change" : "Verify new email"}</button>
    </form>}
    <p ref={feedback} tabIndex={-1} role={status === "error" ? "alert" : "status"} className={styles.feedback}>{message}</p>
    {flow === "reset-password" && <Link className={styles.back} href="/account/forgot-password">Request a new reset link</Link>}
  </>;
}
