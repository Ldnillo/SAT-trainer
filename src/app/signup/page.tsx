import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/Logo";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { currentUser } from "@/lib/auth/session";
import { passConfig } from "@/lib/billing/config";
import { signUp } from "../auth-actions";
import styles from "../auth.module.css";

const ERRORS: Record<string, string> = {
  "invalid-email": "Enter a valid email address.",
  "missing-name": "Enter your name.",
  "short-password": `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`,
  "email-taken": "There is already an account with that email. Sign in instead.",
};

export const metadata: Metadata = { title: "Create your account" };

export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const params = await searchParams;
  if (await currentUser()) redirect("/dashboard");
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const { freeSets } = passConfig();
  return (
    <main className={styles.page}>
      <div className={`${styles.card} surface`}>
        <div className={styles.mark}>
          <LogoMark size={40} />
        </div>
        <h1>Create your account</h1>
        <p className={styles.subtitle}>
          {freeSets === 0
            ? "Create an account to start practicing."
            : freeSets === 1
              ? "Your first practice set is free. No card needed."
              : `Your first ${freeSets} practice sets are free. No card needed.`}
        </p>
        {error && <p className={`${styles.error} notice bad`}>{error}</p>}
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
            <span className={styles.hint}>At least {MIN_PASSWORD_LENGTH} characters.</span>
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
