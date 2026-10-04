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
};

export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const params = await searchParams;
  if (await currentUser()) redirect("/dashboard");
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  return (
    <main>
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
          <input type="password" name="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required />
        </label>
        <button type="submit" className="button">
          Create account
        </button>
      </form>
      <p className={styles.muted}>
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </main>
  );
}
