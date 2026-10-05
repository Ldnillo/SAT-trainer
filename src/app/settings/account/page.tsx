import type { Metadata } from "next";
import Link from "next/link";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { requireUser } from "@/lib/auth/session";
import { siteConfig } from "@/lib/site";
import { removeAccount, signOut, startEmailChange, updatePassword, updateProfileName } from "../../auth-actions";
import styles from "./account.module.css";

export const metadata: Metadata = { title: "Account settings" };

const ERRORS: Record<string, string> = {
  "wrong-password": "Your current password isn't right.",
  mismatch: "The two new passwords don't match.",
  "short-password": `Use a new password of at least ${MIN_PASSWORD_LENGTH} characters.`,
  "missing-name": "Enter a name.",
  "long-name": "That name is too long.",
  "invalid-email": "That doesn't look like an email address.",
  "same-email": "That's already your email.",
  "email-taken": "That email already has a NextScore account.",
  "email-link": "That confirmation link has expired or was already used. Ask for a new one below.",
  "too-many": "Too many tries. Please wait a while and try again.",
  "delete-confirm": "Type your account's email exactly to confirm deleting it.",
  "delete-password": "That password isn't right, so your account wasn't deleted.",
};

export default async function AccountPage({ searchParams }: PageProps<"/settings/account">) {
  const params = await searchParams;
  const user = await requireUser("/settings/account");
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const { supportEmail } = siteConfig();

  return (
    <>
      {error && <p className={styles.error}>{error}</p>}
      {params.notice === "password-changed" && (
        <p className={styles.notice}>Password changed. You&apos;ve been signed out on your other devices.</p>
      )}

      {params.notice === "name-changed" && <p className={styles.notice}>Name updated.</p>}
      {params.notice === "email-changed" && <p className={styles.notice}>Email changed. Use it to sign in from now on.</p>}
      {params.notice === "email-sent" && (
        <p className={styles.notice}>
          We sent a confirmation link to {typeof params.to === "string" ? params.to : "your new address"}. Your email
          changes once you open it.
        </p>
      )}

      <section className={`${styles.section} surface`}>
        <h2>Your details</h2>
        <p>
          {user.name}
          <br />
          <span className={styles.muted}>{user.email}</span>
        </p>
        <p className={styles.muted}>
          Your season pass is on the <Link href="/pass">season pass page</Link>. Need something else? Write to{" "}
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
        </p>
        <form action={signOut}>
          <button type="submit" className="button secondary">
            Sign out
          </button>
        </form>
      </section>

      <section className={`${styles.section} surface`}>
        <h2>Change name</h2>
        <form action={updateProfileName} className={styles.form}>
          <label>
            Name
            <input type="text" name="name" defaultValue={user.name} autoComplete="name" maxLength={100} required />
          </label>
          <button type="submit" className="button">
            Save name
          </button>
        </form>
      </section>

      <section className={`${styles.section} surface`}>
        <h2>Change email</h2>
        <p className={styles.muted}>
          We&apos;ll send a link to the new address. Your email only changes once you open it, and we&apos;ll let your old
          address know.
        </p>
        <form action={startEmailChange} className={styles.form}>
          <label>
            New email
            <input type="email" name="email" autoComplete="email" required />
          </label>
          <label>
            Current password
            <input type="password" name="password" autoComplete="current-password" required />
          </label>
          <button type="submit" className="button">
            Send confirmation link
          </button>
        </form>
      </section>

      <section className={`${styles.section} surface`}>
        <h2>Change password</h2>
        <form action={updatePassword} className={styles.form}>
          <label>
            Current password
            <input type="password" name="current" autoComplete="current-password" required />
          </label>
          <label>
            New password
            <input type="password" name="next" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required />
          </label>
          <label>
            Type the new password again
            <input type="password" name="confirm" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required />
          </label>
          <button type="submit" className="button">
            Change password
          </button>
        </form>
      </section>

      <section className={`${styles.section} surface`}>
        <h2>Your data</h2>
        <p className={styles.muted}>
          Download everything NextScore stores about you: your account details, practice sets, practice tests, answers, score reports and season passes.
          See the <Link href="/privacy">privacy policy</Link> for how it&apos;s used.
        </p>
        {/* A plain link: the route sends a file download, which client-side navigation can't do. */}
        <a href="/settings/account/export" className="button secondary" download>
          Download my data
        </a>
      </section>

      <section className={`${styles.section} ${styles.danger} surface`}>
        <h2>Delete account</h2>
        <p className={styles.muted}>
          This permanently deletes your account, practice history and scores. It can&apos;t be undone, and any time left
          on a season pass is lost. Payment records kept by our payment processor, Stripe, aren&apos;t affected.
        </p>
        <form action={removeAccount} className={styles.form}>
          <label>
            Type your email to confirm
            <input type="email" name="confirm-email" autoComplete="off" required />
          </label>
          <label>
            Password
            <input type="password" name="password" autoComplete="current-password" required />
          </label>
          <button type="submit" className={`button ${styles.dangerButton}`}>
            Delete my account
          </button>
        </form>
      </section>
    </>
  );
}
