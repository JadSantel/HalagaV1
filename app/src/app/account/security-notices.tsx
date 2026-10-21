"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./account.module.css";

type Notice = Readonly<{
  id: string;
  eventType: "account.password-changed";
  eventVersion: 1;
  createdAt: string;
  readAt: string | null;
}>;

type LoadState = "loading" | "signed-out" | "ready" | "error";
type LoadResult = Readonly<{ state: "signed-out" }> | Readonly<{ state: "ready"; notices: readonly Notice[] }> |
  Readonly<{ state: "error" }>;

function loadMessage(result: LoadResult) {
  if (result.state === "signed-out") return "You are signed out.";
  if (result.state === "error") return "We could not load your security notices.";
  return result.notices.length === 0 ? "No recent password-change notices." :
    `${result.notices.length} password-change ${result.notices.length === 1 ? "notice" : "notices"} loaded.`;
}

function isNotice(value: unknown): value is Notice {
  if (!value || typeof value !== "object") return false;
  const notice = value as Partial<Notice>;
  return typeof notice.id === "string" && notice.eventType === "account.password-changed" &&
    notice.eventVersion === 1 && typeof notice.createdAt === "string" && Number.isFinite(Date.parse(notice.createdAt)) &&
    (notice.readAt === null || (typeof notice.readAt === "string" && Number.isFinite(Date.parse(notice.readAt))));
}

function formatPht(value: string) {
  return `${new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", day: "2-digit", month: "short",
    year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
    .format(new Date(value))} PHT (UTC+08:00)`;
}

async function requestNotices(signal?: AbortSignal): Promise<LoadResult> {
  try {
    const response = await fetch("/api/account/security-notices", {
      credentials: "same-origin", cache: "no-store", signal,
      headers: { accept: "application/json" },
    });
    if (response.status === 401) return { state: "signed-out" };
    if (!response.ok) return { state: "error" };
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !Array.isArray((payload as { notices?: unknown }).notices) ||
        !(payload as { notices: unknown[] }).notices.every(isNotice)) return { state: "error" };
    return { state: "ready", notices: (payload as { notices: Notice[] }).notices };
  } catch {
    return { state: "error" };
  }
}

export function PasswordChangeSecurityNotices() {
  const [notices, setNotices] = useState<readonly Notice[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function load(signal?: AbortSignal) {
    const result = await requestNotices(signal);
    if (signal?.aborted) return;
    setMessage(loadMessage(result));
    if (result.state === "signed-out") setNotices([]);
    else if (result.state === "ready") setNotices(result.notices);
    setState(result.state);
  }

  useEffect(() => {
    const controller = new AbortController();
    void requestNotices(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setMessage(loadMessage(result));
      if (result.state === "signed-out") setNotices([]);
      else if (result.state === "ready") setNotices(result.notices);
      setState(result.state);
    });
    return () => controller.abort();
  }, []);

  async function markRead(noticeId: string) {
    setPendingId(noticeId);
    setMessage("");
    try {
      const response = await fetch(`/api/account/security-notices/${encodeURIComponent(noticeId)}/read`, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { accept: "application/json", "content-type": "application/json" }, body: "{}",
      });
      if (response.status === 401) {
        setNotices([]);
        setState("signed-out");
        setMessage("Your session ended. Sign in to view your security notices.");
        return;
      }
      if (response.status === 404) {
        setState("loading");
        await load();
        setMessage("That notice is no longer available.");
        return;
      }
      if (!response.ok) throw new Error("READ_FAILED");
      const result: unknown = await response.json();
      if (!result || typeof result !== "object" || (result as { status?: unknown }).status !== "NOTICE_READ" ||
          typeof (result as { readAt?: unknown }).readAt !== "string") throw new Error("READ_FAILED");
      const readAt = (result as { readAt: string }).readAt;
      setNotices((current) => current.map((notice) => notice.id === noticeId ? { ...notice, readAt } : notice));
      setMessage("Notice marked as read.");
    } catch {
      setMessage("We could not update the notice. Try again.");
    } finally {
      setPendingId(null);
    }
  }

  return <section aria-labelledby="security-notices-heading">
    <h2 id="security-notices-heading">Password-change notices</h2>
    <p className={styles.explanation}>Recent security notices stay available for 90 days from the password change.</p>
    <p className={styles.liveStatus} role="status" aria-live="polite">
      {state === "loading" ? "Loading security notices…" : message}
    </p>
    {state === "signed-out" && <p>You are signed out. <Link href="/account/sign-in">Sign in</Link> to view your security notices.</p>}
    {state === "error" && <p role="alert">We could not load your security notices. <button type="button" onClick={() => {
      setState("loading");
      setMessage("");
      void load();
    }}>Try again</button></p>}
    {state === "ready" && notices.length > 0 && <ol className={styles.noticeList}>
      {notices.map((notice) => {
        const timestamp = formatPht(notice.createdAt);
        const unread = notice.readAt === null;
        return <li key={notice.id} className={styles.noticeCard}>
          <div className={styles.noticeHeading}>
            <h3>Password changed</h3>
            <span>{unread ? "Unread" : "Read"}</span>
          </div>
          <p>The password for your Halaga account changed on <time dateTime={notice.createdAt}>{timestamp}</time>.</p>
          <p>At that time, other sessions were signed out. The session used for this change remained signed in.</p>
          <p>If you did not expect this change, open Halaga directly and use the password reset option.</p>
          {unread && <button type="button" aria-label={`Mark password-change notice from ${timestamp} as read`}
            disabled={pendingId !== null} onClick={() => void markRead(notice.id)}>
            {pendingId === notice.id ? "Updating…" : "Mark as read"}
          </button>}
        </li>;
      })}
    </ol>}
  </section>;
}
