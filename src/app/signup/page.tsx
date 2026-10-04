import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { currentUser } from "@/lib/auth/session";
import { signUp } from "../auth-actions";
import styles from "../auth.module.css";

const ERRORS: Record<string, string> = {
  "invalid-email": "Enter a valid email address.",
  "missing-name": "Enter your name.",
  "short-password": `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`,
  "email-taken": "There is already an account with that email. Sign in instead.",
  "must-agree": "Please confirm your age and agree to the terms to create an account.",
  "too-many": "Too many new accounts from this network. Please try again in an hour.",
};

export const metadata: Metadata = { title: "Create your account" };

export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const params = await searchParams;
  if (await currentUser()) redirect("/dashboard");
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  return (
    <main className={styles.page}>
      <div className={`${styles.card} surface`}>
        <h1>Create your account</h1>
        {error && <p className={styles.error}>{error}</p>}
        <form action={signUp} className={styles.form}>
          <label>
            Name
            <input type="text" name="name" autoComplete="given-name" required />
          </label>
          <label>
            Email
            <input type="email" name="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          </label>
          <label className={styles.agree}>
            <input type="checkbox" name="agree" required />
            <span>
              I&apos;m 13 or older and agree to the <Link href="/terms">Terms of Service</Link> and{" "}
              <Link href="/privacy">Privacy Policy</Link>. If I&apos;m under 18, my parent or guardian agrees too.
            </span>
          </label>
          <button type="submit" className="button">
            Create account
          </button>
        </form>
        <p className={styles.muted}>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
