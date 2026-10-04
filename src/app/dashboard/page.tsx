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
  type MasteryLevel,
  MIN_ATTEMPTS_FOR_ESTIMATE,
  progressHistory,
} from "@/lib/trainer/mastery";
import { skillPriority } from "@/lib/trainer/plan";
import { DEFAULT_SET_SIZE, loadAttempts, recentPracticeSets } from "@/lib/trainer/practice";
import { latestScoreReport, priorsFromReport, REPORT_KINDS, reportTotal } from "@/lib/trainer/score-report";
import { startPractice } from "../practice/actions";
import styles from "./dashboard.module.css";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const params = await searchParams;
  const user = await requireUser("/dashboard");
  const db = await getDb();
  const [history, sets, access, report] = await Promise.all([
    loadAttempts(db, user.id),
    recentPracticeSets(db, user.id),
    practiceAccess(db, user.id),
    latestScoreReport(db, user.id),
  ]);
  // Targeting and skill levels start from the student's score report, if they added one;
  // the estimated scores come from practice answers alone.
  const mastery = computeMastery(history, report ? priorsFromReport(report) : undefined);
  const scores = estimateScores(computeMastery(history));
  const reportScore = report ? reportTotal(report) : null;
  const progress = progressHistory(history);
  const focusSkills = [...mastery.values()].sort((a, b) => skillPriority(b) - skillPriority(a)).slice(0, 5);
  const total = scores.every((s) => s.score !== null) ? scores.reduce((n, s) => n + s.score!, 0) : null;

  const levelBadge = (m: (typeof focusSkills)[number]) => {
    const level = masteryLevel(m);
    return <span className={`badge ${LEVEL_TONE[level]}`}>{MASTERY_LABELS[level]}</span>;
  };

  return (
    <main>
      <p className="eyebrow">Dashboard</p>
      <h1 className={styles.title}>Hi, {user.name}</h1>
      {params.notice === "password-reset" && (
        <p className={styles.notice}>Your new password is saved. You&apos;ve been signed out on your other devices.</p>
      )}
      {params.error === "no-questions" && (
        <p className="notice bad">There are no practice questions for that yet. Try tailored practice instead.</p>
      )}

      <div className={`notice ${access.pass.active ? "ok" : access.freeSetsLeft > 0 ? "info" : "warn"}`}>
        {access.pass.active ? (
          <p>
            Season pass active until{" "}
            <strong>{access.pass.activeUntil!.toLocaleDateString("en-US", { month: "long", day: "numeric" })}</strong>.
          </p>
        ) : access.freeSetsLeft > 0 ? (
          <p>
            <strong>
              {access.freeSetsLeft} free practice {access.freeSetsLeft === 1 ? "set" : "sets"} left.
            </strong>{" "}
            A season pass unlocks unlimited practice.
          </p>
        ) : (
          <p>
            <strong>Your free practice is used up.</strong> Get a season pass to start new sets. Your progress stays
            here either way.
          </p>
        )}
        <Link href="/pass" className={access.pass.active ? styles.noticeLink : "button small"}>
          {access.pass.active ? "Manage" : "Get a season pass"}
        </Link>
      </div>

      <section className={`${styles.start} surface`}>
        <div>
          <h2 className={styles.cardTitle}>Your next set</h2>
          <p className={styles.muted}>
            {DEFAULT_SET_SIZE} questions aimed at the skills where you can gain the most points.
          </p>
        </div>
        <div className={styles.startActions}>
          <form action={startPractice}>
            <input type="hidden" name="focus" value="tailored" />
            <button type="submit" className="button large">
              Start tailored practice
            </button>
          </form>
          <div className={styles.sectionButtons}>
            {(["reading-writing", "math"] as const).map((section) => (
              <form key={section} action={startPractice}>
                <input type="hidden" name="focus" value="section" />
                <input type="hidden" name="value" value={section} />
                <button type="submit" className="button secondary">
                  {SECTION_NAMES[section]} only
                </button>
              </form>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.testCard} surface`}>
        <div>
          <h2 className={styles.testTitle}>Full-length practice test</h2>
          <p className={styles.muted}>Ready to try the whole thing? Timed, adaptive, and scored out of 1600.</p>
        </div>
        <Link href="/test" className="button secondary">
          Take a practice test
        </Link>
      </section>

      <section className={`${styles.testCard} surface`}>
        {report ? (
          <div>
            <h2 className={styles.testTitle}>
              Tuned to your {REPORT_KINDS[report.kind].replace("Official SAT", "official SAT")}
              {reportScore !== null && <> ({reportScore})</>}
            </h2>
            <p className={styles.muted}>
              Tailored practice starts from the scores you added and adjusts as you answer questions.
            </p>
          </div>
        ) : (
          <div>
            <h2 className={styles.testTitle}>Took the SAT or a Bluebook practice test?</h2>
            <p className={styles.muted}>Add your scores and practice will start with the areas that cost you the most points.</p>
          </div>
        )}
        <Link href="/scores" className="button secondary">
          {report ? "Your scores" : "Add your scores"}
        </Link>
      </section>

      <h2>Estimated scores</h2>
      <div className={styles.tiles}>
        {scores.map((s) => (
          <div key={s.section} className={`${styles.tile} surface`}>
            <div className={styles.tileLabel}>{SECTION_NAMES[s.section]}</div>
            {s.score !== null ? (
              <div className={styles.tileValue}>{s.score}</div>
            ) : (
              <>
                <div className={`${styles.tileValue} ${styles.tileValueEmpty}`}>–</div>
                <div className={styles.meter} aria-hidden>
                  <div style={{ width: `${(Math.min(s.attempts, MIN_ATTEMPTS_FOR_ESTIMATE) / MIN_ATTEMPTS_FOR_ESTIMATE) * 100}%` }} />
                </div>
                <div className={styles.tileEmpty}>
                  Answer {MIN_ATTEMPTS_FOR_ESTIMATE - s.attempts} more {s.section === "math" ? "Math" : "Reading and Writing"}{" "}
                  questions to see an estimate
                </div>
              </>
            )}
          </div>
        ))}
        <div className={`${styles.tile} ${styles.totalTile} surface`}>
          <div className={styles.tileLabel}>Total</div>
          {total !== null ? (
            <div className={styles.tileValue}>{total}</div>
          ) : (
            <>
              <div className={`${styles.tileValue} ${styles.tileValueEmpty}`}>–</div>
              <div className={styles.tileEmpty}>Needs an estimate for both sections</div>
            </>
          )}
        </div>
      </div>
      <p className={styles.muted}>
        Rough estimates from your practice answers so far, on the 200-800 section scale. They are a guide to your
        progress, not a prediction of an official score.
      </p>

      {progress.some((p) => p.readingWriting !== null || p.math !== null) && (
        <>
          <h2>Progress</h2>
          <div className={`${styles.chartCard} surface`}>
            <ProgressChart points={progress} />
          </div>
        </>
      )}

      {(history.length > 0 || report) && (
        <>
          <h2>Where you can gain the most</h2>
          <ol className={styles.focus}>
            {focusSkills.map((m, i) => (
              <li key={m.skill} className="surface">
                <span className={styles.rank}>{i + 1}</span>
                <div className={styles.focusText}>
                  <SkillPracticeButton skill={m.skill} label={getSkill(m.skill).skill.name} />
                  <span className={styles.muted}>
                    {getSkill(m.skill).domain.name}
                    {m.attempts > 0
                      ? ` · ${m.correct} of ${m.attempts} correct`
                      : m.priorWeight
                        ? " · from your score report"
                        : ""}
                  </span>
                </div>
                {levelBadge(m)}
              </li>
            ))}
          </ol>
        </>
      )}

      <h2>Skills</h2>
      <p className={styles.muted}>Pick any skill to practice just that skill.</p>
      {(["reading-writing", "math"] as const).map((section) => (
        <section key={section}>
          <h3 className={styles.sectionTitle}>{SECTION_NAMES[section]}</h3>
          <div className={styles.domains}>
            {DOMAINS.filter((d) => d.section === section).map((d) => (
              <div key={d.id} className={`${styles.domain} surface`}>
                <h4>{d.name}</h4>
                <ul>
                  {d.skills.map((s) => {
                    const m = mastery.get(s.id)!;
                    return (
                      <li key={s.id}>
                        <SkillPracticeButton skill={s.id} label={s.name} />
                        <span className={styles.skillStats}>
                          {m.attempts > 0 && (
                            <span className={styles.count}>
                              {m.correct}/{m.attempts}
                            </span>
                          )}
                          {levelBadge(m)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}

      {sets.length > 0 && (
        <>
          <h2>Recent practice</h2>
          <ul className={`${styles.sets} surface`}>
            {sets.map((set) => {
              const answers = history.filter((a) => a.practiceSetId === set.id);
              return (
                <li key={set.id}>
                  <span className={styles.setDate}>
                    {set.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <span className={styles.setFocus}>{focusName(set.focus)}</span>
                  {set.completedAt ? (
                    <Link href={`/practice/${set.id}`} className={styles.setResult}>
                      {answers.filter((a) => a.correct).length} of {set.questionIds.length} correct
                    </Link>
                  ) : (
                    <Link href={`/practice/${set.id}`} className={`${styles.setResult} button small`}>
                      Continue ({answers.length}/{set.questionIds.length})
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}

const LEVEL_TONE: Record<MasteryLevel, string> = {
  "not-started": "",
  "needs-work": "bad",
  developing: "warn",
  strong: "ok",
};

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
