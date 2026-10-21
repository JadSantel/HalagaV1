import Link from "next/link";
import { accountPolicyContact, accountPolicyDrafts } from "./policy-content";
import styles from "./account.module.css";

export function AccountPolicyDocument({ name }: { name: keyof typeof accountPolicyDrafts }) {
  const document = accountPolicyDrafts[name];
  return <article className={styles.policy}>
    <Link className={styles.back} href="/account/register">Return to registration</Link>
    <h1>{document.title} — review draft</h1>
    <aside className={styles.policyNotice} aria-label="Draft status">
      <strong>For review only. Not approved for real registration.</strong>
      <p>Team/brand: {accountPolicyContact.teamBrand}. Support and privacy contact: {accountPolicyContact.supportAndPrivacyEmail}.</p>
      <p>Legal operator identity, correspondence address and privacy-request responsibility remain unresolved. No effective date has been set. Use made-up information only.</p>
    </aside>
    <p className={styles.hint}>Draft version: {document.version}</p>
    <nav aria-label={`${document.title} contents`}>
      <ul>{document.sections.map((section) => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ul>
    </nav>
    {document.sections.map((section) => <section key={section.id} aria-labelledby={section.id}>
      <h2 id={section.id} tabIndex={-1}>{section.title}</h2>
      {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
    </section>)}
    <nav aria-label="Account documents" className={styles.links}>
      <Link href={name === "terms" ? "/account/privacy" : "/account/terms"}>
        {name === "terms" ? "Privacy Notice draft" : "Terms of Use draft"}
      </Link>
      <Link href="/account">Account screens</Link>
    </nav>
  </article>;
}
