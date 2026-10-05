import type { Metadata } from "next";
import Link from "next/link";
import { AnswerReview, QuestionBody } from "@/components/Question";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/client";
import type { ReportStatus } from "@/lib/db/schema";
import { getSkill, SECTION_NAMES } from "@/lib/sat/taxonomy";
import { isReportStatus, loadReports, reasonLabel, reportCounts, REPORT_STATUSES, type ReportedQuestion } from "@/lib/trainer/reports";
import { updateReports } from "./actions";
import styles from "./reports.module.css";

export const metadata: Metadata = { title: "Problem reports", robots: { index: false } };

const STATUS_NAMES: Record<ReportStatus, string> = { open: "Open", fixed: "Fixed", dismissed: "Dismissed" };

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * Staff page listing the problems students reported on questions, grouped by
 * question. Only accounts in ADMIN_EMAILS can open it (see src/lib/auth/admin.ts).
 */
export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  await requireAdmin();
  const params = await searchParams;
  const status: ReportStatus = isReportStatus(params.status) ? params.status : "open";
  const db = await getDb();
  const [counts, groups] = await Promise.all([reportCounts(db), loadReports(db, status)]);

  return (
    <main className={styles.page}>
      <h1>Problem reports</h1>
      <p className={styles.muted}>
        What students reported with the &quot;Report a problem&quot; button. To fix a question, edit it in{" "}
        <code>content/questions/&lt;skill&gt;.json</code>, run <code>npm run import</code>, then mark its reports fixed.
      </p>

      <nav className={styles.tabs} aria-label="Report status">
        {REPORT_STATUSES.map((s) => (
          <Link
            key={s}
            href={s === "open" ? "/admin/reports" : `/admin/reports?status=${s}`}
            className={styles.tab}
            aria-current={s === status ? "page" : undefined}
          >
            {STATUS_NAMES[s]} <span className={styles.count}>{counts[s]}</span>
          </Link>
        ))}
      </nav>

      {groups.length === 0 ? (
        <p className={`${styles.empty} surface`}>
          {status === "open" ? "No open reports. Nothing to fix right now." : `No ${STATUS_NAMES[status].toLowerCase()} reports.`}
        </p>
      ) : (
        <ol className={styles.list}>
          {groups.map((group) => (
            <li key={group.question.id}>
              <ReportCard group={group} status={status} />
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

function ReportCard({ group, status }: { group: ReportedQuestion; status: ReportStatus }) {
  const { question, reports } = group;
  const ref = getSkill(question.skill);
  return (
    <article className={`${styles.card} surface`}>
      <header className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle}>{question.sourceId ?? "Generated question"}</h2>
          <p className={styles.muted}>
            {ref.skill.name} · {SECTION_NAMES[question.section]} · {question.difficulty}
            {question.status !== "verified" && ` · ${question.status}`}
          </p>
        </div>
        <span className={`badge ${status === "open" ? "bad" : "plain"}`}>
          {reports.length} {reports.length === 1 ? "report" : "reports"}
        </span>
      </header>

      <ul className={styles.reports}>
        {reports.map((r) => (
          <li key={r.id}>
            <p className={styles.reason}>{reasonLabel(r.reason)}</p>
            {r.details && <blockquote className={styles.details}>{r.details}</blockquote>}
            <p className={styles.muted}>
              {r.reporter.name} ({r.reporter.email}) · {dateFormat.format(r.createdAt)}
              {r.resolvedAt && ` · ${STATUS_NAMES[status].toLowerCase()} ${dateFormat.format(r.resolvedAt)}`}
            </p>
          </li>
        ))}
      </ul>

      <details className={styles.question}>
        <summary>Show the question and its answer</summary>
        <div className={styles.questionBody}>
          <QuestionBody content={question.content} />
          <AnswerReview content={question.content} answer={null} correct={false} />
        </div>
      </details>

      <form action={updateReports} className={styles.actions}>
        <input type="hidden" name="question" value={question.id} />
        <input type="hidden" name="from" value={status} />
        {status === "open" ? (
          <>
            <button type="submit" name="to" value="fixed" className="button small">
              Mark fixed
            </button>
            <button type="submit" name="to" value="dismissed" className="button small secondary">
              Dismiss, nothing wrong
            </button>
          </>
        ) : (
          <button type="submit" name="to" value="open" className="button small secondary">
            Reopen
          </button>
        )}
      </form>
    </article>
  );
}
