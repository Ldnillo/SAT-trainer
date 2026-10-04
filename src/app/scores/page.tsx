import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { DOMAINS, getSkill } from "@/lib/sat/taxonomy";
import { computeMastery, masteryLevel } from "@/lib/trainer/mastery";
import { skillPriority } from "@/lib/trainer/plan";
import { listScoreReports, MAX_BAND, priorsFromReport, REPORT_KINDS, reportTotal, type ScoreReport } from "@/lib/trainer/score-report";
import { removeScoreReport } from "./actions";
import { ScoreForm } from "./ScoreForm";
import styles from "./scores.module.css";

export const metadata: Metadata = { title: "Your SAT scores" };

export default async function ScoresPage({ searchParams }: PageProps<"/scores">) {
  const params = await searchParams;
  const user = await requireUser("/scores");
  const reports = await listScoreReports(await getDb(), user.id);
  const latest = reports[0];
  const today = new Date().toISOString().slice(0, 10);

  // What the trainer will aim at first, judged from the latest report alone.
  const fromReport = latest ? computeMastery([], priorsFromReport(latest)) : undefined;
  const weakest = fromReport
    ? [...fromReport.values()]
        .filter((m) => masteryLevel(m) !== "not-started")
        .sort((a, b) => skillPriority(b) - skillPriority(a))
        .slice(0, 3)
    : [];

  return (
    <main className={styles.page}>
      <p className="eyebrow">Your scores</p>
      <h1>Bring in your real SAT scores</h1>
      <p className={styles.lead}>
        Took an official SAT or a full practice test in Bluebook? Copy your results here and your tailored practice
        will start with the areas that cost you the most points. As you practice, your answers take over.
      </p>
      {params.notice === "saved" && (
        <p className="notice ok">Saved. Your next tailored practice set will use these scores.</p>
      )}
      {params.notice === "deleted" && <p className="notice info">Score report deleted.</p>}

      {latest && (
        <section className={`${styles.card} surface`}>
          <h2>Your practice is using</h2>
          <ReportSummary report={latest} />
          {weakest.length > 0 && (
            <p>
              Tailored practice will start with{" "}
              {weakest.map((m, i) => (
                <span key={m.skill}>
                  {i > 0 && (i === weakest.length - 1 ? " and " : ", ")}
                  <strong>{getSkill(m.skill).skill.name}</strong>
                </span>
              ))}
              . <Link href="/dashboard">Go to your dashboard</Link> to start.
            </p>
          )}
        </section>
      )}

      <section className={`${styles.card} surface`}>
        <h2>{latest ? "Add another test" : "Add your scores"}</h2>
        <p className={styles.muted}>
          Where to find them: sign in to your College Board account and open your score report, or open the Bluebook
          app (or My Practice on the College Board site) and pick a finished practice test. There&apos;s no way to
          import them automatically, so type them in below. It takes about two minutes.
        </p>
        <ScoreForm today={today} />
      </section>

      {reports.length > 0 && (
        <section className={`${styles.card} surface`}>
          <h2>All your tests</h2>
          <p className={styles.muted}>Practice is tuned to the most recent test. Older ones are kept for your records.</p>
          <ul className={styles.reports}>
            {reports.map((r) => (
              <li key={r.id}>
                <ReportSummary report={r} compact />
                <form action={removeScoreReport.bind(null, r.id)}>
                  <button type="submit" className="link-button">
                    Delete
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className={styles.muted}>
        NextScore isn&apos;t connected to the College Board. Your scores stay in your NextScore account and are only used
        to choose your practice questions.
      </p>
    </main>
  );
}

function ReportSummary({ report, compact = false }: { report: ScoreReport; compact?: boolean }) {
  const total = reportTotal(report);
  const date = new Date(`${report.testDate}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const bands = DOMAINS.filter((d) => report.domainBands[d.id]);
  const skills = Object.keys(report.skillResults).length;
  return (
    <div className={styles.summary}>
      <div>
        <strong>{REPORT_KINDS[report.kind]}</strong> <span className={styles.muted}>· {date}</span>
      </div>
      <div className={styles.summaryScores}>
        {total !== null && <span>Total {total}</span>}
        {report.readingWriting !== null && <span>Reading and Writing {report.readingWriting}</span>}
        {report.math !== null && <span>Math {report.math}</span>}
        {skills > 0 && <span>{skills} skills entered</span>}
      </div>
      {!compact && bands.length > 0 && (
        <ul className={styles.bandList}>
          {bands.map((d) => (
            <li key={d.id}>
              <span>{d.name}</span>
              <span className={styles.bandMeter} aria-label={`${report.domainBands[d.id]} of ${MAX_BAND}`}>
                {Array.from({ length: MAX_BAND }, (_, i) => (
                  <i key={i} data-on={i < report.domainBands[d.id]! ? "" : undefined} />
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
