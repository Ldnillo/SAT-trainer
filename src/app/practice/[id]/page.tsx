import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AnswerInputs, AnswerReview, QuestionBody } from "@/components/Question";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getSkill } from "@/lib/sat/taxonomy";
import { loadSetQuestions, getPracticeSet } from "@/lib/trainer/practice";
import { answerQuestion, startPractice } from "../actions";
import styles from "../practice.module.css";

export const metadata: Metadata = { title: "Practice" };

export default async function PracticePage({ params, searchParams }: PageProps<"/practice/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/practice/${id}`);
  const db = await getDb();
  const set = await getPracticeSet(db, user.id, id);
  if (!set) notFound();
  const items = await loadSetQuestions(db, set);
  const answered = items.filter((i) => i.attempt).length;

  // Feedback on the question just answered.
  const reviewed = items.findIndex((i) => i.question.id === query.reviewed && i.attempt);
  if (reviewed >= 0) {
    const { question, attempt } = items[reviewed];
    const done = answered === items.length;
    return (
      <main className={styles.page}>
        <Header index={reviewed} done={answered} total={items.length} skill={question.skill} difficulty={question.difficulty} />
        <QuestionBody content={question.content} />
        <AnswerReview content={question.content} answer={attempt!.answer} correct={attempt!.correct} />
        <div className={styles.actionBar}>
          <Link href={`/practice/${set.id}`} className="button large">
            {done ? "See results" : "Next question"}
          </Link>
        </div>
      </main>
    );
  }

  const next = items.findIndex((i) => !i.attempt);
  if (next >= 0) {
    const { question } = items[next];
    return (
      <main className={styles.page}>
        <Header index={next} done={answered} total={items.length} skill={question.skill} difficulty={question.difficulty} />
        <form action={answerQuestion.bind(null, set.id, question.id)}>
          <QuestionBody content={question.content} />
          <AnswerInputs content={question.content} />
          <div className={styles.actionBar}>
            <button type="submit" className="button large">
              Check answer
            </button>
          </div>
        </form>
      </main>
    );
  }

  // Set finished: results.
  const correct = items.filter((i) => i.attempt?.correct).length;
  const pct = Math.round((correct / items.length) * 100);
  return (
    <main className={styles.page}>
      <section className={`${styles.summary} surface`}>
        <div className={styles.ring} style={{ "--pct": `${pct}%` } as React.CSSProperties} aria-hidden>
          <span>{pct}%</span>
        </div>
        <div>
          <p className="eyebrow">Set complete</p>
          <h1 className={styles.summaryTitle}>
            {correct} of {items.length} correct
          </h1>
          <p className={styles.muted}>Your skill mastery and score estimates on the dashboard now include these answers.</p>
        </div>
      </section>
      <h2 className={styles.reviewTitle}>Review your answers</h2>
      <ol className={styles.results}>
        {items.map(({ question, attempt }, i) => (
          <li key={question.id}>
            <details className="surface">
              <summary>
                <span className={styles.resultNumber}>{i + 1}</span>
                <span className={styles.resultSkill}>
                  {getSkill(question.skill).skill.name}
                  <span className={styles.muted}> · {question.difficulty}</span>
                </span>
                <span className={`badge ${attempt?.correct ? "ok" : "bad"}`}>{attempt?.correct ? "Correct" : "Missed"}</span>
              </summary>
              <div className={styles.reviewCard}>
                <QuestionBody content={question.content} />
                <AnswerReview content={question.content} answer={attempt!.answer} correct={attempt!.correct} />
              </div>
            </details>
          </li>
        ))}
      </ol>
      <div className={styles.actions}>
        <form action={startPractice}>
          <input type="hidden" name="focus" value="tailored" />
          <button type="submit" className="button large">
            Start another set
          </button>
        </form>
        <Link href="/dashboard" className="button large secondary">
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}

function Header(props: { index: number; done: number; total: number; skill: string; difficulty: string }) {
  const { index, done, total, skill, difficulty } = props;
  const ref = getSkill(skill);
  return (
    <div className={styles.header}>
      <div className={styles.headerTop}>
        <span className={styles.counter}>
          Question {index + 1} <span className={styles.muted}>of {total}</span>
        </span>
        <Link href="/dashboard" className={styles.exit}>
          Save and exit
        </Link>
      </div>
      <div
        className={styles.progress}
        role="progressbar"
        aria-label="Questions answered"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <div style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <div className={styles.meta}>
        <span className="badge plain">{ref.domain.name}</span>
        <span className="badge accent plain">{ref.skill.name}</span>
        <span className={`badge ${DIFFICULTY_TONE[difficulty] ?? ""}`}>{difficulty}</span>
      </div>
    </div>
  );
}

const DIFFICULTY_TONE: Record<string, string> = { easy: "ok", medium: "warn", hard: "bad" };
