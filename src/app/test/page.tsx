import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { testAccess } from "@/lib/billing/pass";
import { getDb } from "@/lib/db/client";
import { SECTION_NAMES } from "@/lib/sat/taxonomy";
import { BREAK_MINUTES, TEST_FORMAT, TOTAL_MINUTES, TOTAL_QUESTIONS } from "@/lib/test/format";
import { currentModuleIndex, recentTests } from "@/lib/test/tests";
import { startPracticeTest } from "./actions";
import styles from "./test.module.css";

export const metadata: Metadata = { title: "Practice test" };

function duration(minutes: number): string {
  return `${Math.floor(minutes / 60)} hours ${minutes % 60} minutes`;
}

export default async function TestHomePage({ searchParams }: PageProps<"/test">) {
  const params = await searchParams;
  const user = await requireUser("/test");
  const db = await getDb();
  const [tests, access] = await Promise.all([recentTests(db, user.id), testAccess(db, user.id)]);
  const unfinished = tests.find((t) => !t.completedAt);

  return (
    <main>
      <p className="eyebrow">Practice test</p>
      <h1 className={styles.title}>Full-length practice test</h1>
      <p className={styles.lead}>
        A timed, adaptive practice test laid out like the digital SAT: {TOTAL_QUESTIONS} questions in {duration(TOTAL_MINUTES)}, plus
        a {BREAK_MINUTES}-minute break. You get a score for each section and a full review with explanations at the end.
      </p>
      {params.error === "no-questions" && (
        <p className="notice bad">There aren&apos;t enough questions in the bank to build a full test yet.</p>
      )}

      <table className={styles.formatTable}>
        <thead>
          <tr>
            <th>Section</th>
            <th>Modules</th>
            <th>Questions</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {TEST_FORMAT.map((f) => (
            <tr key={f.section}>
              <td>{SECTION_NAMES[f.section]}</td>
              <td>2</td>
              <td>{f.questionsPerModule} per module</td>
              <td>{f.minutesPerModule} minutes per module</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className={styles.notes}>
        <li>
          Module 1 of each section has a mix of easy, medium and hard questions. How you do on it decides whether module 2 is
          easier or harder, and only the harder module 2 can reach the top scores.
        </li>
        <li>Within a module you can skip questions, mark them for review and change answers until you submit it or time runs out.</li>
        <li>A calculator is allowed for all of Math, and a formula reference is one click away.</li>
        <li>Your answers save as you go. If you close the page, the clock keeps running; come back here to pick up where you left off.</li>
      </ul>

      {unfinished ? (
        <Link href={`/test/${unfinished.id}`} className="button large">
          Resume your test
        </Link>
      ) : access.allowed ? (
        <form action={startPracticeTest} className={styles.start}>
          <button type="submit" className="button large">
            Start a practice test
          </button>
          <p className={styles.muted}>
            Set aside about {duration(TOTAL_MINUTES + BREAK_MINUTES)} somewhere quiet. Each module&apos;s clock starts when you
            open it.
          </p>
        </form>
      ) : (
        <div className="notice warn">
          <p>
            <strong>Full-length practice tests come with the season pass.</strong>
          </p>
          <Link href="/pass" className="button small">
            Get a season pass
          </Link>
        </div>
      )}

      {tests.length > 0 && (
        <>
          <h2>Your tests</h2>
          <table className={styles.formatTable}>
            <thead>
              <tr>
                <th>Started</th>
                <th>Total</th>
                <th>{SECTION_NAMES["reading-writing"]}</th>
                <th>{SECTION_NAMES.math}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tests.map((t) => (
                <tr key={t.id}>
                  <td>{t.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                  <td>{t.scores ? <strong>{t.scores.total}</strong> : "–"}</td>
                  <td>{t.scores?.readingWriting ?? "–"}</td>
                  <td>{t.scores?.math ?? "–"}</td>
                  <td>
                    <Link href={`/test/${t.id}`}>
                      {t.scores ? "Review" : `Continue (module ${currentModuleIndex(t) + 1} of 4)`}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
