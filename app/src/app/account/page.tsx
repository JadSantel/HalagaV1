import Link from "next/link";
import { screens } from "./screens";
import styles from "./account.module.css";

export default function AccountPreviewPage() {
  return <>
    <p className={styles.eyebrow}>Local screen preview</p>
    <h1>Your Halaga account</h1>
    <p className={styles.intro}>Preview account creation, email verification and sign-in help.</p>
    <p className={styles.notice}>Account actions are not available yet. These screens collect no information.</p>
    <nav aria-label="Account screens" className={styles.directory}>
      {Object.entries(screens).map(([name, screen]) => <Link key={name} href={`/account/${name}`}>{screen.title}<span aria-hidden="true"> →</span></Link>)}
    </nav>
    <Link className={styles.back} href="/">Return to laptop practice</Link>
  </>;
}
