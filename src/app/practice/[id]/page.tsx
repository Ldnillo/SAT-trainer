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
      <main>
        <Header index={reviewed} done={answered} total={items.length} skill={question.skill} difficulty={question.difficulty} />
        <QuestionBody content={question.content} />
        <AnswerReview content={question.content} answer={attempt!.answer} correct={attempt!.correct} />
        <Link href={`/practice/${set.id}`} className="button">
          {done ? "See results" : "Next question"}
        </Link>
      </main>
    );
  }

  const next = items.findIndex((i) => !i.attempt);
  if (next >= 0) {
    const { question } = items[next];
    return (
      <main>
        <Header index={next} done={answered} total={items.length} skill={question.skill} difficulty={question.difficulty} />
        <form action={answerQuestion.bind(null, set.id, question.id)}>
          <QuestionBody content={question.content} />
          <AnswerInputs content={question.content} />
          <button type="submit" className="button">
            Check answer
          </button>
        </form>
      </main>
    );
  }

  // Set finished: results.
  const correct = items.filter((i) => i.attempt?.correct).length;
  return (
    <main>
      <h1>
        Set complete: {correct} of {items.length} correct
      </h1>
      <p className={styles.muted}>Your skill mastery and score estimates on the dashboard now include these answers.</p>
      <ol className={styles.results}>
        {items.map(({ question, attempt }) => (
          <li key={question.id}>
            <details>
              <summary>
                <span className={attempt?.correct ? styles.right : styles.wrong}>{attempt?.correct ? "Correct" : "Missed"}</span>{" "}
                {getSkill(question.skill).skill.name} · {question.difficulty}
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
          <button type="submit" className="button">
            Start another set
          </button>
        </form>
        <Link href="/dashboard" className="button secondary">
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
      <div className={styles.progress} aria-hidden>
        <div style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <p className={styles.muted}>
        Question {index + 1} of {total} · {ref.domain.name}: {ref.skill.name} · {difficulty}
      </p>
    </div>
  );
}
