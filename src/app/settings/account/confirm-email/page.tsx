import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { completeEmailChange } from "../../../auth-actions";
import styles from "../account.module.css";

export const metadata: Metadata = { title: "Confirm new email" };

/** The emailed link lands here; the change is applied by the button (a POST), so mail scanners opening the link can't confirm it. */
export default async function ConfirmEmailPage({ searchParams }: PageProps<"/settings/account/confirm-email">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  await requireUser(`/settings/account/confirm-email?token=${encodeURIComponent(token)}`);
  return (
    <section className={`${styles.section} surface`}>
      <h2>Confirm your new email</h2>
      {token ? (
        <form action={completeEmailChange} className={styles.form}>
          <input type="hidden" name="token" value={token} />
          <p className={styles.muted}>Change the email on your NextScore account to the address this link was sent to.</p>
          <button type="submit" className="button">
            Confirm email change
          </button>
        </form>
      ) : (
        <p className={styles.muted}>
          This link is missing its code. Ask for a new one from <Link href="/settings/account">account settings</Link>.
        </p>
      )}
    </section>
  );
}
