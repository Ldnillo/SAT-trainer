import type { Metadata } from "next";
import Link from "next/link";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { requireUser } from "@/lib/auth/session";
import { siteConfig } from "@/lib/site";
import { removeAccount, updatePassword } from "../auth-actions";
import styles from "./account.module.css";

export const metadata: Metadata = { title: "Account" };

const ERRORS: Record<string, string> = {
  "wrong-password": "Your current password isn't right.",
  mismatch: "The two new passwords don't match.",
  "short-password": `Use a new password of at least ${MIN_PASSWORD_LENGTH} characters.`,
  "delete-confirm": "Type your account's email exactly to confirm deleting it.",
  "delete-password": "That password isn't right, so your account wasn't deleted.",
};

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const params = await searchParams;
  const user = await requireUser("/account");
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const { supportEmail } = siteConfig();

  return (
    <main className={styles.page}>
      <h1>Account</h1>
      {error && <p className={styles.error}>{error}</p>}
      {params.notice === "password-changed" && (
        <p className={styles.notice}>Password changed. You&apos;ve been signed out on your other devices.</p>
      )}

      <section className={`${styles.section} surface`}>
        <h2>Your details</h2>
        <p>
          {user.name}
          <br />
          <span className={styles.muted}>{user.email}</span>
        </p>
        <p className={styles.muted}>
          To change your name or email, write to <a href={`mailto:${supportEmail}`}>{supportEmail}</a>. Your season pass
          is on the <Link href="/pass">season pass page</Link>.
        </p>
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
          Download everything NextScore stores about you: your account details, practice sets, answers and season passes.
          See the <Link href="/privacy">privacy policy</Link> for how it&apos;s used.
        </p>
        {/* A plain link: the route sends a file download, which client-side navigation can't do. */}
        <a href="/account/export" className="button secondary" download>
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
    </main>
  );
}
