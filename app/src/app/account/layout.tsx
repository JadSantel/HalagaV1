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
    <footer className={styles.footer}>Local testing only. Use made-up information.</footer>
  </div>;
}
