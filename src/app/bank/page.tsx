import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { countQuestions, findQuestions } from "@/lib/db/questions";
import type { QuestionRecord, QuestionStatus } from "@/lib/sat/question";
import { DIFFICULTIES, DOMAINS, isDifficulty, SECTION_NAMES } from "@/lib/sat/taxonomy";
import styles from "./bank.module.css";

/**
 * Internal preview of the generated question bank, for reviewing questions
 * before students see them. Hidden in production unless ENABLE_BANK_PREVIEW=true.
 */
export default async function BankPage({ searchParams }: PageProps<"/bank">) {
  // Reading searchParams first keeps the page dynamic, so the env check runs per request.
  const params = await searchParams;
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_BANK_PREVIEW !== "true") notFound();
  const skill = typeof params.skill === "string" ? params.skill : undefined;
  const difficulty = typeof params.difficulty === "string" && isDifficulty(params.difficulty) ? params.difficulty : undefined;
  const statuses: QuestionStatus[] =
    params.status === "all" ? ["verified", "needs-review", "rejected"] : params.status === "review" ? ["needs-review"] : ["verified"];

  const db = await getDb();
  const [counts, questions] = await Promise.all([
    countQuestions(db),
    skill ? findQuestions(db, { skills: [skill], difficulties: difficulty ? [difficulty] : undefined, statuses, limit: 50 }) : [],
  ]);
  const verified = (s: string, d: string) =>
    counts.find((c) => c.skill === s && c.difficulty === d && c.status === "verified")?.count ?? 0;
  const review = (s: string) =>
    counts.filter((c) => c.skill === s && c.status === "needs-review").reduce((n, c) => n + c.count, 0);

  return (
    <main>
      <h1>Question bank</h1>
      <p className={styles.muted}>Verified questions per skill and difficulty. Pick a skill to read its questions.</p>

      {(["reading-writing", "math"] as const).map((section) => (
        <section key={section}>
          <h2>{SECTION_NAMES[section]}</h2>
          <table className={styles.grid}>
            <thead>
              <tr>
                <th>Skill</th>
                {DIFFICULTIES.map((d) => (
                  <th key={d}>{d}</th>
                ))}
                <th>needs review</th>
              </tr>
            </thead>
            <tbody>
              {DOMAINS.filter((d) => d.section === section).flatMap((domain) =>
                domain.skills.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/bank?skill=${s.id}`}>{s.name}</Link>
                    </td>
                    {DIFFICULTIES.map((d) => (
                      <td key={d}>
                        <Link href={`/bank?skill=${s.id}&difficulty=${d}`}>{verified(s.id, d)}</Link>
                      </td>
                    ))}
                    <td>
                      <Link href={`/bank?skill=${s.id}&status=review`}>{review(s.id)}</Link>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </section>
      ))}

      {skill && (
        <section>
          <h2>
            {skill} {difficulty ?? ""} ({statuses.join(", ")})
          </h2>
          {questions.length === 0 && <p className={styles.muted}>No questions yet.</p>}
          {questions.map((q) => (
            <QuestionCard key={q.id} q={q} />
          ))}
        </section>
      )}
    </main>
  );
}

function QuestionCard({ q }: { q: QuestionRecord }) {
  const { content } = q;
  const notes = [...q.validationIssues, ...(q.verification?.issues ?? [])];
  if (q.verification && !q.verification.matchesKey) notes.push(`Solver answered ${q.verification.solverAnswer ?? "nothing"}.`);
  return (
    <article className={styles.card}>
      <div className={styles.meta}>
        {q.difficulty} · {q.format} · <span className={styles[q.status]}>{q.status}</span> · {q.id}
      </div>
      {content.passages.map((p, i) => (
        <div key={i} className={styles.passage}>
          {p.label && <strong>{p.label}</strong>}
          <p>{p.text}</p>
        </div>
      ))}
      {content.table && (
        <table>
          {content.table.title && <caption>{content.table.title}</caption>}
          <thead>
            <tr>
              {content.table.columns.map((c, i) => (
                <th key={i}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {content.table.rows.map((r, i) => (
              <tr key={i}>
                {r.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className={styles.stem}>{content.stem}</p>
      {content.choices.length > 0 ? (
        <ol className={styles.choices}>
          {content.choices.map((c) => (
            <li key={c.label} className={c.label === content.correctChoice ? styles.correct : undefined}>
              {c.label}) {c.text}
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.correct}>Accepted answers: {content.acceptedAnswers.join(", ")}</p>
      )}
      <details>
        <summary>Explanation</summary>
        <p>{content.explanation}</p>
        {content.distractorRationales.map((r) => (
          <p key={r.label}>
            <strong>{r.label}:</strong> {r.text}
          </p>
        ))}
      </details>
      <AuthorshipDetails q={q} />
      {notes.length > 0 && (
        <ul className={styles.notes}>
          {notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

function AuthorshipDetails({ q }: { q: QuestionRecord }) {
  const a = q.provenance.authorship;
  if (!a) return <p className={styles.notes}>No authorship record.</p>;
  const source =
    a.passageSource === "original" ? "original" : `${a.passageSource.title}, ${a.passageSource.author} (${a.passageSource.year})`;
  return (
    <details>
      <summary>Authorship</summary>
      <dl className={styles.authorship}>
        <dt>Writer</dt>
        <dd>
          {a.writer.name}, {a.writer.date}
        </dd>
        <dt>Inputs</dt>
        <dd className={styles.passage}>{a.inputs.instructions}</dd>
        <dt>Examples shown</dt>
        <dd>{a.inputs.examples.length ? a.inputs.examples.join("; ") : "none"}</dd>
        <dt>Passage source</dt>
        <dd>{source}</dd>
        <dt>Review</dt>
        <dd>
          {a.reviews.length
            ? a.reviews.map((r, i) => (
                <div key={i}>
                  {r.reviewer}, {r.date}. Edits: {r.edits}
                </div>
              ))
            : "not reviewed"}
        </dd>
      </dl>
    </details>
  );
}
