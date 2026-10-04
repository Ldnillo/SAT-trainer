import type { Metadata } from "next";
import Link from "next/link";
import { ProgressChart } from "@/components/ProgressChart";
import { requireUser } from "@/lib/auth/session";
import { practiceAccess } from "@/lib/billing/pass";
import { getDb } from "@/lib/db/client";
import type { PracticeFocus } from "@/lib/db/schema";
import { DOMAINS, getSkill, SECTION_NAMES } from "@/lib/sat/taxonomy";
import {
  computeMastery,
  estimateScores,
  MASTERY_LABELS,
  masteryLevel,
  MIN_ATTEMPTS_FOR_ESTIMATE,
  progressHistory,
} from "@/lib/trainer/mastery";
import { skillPriority } from "@/lib/trainer/plan";
import { DEFAULT_SET_SIZE, loadAttempts, recentPracticeSets } from "@/lib/trainer/practice";
import { startPractice } from "../practice/actions";
import styles from "./dashboard.module.css";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const params = await searchParams;
  const user = await requireUser("/dashboard");
  const db = await getDb();
  const [history, sets, access] = await Promise.all([
    loadAttempts(db, user.id),
    recentPracticeSets(db, user.id),
    practiceAccess(db, user.id),
  ]);
  const mastery = computeMastery(history);
  const scores = estimateScores(mastery);
  const progress = progressHistory(history);
  const focusSkills = [...mastery.values()].sort((a, b) => skillPriority(b) - skillPriority(a)).slice(0, 5);
  const total = scores.every((s) => s.score !== null) ? scores.reduce((n, s) => n + s.score!, 0) : null;

  return (
    <main>
      <h1>Hi, {user.name}</h1>
      {params.error === "no-questions" && (
        <p className={styles.error}>There are no practice questions for that yet. Try tailored practice instead.</p>
      )}

      <p className={access.allowed ? styles.muted : styles.passNeeded}>
        {access.pass.active ? (
          <>
            Season pass active until {access.pass.activeUntil!.toLocaleDateString("en-US", { month: "long", day: "numeric" })}.{" "}
            <Link href="/pass">Manage</Link>
          </>
        ) : access.freeSetsLeft > 0 ? (
          <>
            {access.freeSetsLeft} free practice {access.freeSetsLeft === 1 ? "set" : "sets"} left.{" "}
            <Link href="/pass">Get a season pass</Link> for unlimited practice.
          </>
        ) : (
          <>
            Your free practice is used up. <Link href="/pass">Get a season pass</Link> to start new sets. Your progress
            stays here either way.
          </>
        )}
      </p>

      <section className={styles.start}>
        <form action={startPractice}>
          <input type="hidden" name="focus" value="tailored" />
          <button type="submit" className="button">
            Start tailored practice ({DEFAULT_SET_SIZE} questions)
          </button>
        </form>
        {(["reading-writing", "math"] as const).map((section) => (
          <form key={section} action={startPractice}>
            <input type="hidden" name="focus" value="section" />
            <input type="hidden" name="value" value={section} />
            <button type="submit" className="button secondary">
              {SECTION_NAMES[section]} only
            </button>
          </form>
        ))}
      </section>

      <p className={styles.muted}>
        Ready to try the whole thing? <Link href="/test">Take a full-length practice test</Link>: timed, adaptive, and scored
        out of 1600.
      </p>

      <h2>Estimated scores</h2>
      <div className={styles.tiles}>
        {scores.map((s) => (
          <div key={s.section} className={styles.tile}>
            <div className={styles.tileLabel}>{SECTION_NAMES[s.section]}</div>
            {s.score !== null ? (
              <div className={styles.tileValue}>{s.score}</div>
            ) : (
              <div className={styles.tileEmpty}>
                Answer {MIN_ATTEMPTS_FOR_ESTIMATE - s.attempts} more {s.section === "math" ? "Math" : "Reading and Writing"}{" "}
                questions to see an estimate
              </div>
            )}
          </div>
        ))}
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Total</div>
          {total !== null ? <div className={styles.tileValue}>{total}</div> : <div className={styles.tileEmpty}>Needs both sections</div>}
        </div>
      </div>
      <p className={styles.muted}>
        Rough estimates from your practice answers so far, on the 200-800 section scale. They are a guide to your
        progress, not a prediction of an official score.
      </p>

      {progress.some((p) => p.readingWriting !== null || p.math !== null) && (
        <>
          <h2>Progress</h2>
          <ProgressChart points={progress} />
        </>
      )}

      {history.length > 0 && (
        <>
          <h2>Where you can gain the most</h2>
          <ol className={styles.focus}>
            {focusSkills.map((m) => (
              <li key={m.skill}>
                <SkillPracticeButton skill={m.skill} label={getSkill(m.skill).skill.name} />{" "}
                <span className={styles.muted}>
                  {MASTERY_LABELS[masteryLevel(m)]}
                  {m.attempts > 0 && `, ${m.correct} of ${m.attempts} correct`}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}

      <h2>Skills</h2>
      {(["reading-writing", "math"] as const).map((section) => (
        <section key={section}>
          <h3>{SECTION_NAMES[section]}</h3>
          <table className={styles.skills}>
            <thead>
              <tr>
                <th>Skill</th>
                <th>Level</th>
                <th>Correct</th>
              </tr>
            </thead>
            <tbody>
              {DOMAINS.filter((d) => d.section === section).flatMap((d) => [
                <tr key={d.id} className={styles.domainRow}>
                  <td colSpan={3}>{d.name}</td>
                </tr>,
                ...d.skills.map((s) => {
                  const m = mastery.get(s.id)!;
                  const level = masteryLevel(m);
                  return (
                    <tr key={s.id}>
                      <td>
                        <SkillPracticeButton skill={s.id} label={s.name} />
                      </td>
                      <td>
                        <span className={`${styles.level} ${styles[level]}`}>{MASTERY_LABELS[level]}</span>
                      </td>
                      <td>{m.attempts > 0 ? `${m.correct}/${m.attempts}` : "–"}</td>
                    </tr>
                  );
                }),
              ])}
            </tbody>
          </table>
        </section>
      ))}

      {sets.length > 0 && (
        <>
          <h2>Recent practice</h2>
          <table className={styles.skills}>
            <thead>
              <tr>
                <th>Started</th>
                <th>Focus</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {sets.map((set) => {
                const answers = history.filter((a) => a.practiceSetId === set.id);
                return (
                  <tr key={set.id}>
                    <td>{set.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                    <td>{focusName(set.focus)}</td>
                    <td>
                      <Link href={`/practice/${set.id}`}>
                        {set.completedAt
                          ? `${answers.filter((a) => a.correct).length} of ${set.questionIds.length} correct`
                          : `Continue (${answers.length} of ${set.questionIds.length} answered)`}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}

function SkillPracticeButton({ skill, label }: { skill: string; label: string }) {
  return (
    <form action={startPractice} className={styles.inline}>
      <input type="hidden" name="focus" value="skill" />
      <input type="hidden" name="value" value={skill} />
      <button type="submit" className="link-button" title={`Practice ${label}`}>
        {label}
      </button>
    </form>
  );
}

function focusName(focus: PracticeFocus): string {
  if (focus.kind === "tailored") return "Tailored";
  if (focus.kind === "section") return SECTION_NAMES[focus.section];
  return getSkill(focus.skill).skill.name;
}
