"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import styles from "./legal.module.css";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className={styles.page}>
      <h1>Something went wrong</h1>
      <p>Sorry, that didn&apos;t work. Your progress is saved. Try again, or come back in a few minutes.</p>
      <p style={{ display: "flex", gap: 12 }}>
        <button type="button" className="button" onClick={() => retry()}>
          Try again
        </button>
        <Link href="/dashboard" className="button secondary">
          Go to dashboard
        </Link>
      </p>
      {error.digest && <p className={styles.updated}>Error reference: {error.digest}</p>}
    </main>
  );
}
