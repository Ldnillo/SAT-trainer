import type { Metadata } from "next";
import Link from "next/link";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { userForResetToken } from "@/lib/auth/reset";
import { getDb } from "@/lib/db/client";
import { completePasswordReset } from "../auth-actions";
import styles from "../auth.module.css";

export const metadata: Metadata = { title: "Choose a new password" };

const ERRORS: Record<string, string> = {
  mismatch: "The two passwords don't match.",
  "short-password": `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`,
};

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const user = token ? await userForResetToken(await getDb(), token) : undefined;
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;

  return (
    <main className={styles.page}>
      <div className={`${styles.card} surface`}>
        <h1>Choose a new password</h1>
        {user ? (
          <>
            {error && <p className={styles.error}>{error}</p>}
            <p className={styles.muted}>For {user.email}. You&apos;ll be signed out on your other devices.</p>
            <form action={completePasswordReset} className={styles.form}>
              <input type="hidden" name="token" value={token} />
              <label>
                New password
                <input type="password" name="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required />
              </label>
              <label>
                Type it again
                <input type="password" name="confirm" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required />
              </label>
              <button type="submit" className="button">
                Save new password
              </button>
            </form>
          </>
        ) : (
          <>
            <p>This reset link has expired or was already used.</p>
            <p>
              <Link href="/forgot-password" className="button">
                Send a new link
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
