import Link from "next/link";
import styles from "../account.module.css";
import { PasswordChangeSecurityNotices } from "../security-notices";

export const metadata = {
  title: "Account security · Halaga local preview",
  description: "View private password-change security notices.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function AccountSecurityPage() {
  return <>
    <Link className={styles.back} href="/account">All account screens</Link>
    <p className={styles.eyebrow}>Your Halaga account</p>
    <h1>Account security</h1>
    <p className={styles.intro}>Review recent password-change notices for this account.</p>
    <PasswordChangeSecurityNotices />
  </>;
}
