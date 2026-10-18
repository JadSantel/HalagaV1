import Link from "next/link";
import styles from "./account.module.css";
import { AccountEmailForm, type EmailFlow } from "./email-form";
import { AccountSignInForm } from "./sign-in-form";

// Fixed screen copy. Sign-in and email commands have forms; gated flows stay previews.
export const screens = {
  register: { title: "Create your account", action: "Create account", intro:
    "One account for buying and selling. You must be at least 18 years old to participate.",
    detail: "Your display name is public. Your email and date of birth are private. Age is self-declared; verifying email proves control of that address only." },
  "sign-in": { title: "Sign in", action: "Sign in", intro:
    "Sign in to manage your account.", detail: "You can sign in before verifying your email. Publishing, inquiries and offers require adult eligibility and verified email." },
  "verify-email": { title: "Verify your email", action: "Resend verification email", intro:
    "Verify your email before publishing a listing, sending an inquiry or making an offer.", detail:
    "Verification expires after 24 hours. A resend replaces the previous verification. After verification, sign in again." },
  "forgot-password": { title: "Forgot your password?", action: "Request password reset", intro:
    "Request help signing in to your account.", detail:
    "If the request is eligible, a password reset email will be sent. The response does not confirm whether an account exists." },
  "reset-password": { title: "Set a new password", action: "Reset password", intro:
    "Use your password reset email to continue.", detail:
    "A reset expires after one hour and can be used once. A new request replaces the previous reset. After resetting, sign in again on each device." },
  "change-email": { title: "Change your email", action: "Request email change", intro:
    "Sign in within the last 15 minutes to request an email change.", detail:
    "Your current verified email stays active until you verify the proposed address. Verification expires after 24 hours. A later request replaces the previous change." },
  "confirm-email-change": { title: "Verify your new email", action: "Verify new email", intro:
    "Use the verification email sent to your proposed address to continue.", detail:
    "After verification, your new address becomes primary and verified. All sessions end. Sign in again using your new address. A security notice goes to your old address. An expired or failed attempt leaves your current address active." },
  "change-password": { title: "Change your password", action: "Change password", intro:
    "Sign in within the last 15 minutes and enter your current password to change it.", detail:
    "After changing your password, this session stays signed in. All your other sessions end. Staying signed in longer does not renew the 15-minute requirement." },
} as const;

export type AccountScreenName = keyof typeof screens;

function Field({ name, label, type, autoComplete, description }: {
  name: string; label: string; type: string; autoComplete: string; description?: string;
}) {
  return <div className={styles.field}>
    <label htmlFor={name}>{label} <span>(required)</span></label>
    {description && <p id={`${name}-help`} className={styles.hint}>{description}</p>}
    <input id={name} name={name} type={type} autoComplete={autoComplete} required disabled
      aria-describedby={description ? `${name}-help` : undefined} />
  </div>;
}

export function AccountScreen({ name }: { name: AccountScreenName }) {
  const screen = screens[name];
  const email = ["register", "sign-in", "verify-email", "forgot-password"].includes(name);
  const newPassword = ["register", "reset-password", "change-password"].includes(name);
  const emailFlow = ["verify-email", "forgot-password", "reset-password", "change-email", "confirm-email-change"].includes(name);
  return <>
    <Link className={styles.back} href="/account">All account screens</Link>
    <p className={styles.eyebrow}>Your Halaga account</p>
    <h1>{screen.title}</h1>
    <p className={styles.intro}>{screen.intro}</p>
    {name === "sign-in" ? <AccountSignInForm /> : emailFlow ? <AccountEmailForm key={name} flow={name as EmailFlow} /> : <><aside id="availability" className={styles.notice} aria-label="Availability">
      <strong>This action is not available yet.</strong>
      <p>This is a local screen preview. Fields and submission are disabled; no information is collected or email sent.</p>
    </aside>
    <form method="post" aria-describedby="availability" className={styles.form}>
      {name === "register" && <Field name="displayName" label="Display name" type="text" autoComplete="nickname" />}
      {email && <Field name="email" label="Email" type="email" autoComplete="email" />}
      {name === "change-email" && <Field name="proposedEmail" label="New email" type="email" autoComplete="email" />}
      {["sign-in", "change-password"].includes(name) && <Field name="currentPassword" label="Current password" type="password" autoComplete="current-password" />}
      {newPassword && <Field name={name === "register" ? "password" : "newPassword"} label={name === "register" ? "Password" : "New password"} type="password" autoComplete="new-password" description="You can paste a password or use your password manager." />}
      {name === "register" && <>
        <Field name="dateOfBirth" label="Date of birth" type="date" autoComplete="bday" description="Private. Used to check that you are at least 18 years old." />
        <div className={styles.attestation}>
          <input id="adultAttestationAccepted" name="adultAttestationAccepted" type="checkbox" required disabled />
          <label htmlFor="adultAttestationAccepted">I confirm that I am at least 18 years old and eligible to participate in Halaga.</label>
        </div>
        <p className={styles.hint}>Terms and privacy information will be available before registration opens.</p>
      </>}
      <button type="submit" disabled aria-describedby="availability">{screen.action}</button>
    </form></>}
    <section className={styles.explanation} aria-label="What to expect"><p>{screen.detail}</p></section>
    <nav aria-label="Related account screens" className={styles.links}>
      {name !== "sign-in" && <Link href="/account/sign-in">Sign in</Link>}
      {name === "sign-in" && <><Link href="/account/register">Create account</Link><Link href="/account/forgot-password">Forgot password?</Link></>}
      {["verify-email", "reset-password", "confirm-email-change"].includes(name) &&
        <Link href={name === "reset-password" ? "/account/forgot-password" : name === "confirm-email-change" ? "/account/change-email" : "/account/register"}>Start a new request</Link>}
    </nav>
  </>;
}
