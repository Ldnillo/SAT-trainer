import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MathText } from "@/components/MathText";
import { FlagButton } from "@/components/FlagButton";
import { AnswerReview, QuestionBody } from "@/components/Question";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import type { TestModule } from "@/lib/db/schema";
import { DOMAINS, getSkill, SECTION_NAMES, type SectionId } from "@/lib/sat/taxonomy";
import { BREAK_MINUTES, sectionFormat } from "@/lib/test/format";
import { flaggedIds } from "@/lib/trainer/review";
import { closeExpiredModule, currentModuleIndex, getTest, loadModuleItems, timeLeft, type PracticeTest, type ReviewItem } from "@/lib/test/tests";
import { beginTestModule } from "../actions";
import { ReferenceSheet } from "../ReferenceSheet";
import styles from "../test.module.css";
import { ModuleRunner } from "./ModuleRunner";

export const metadata: Metadata = { title: "Practice test" };

function moduleTitle(m: TestModule): string {
  return `Section ${m.section === "reading-writing" ? 1 : 2}, Module ${m.stage}: ${SECTION_NAMES[m.section]}`;
}

export default async function TestPage({ params }: PageProps<"/test/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/test/${id}`);
  const db = await getDb();
  const found = await getTest(db, user.id, id);
  if (!found) notFound();
  // The clock ran out while the student was away: submit what they had.
  const test = await closeExpiredModule(db, user.id, found);
  const index = currentModuleIndex(test);

  if (index < 0) {
    const [items, flags] = await Promise.all([
      Promise.all(test.modules.map((_, i) => loadModuleItems(db, test, i))),
      flaggedIds(db, user.id),
    ]);
    return <Results test={test} items={items} flags={flags} />;
  }

  const m = test.modules[index];
  const format = sectionFormat(m.section);
  const title = moduleTitle(m);

  if (!m.startedAt) {
    const afterBreak = index > 0 && m.stage === 1;
    return (
      <main className={styles.intro}>
        {afterBreak && (
          <div className={styles.breakCard}>
            <h2>Break time</h2>
            <p>
              You&apos;ve finished {SECTION_NAMES[test.modules[index - 1].section]}. On test day you get a {BREAK_MINUTES}-minute
              break here. Stretch, get some water, and start Math when you&apos;re ready.
            </p>
          </div>
        )}
        <p className="eyebrow">Module {index + 1} of 4</p>
        <h1 className={styles.title}>{title}</h1>
        <ul className={styles.notes}>
          <li>
            {m.questionIds.length} questions, {format.minutesPerModule} minutes. The clock starts when you press Start and keeps
            running if you leave the page.
          </li>
          {m.section === "reading-writing" ? (
            <li>Each question has a short passage (or two) and four choices. Pick the single best answer.</li>
          ) : (
            <li>
              Most questions have four choices; for the rest, type your answer. The graphing calculator and the formula reference
              are in the top bar, or you can use your own calculator.
            </li>
          )}
          {m.stage === 2 && <li>This module was picked based on how you did in module 1.</li>}
          <li>When time runs out, the module is submitted with the answers you have.</li>
        </ul>
        <form action={beginTestModule.bind(null, test.id, index)}>
          <button type="submit" className="button large">
            Start module {m.stage}
          </button>
        </form>
      </main>
    );
  }

  const items = await loadModuleItems(db, test, index);
  const remainingMs = timeLeft(m);
  return (
    <ModuleRunner
      key={index}
      testId={test.id}
      index={index}
      title={title}
      remainingMs={remainingMs}
      reference={m.section === "math" ? <ReferenceSheet /> : undefined}
      calculator={
        m.section === "math" ? { storageKey: `calc:test:${test.id}:${index}`, desmosApiKey: process.env.DESMOS_API_KEY?.trim() || undefined } : undefined
      }
      initial={Object.fromEntries(
        items.filter((i) => i.answer).map((i) => [i.question.id, { answer: i.answer!.answer, flagged: i.answer!.flagged }]),
      )}
      // Only what the student may see: no answer key or explanations reach the browser during the test.
      items={items.map(({ question }) => ({
        id: question.id,
        body: <QuestionBody content={question.content} />,
        choices: question.content.choices.map((c) => ({ label: c.label, text: <MathText text={c.text} /> })),
      }))}
    />
  );
}

function Results({ test, items, flags }: { test: PracticeTest; items: ReviewItem[][]; flags: Set<string> }) {
  const scores = test.scores!;
  const sections: SectionId[] = ["reading-writing", "math"];
  const all = items.flat();

  return (
    <main>
      <p className="eyebrow">Practice test</p>
      <h1 className={styles.title}>Your results</h1>
      <div className={styles.scoreTiles}>
        <div className={`${styles.scoreTile} ${styles.totalTile} surface`}>
          <div className={styles.tileLabel}>Total score</div>
          <div className={styles.tileValue}>{scores.total}</div>
          <div className={styles.muted}>out of 1600</div>
        </div>
        {sections.map((s) => (
          <div key={s} className={`${styles.scoreTile} surface`}>
            <div className={styles.tileLabel}>{SECTION_NAMES[s]}</div>
            <div className={styles.tileValue}>{s === "math" ? scores.math : scores.readingWriting}</div>
            <div className={styles.muted}>out of 800</div>
          </div>
        ))}
      </div>
      <p className={styles.muted}>
        Scored like the digital SAT: harder questions count for more, so the harder module 2 opens up the top of the scale. This is
        an estimate from NextScore&apos;s own questions, not an official score.
      </p>

      <h2>By module</h2>
      <table className={styles.formatTable}>
        <thead>
          <tr>
            <th>Module</th>
            <th>Difficulty</th>
            <th>Correct</th>
          </tr>
        </thead>
        <tbody>
          {test.modules.map((m, i) => (
            <tr key={i}>
              <td>
                {SECTION_NAMES[m.section]} {m.stage}
              </td>
              <td>{m.tier === "standard" ? "Mixed" : m.tier === "harder" ? "Harder" : "Easier"}</td>
              <td>
                {items[i].filter((x) => x.answer?.correct).length} of {items[i].length}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>By content area</h2>
      <table className={styles.formatTable}>
        <thead>
          <tr>
            <th>Area</th>
            <th>Correct</th>
          </tr>
        </thead>
        <tbody>
          {DOMAINS.map((d) => {
            const inDomain = all.filter((x) => getSkill(x.question.skill).domain.id === d.id);
            if (inDomain.length === 0) return null;
            return (
              <tr key={d.id}>
                <td>{d.name}</td>
                <td>
                  {inDomain.filter((x) => x.answer?.correct).length} of {inDomain.length}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className={styles.muted}>
        Your answers here now count toward your skill levels and score estimates on the dashboard. Questions you missed are waiting
        in <Link href="/review">Review</Link>, where you can retry them.
      </p>

      <h2>Review every question</h2>
      {test.modules.map((m, i) => (
        <section key={i}>
          <h3>
            {SECTION_NAMES[m.section]}, module {m.stage}
          </h3>
          <ol className={styles.reviewList}>
            {items[i].map(({ question, answer }, n) => (
              <li key={question.id}>
                <details className="surface">
                  <summary>
                    <span className={styles.resultNumber}>{n + 1}</span>
                    <span className={styles.resultSkill}>
                      {getSkill(question.skill).skill.name}
                      <span className={styles.muted}> · {question.difficulty}</span>
                    </span>
                    {answer?.flagged && <span className="badge plain">Marked</span>}
                    <span className={`badge ${answer?.correct ? "ok" : answer?.answer ? "bad" : "warn"}`}>
                      {answer?.correct ? "Correct" : answer?.answer ? "Missed" : "Not answered"}
                    </span>
                  </summary>
                  <div className={styles.reviewCard}>
                    <div className={styles.reviewTools}>
                      <FlagButton questionId={question.id} initial={flags.has(question.id)} />
                    </div>
                    <QuestionBody content={question.content} />
                    <AnswerReview content={question.content} answer={answer?.answer ?? ""} correct={answer?.correct ?? false} />
                  </div>
                </details>
              </li>
            ))}
          </ol>
        </section>
      ))}

      <div className={styles.actions}>
        <Link href="/dashboard" className="button large">
          Back to dashboard
        </Link>
        <Link href="/test" className="button large secondary">
          All practice tests
        </Link>
      </div>
    </main>
  );
}
