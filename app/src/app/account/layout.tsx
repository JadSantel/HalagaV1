import type { Metadata } from "next";
import Link from "next/link";
import styles from "./account.module.css";

export const metadata: Metadata = {
  title: "Account · Halaga local preview",
  description: "Preview Halaga account screens using synthetic data only.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.shell}>
    <a className={styles.skip} href="#account-content">Skip to content</a>
    <header className={styles.header}>
      <Link className={styles.brand} href="/account">Halaga</Link>
      <span>Local account preview</span>
    </header>
    <main id="account-content" className={styles.main}>{children}</main>
    <footer className={styles.footer}>
      <p>Local testing only. Use made-up information.</p>
      <nav aria-label="Account documents" className={styles.links}>
        <Link href="/account/terms">Terms of Use draft</Link>
        <Link href="/account/privacy">Privacy Notice draft</Link>
      </nav>
    </footer>
  </div>;
}
