import type { Metadata } from "next";
import Link from "next/link";
import { FlagButton } from "@/components/FlagButton";
import { AnswerReview, QuestionBody } from "@/components/Question";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import type { QuestionRecord } from "@/lib/sat/question";
import { getSkill, SECTION_NAMES } from "@/lib/sat/taxonomy";
import { DEFAULT_SET_SIZE, loadAttempts, type Attempt } from "@/lib/trainer/practice";
import { flaggedIds, loadFlagged, mistakesFrom, questionsInOrder } from "@/lib/trainer/review";
import { startPractice } from "../practice/actions";
import styles from "./review.module.css";

export const metadata: Metadata = { title: "Review" };

export default async function ReviewPage() {
  const user = await requireUser("/review");
  const db = await getDb();
  const [history, flagged, flags] = await Promise.all([loadAttempts(db, user.id), loadFlagged(db, user.id), flaggedIds(db, user.id)]);
  const mistakes = mistakesFrom(history);
  const missedQuestions = await questionsInOrder(
    db,
    mistakes.map((m) => m.questionId),
  );
  const mistakeById = new Map(mistakes.map((m) => [m.questionId, m]));
  const lastAttempt = new Map<string, Attempt>();
  for (const a of history) lastAttempt.set(a.questionId, a);

  return (
    <main className={styles.page}>
      <p className="eyebrow">Review</p>
      <h1 className={styles.title}>Your mistakes and flagged questions</h1>
      <p className={styles.muted}>
        Every question you get wrong lands here, from practice sets and practice tests. Retry them until you get them right; a
        question leaves the list once you answer it correctly. Flag any question you want to look at again.
      </p>

      <section className={styles.block}>
        <div className={`${styles.card} surface`}>
          <div>
            <h2 className={styles.cardTitle}>
              My mistakes <span className={styles.count}>{missedQuestions.length}</span>
            </h2>
            <p className={styles.muted}>
              {missedQuestions.length === 0
                ? history.length === 0
                  ? "Nothing yet. Questions you miss will show up here."
                  : "No mistakes left to fix. Nice work."
                : `Retry up to ${DEFAULT_SET_SIZE} at a time, oldest first.`}
            </p>
          </div>
          {missedQuestions.length > 0 && (
            <form action={startPractice}>
              <input type="hidden" name="focus" value="mistakes" />
              <button type="submit" className="button">
                Retry {Math.min(DEFAULT_SET_SIZE, missedQuestions.length)} {missedQuestions.length === 1 ? "mistake" : "mistakes"}
              </button>
            </form>
          )}
        </div>
        {missedQuestions.length > 0 && (
          <QuestionList
            questions={missedQuestions}
            flags={flags}
            detail={(q) => {
              const m = mistakeById.get(q.id)!;
              return `Missed ${dateText(m.missedAt)}${m.timesMissed > 1 ? ` · ${m.timesMissed} times` : ""}`;
            }}
            answer={(q) => ({ answer: mistakeById.get(q.id)!.answer, correct: false })}
          />
        )}
      </section>

      <section className={styles.block}>
        <div className={`${styles.card} surface`}>
          <div>
            <h2 className={styles.cardTitle}>
              Flagged for review <span className={styles.count}>{flagged.length}</span>
            </h2>
            <p className={styles.muted}>
              {flagged.length === 0
                ? "Use the Flag for review button on any question to save it here."
                : `Practice up to ${DEFAULT_SET_SIZE} at a time. They stay flagged until you unflag them.`}
            </p>
          </div>
          {flagged.length > 0 && (
            <form action={startPractice}>
              <input type="hidden" name="focus" value="flagged" />
              <button type="submit" className="button secondary">
                Practice {Math.min(DEFAULT_SET_SIZE, flagged.length)} flagged
              </button>
            </form>
          )}
        </div>
        {flagged.length > 0 && (
          <QuestionList
            questions={flagged.map((f) => f.question)}
            flags={flags}
            detail={(q) => `Flagged ${dateText(flagged.find((f) => f.question.id === q.id)!.flaggedAt)}`}
            answer={(q) => {
              const a = lastAttempt.get(q.id);
              return a ? { answer: a.answer, correct: a.correct } : { answer: null, correct: false };
            }}
          />
        )}
      </section>

      <p className={styles.back}>
        <Link href="/dashboard">Back to dashboard</Link>
      </p>
    </main>
  );
}

function dateText(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function QuestionList(props: {
  questions: QuestionRecord[];
  flags: Set<string>;
  detail: (q: QuestionRecord) => string;
  answer: (q: QuestionRecord) => { answer: string | null; correct: boolean };
}) {
  return (
    <ol className={styles.list}>
      {props.questions.map((q) => {
        const ref = getSkill(q.skill);
        const { answer, correct } = props.answer(q);
        return (
          <li key={q.id}>
            <details className="surface">
              <summary>
                <span className={styles.skill}>
                  {ref.skill.name}
                  <span className={styles.muted}>
                    {" "}
                    · {SECTION_NAMES[q.section]} · {q.difficulty}
                  </span>
                </span>
                <span className={styles.when}>{props.detail(q)}</span>
              </summary>
              <div className={styles.body}>
                <div className={styles.tools}>
                  <FlagButton questionId={q.id} initial={props.flags.has(q.id)} />
                </div>
                <QuestionBody content={q.content} />
                <details className={styles.reveal}>
                  <summary>Show {answer === null ? "the answer" : "your answer"} and the explanation</summary>
                  <AnswerReview content={q.content} answer={answer} correct={correct} />
                </details>
              </div>
            </details>
          </li>
        );
      })}
    </ol>
  );
}
