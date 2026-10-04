import Link from "next/link";
import styles from "./legal.module.css";

export default function NotFound() {
  return (
    <main className={styles.page}>
      <h1>Page not found</h1>
      <p>That page doesn&apos;t exist or has moved.</p>
      <p>
        <Link href="/" className="button">
          Go to the home page
        </Link>
      </p>
    </main>
  );
}
