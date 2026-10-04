import type { Metadata } from "next";
import Link from "next/link";
import { RESET_MINUTES } from "@/lib/auth/reset";
import { requestPasswordReset } from "../auth-actions";
import styles from "../auth.module.css";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  const params = await searchParams;
  return (
    <main className={styles.page}>
      <div className={`${styles.card} surface`}>
        <h1>Reset your password</h1>
        {params.sent ? (
          <>
            <p>
              If there&apos;s a NextScore account with that email, we&apos;ve sent it a link to choose a new password. The
              link works for {RESET_MINUTES} minutes.
            </p>
            <p className={styles.muted}>No email? Check your spam folder, or wait a minute and try again.</p>
          </>
        ) : (
          <>
            {params.error === "too-many" && (
              <p className={styles.error}>Too many reset requests. Please wait an hour and try again.</p>
            )}
            <p className={styles.muted}>Enter the email you signed up with and we&apos;ll send you a reset link.</p>
            <form action={requestPasswordReset} className={styles.form}>
              <label>
                Email
                <input type="email" name="email" autoComplete="email" required />
              </label>
              <button type="submit" className="button">
                Send reset link
              </button>
            </form>
          </>
        )}
        <p className={styles.muted}>
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
