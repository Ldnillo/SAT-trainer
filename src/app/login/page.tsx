import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { signIn } from "../auth-actions";
import styles from "../auth.module.css";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/dashboard";
  if (await currentUser()) redirect("/dashboard");
  return (
    <main className={styles.page}>
      <div className={`${styles.card} surface`}>
        <h1>Sign in</h1>
        {params.error === "invalid" && (
          <p className={styles.error}>That email and password don&apos;t match an account.</p>
        )}
        {params.error === "too-many" && (
          <p className={styles.error}>
            Too many wrong passwords. Wait 15 minutes, or <Link href="/forgot-password">reset your password</Link>.
          </p>
        )}
        <form action={signIn} className={styles.form}>
          <input type="hidden" name="next" value={next} />
          <label>
            Email
            <input type="email" name="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input type="password" name="password" autoComplete="current-password" required />
          </label>
          <Link href="/forgot-password" className={styles.small}>
            Forgot your password?
          </Link>
          <button type="submit" className="button">
            Sign in
          </button>
        </form>
        <p className={styles.muted}>
          New here? <Link href="/signup">Create an account</Link>
        </p>
      </div>
    </main>
  );
}
