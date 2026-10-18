import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { DailyGoal } from "@/components/DailyGoal";
import { ProgressChart } from "@/components/ProgressChart";
import { TimeZoneSync } from "@/components/TimeZoneSync";
import { requireUser } from "@/lib/auth/session";
import { practiceAccess, testAccess } from "@/lib/billing/pass";
import { getDb } from "@/lib/db/client";
import type { PracticeFocus } from "@/lib/db/schema";
import { DOMAINS, getSkill, SECTION_NAMES } from "@/lib/sat/taxonomy";
import { parseTimeZone, TIME_ZONE_COOKIE } from "@/lib/time-zone";
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
import { describeBasis, measurementsFrom, predictScore, type ScorePrediction } from "@/lib/trainer/prediction";
import { DEFAULT_SET_SIZE, loadAttempts, recentPracticeSets } from "@/lib/trainer/practice";
import { flaggedIds, mistakesFrom } from "@/lib/trainer/review";
import { completedTests } from "@/lib/test/tests";
import { listScoreReports, priorsFromReport, REPORT_KINDS, reportTotal } from "@/lib/trainer/score-report";
import { dailyProgress, loadDailyGoal } from "@/lib/trainer/streak";
import { startPractice } from "../practice/actions";
import styles from "./dashboard.module.css";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const params = await searchParams;
  const user = await requireUser("/dashboard");
  const db = await getDb();
  const [history, sets, access, testsAccess, reports, flags, tests, goal, cookieStore] = await Promise.all([
    loadAttempts(db, user.id),
    recentPracticeSets(db, user.id),
    practiceAccess(db, user.id),
    testAccess(db, user.id),
    listScoreReports(db, user.id),
    flaggedIds(db, user.id),
    completedTests(db, user.id),
    loadDailyGoal(db, user.id),
    cookies(),
  ]);
  const report = reports[0];
  const unfinished = sets.find((s) => !s.completedAt);
  const unfinishedAnswered = unfinished ? history.filter((a) => a.practiceSetId === unfinished.id).length : 0;
  const timeZoneCookie = cookieStore.get(TIME_ZONE_COOKIE)?.value;
  const daily = dailyProgress(history, goal, new Date(), parseTimeZone(timeZoneCookie));
  const mistakeCount = mistakesFrom(history).length;
  // Targeting and skill levels start from the student's score report, if they added one;
  // the estimated scores come from practice answers alone.
  const mastery = computeMastery(history, report ? priorsFromReport(report) : undefined);
  const scores = estimateScores(computeMastery(history));
  const reportScore = report ? reportTotal(report) : null;
  const progress = progressHistory(history);
  const focusSkills = [...mastery.values()].sort((a, b) => skillPriority(b) - skillPriority(a)).slice(0, 5);
  // The prediction counts each practice test once, from its own score, so its answers
  // are left out of the everyday practice estimate it also uses.
  const practiceOnly = history.filter((a) => !a.practiceTestId);
  const now = new Date();
  const measurements = measurementsFrom({ reports, tests, practice: estimateScores(computeMastery(practiceOnly)) }, now);
  const prediction = predictScore(measurements, now);
  const basis = describeBasis(measurements, practiceOnly.length, now);
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

      {unfinished && (
        <section className={`${styles.testCard} surface`}>
          <div>
            <h2 className={styles.testTitle}>Pick up where you left off</h2>
            <p className={styles.muted}>
              {focusName(unfinished.focus)} set: {unfinishedAnswered} of {unfinished.questionIds.length} answered.
            </p>
          </div>
          <Link href={`/practice/${unfinished.id}`} className="button">
            Continue your set
          </Link>
        </section>
      )}

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

      <DailyGoal progress={daily} />
      <TimeZoneSync current={timeZoneCookie} />

      <section className={`${styles.testCard} surface`}>
        <div>
          <h2 className={styles.testTitle}>Full-length practice test</h2>
          <p className={styles.muted}>
            Ready to try the whole thing? Timed, adaptive, and scored out of 1600.
            {!testsAccess.allowed && " Comes with the season pass."}
          </p>
        </div>
        <Link href="/test" className="button secondary">
          Take a practice test
        </Link>
      </section>

      {(mistakeCount > 0 || flags.size > 0) && (
        <section className={`${styles.testCard} surface`}>
          <div>
            <h2 className={styles.testTitle}>Review</h2>
            <p className={styles.muted}>
              {mistakeCount} {mistakeCount === 1 ? "mistake" : "mistakes"} to retry
              {flags.size > 0 && ` · ${flags.size} flagged ${flags.size === 1 ? "question" : "questions"}`}
            </p>
          </div>
          <Link href="/review" className="button secondary">
            Review and retry
          </Link>
        </section>
      )}

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

      <h2>Predicted score</h2>
      <PredictionCard prediction={prediction} basis={basis} />

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

const SCALE = { min: 400, max: 1600 };

function PredictionCard({ prediction, basis }: { prediction: ScorePrediction; basis: string[] }) {
  const sections = [prediction.readingWriting, prediction.math].filter((p) => p !== null);
  if (!sections.length) {
    return (
      <section className={`${styles.predict} ${styles.predictEmpty} surface`}>
        <p>
          Take a full-length practice test, add a score you already have, or answer {MIN_ATTEMPTS_FOR_ESTIMATE} questions
          in each section, and we&apos;ll predict the range your score is likely to fall in.
        </p>
        <div className={styles.predictActions}>
          <Link href="/test" className="button small">
            Take a practice test
          </Link>
          <Link href="/scores" className="button small secondary">
            Add your scores
          </Link>
        </div>
      </section>
    );
  }
  const { total } = prediction;
  const pct = (x: number) => `${((x - SCALE.min) / (SCALE.max - SCALE.min)) * 100}%`;
  return (
    <section className={`${styles.predict} surface`}>
      <div className={styles.predictTotal}>
        <div className={styles.tileLabel}>Total</div>
        {total ? (
          <>
            <div className={styles.predictRange}>
              {total.low}–{total.high}
            </div>
            <div className={styles.muted}>Most likely around {total.score}</div>
            <div className={styles.scale} role="img" aria-label={`Predicted total ${total.low} to ${total.high} out of 1600`}>
              <div className={styles.scaleBand} style={{ left: pct(total.low), width: `calc(${pct(total.high)} - ${pct(total.low)})` }} />
              <div className={styles.scaleMark} style={{ left: pct(total.score) }} />
            </div>
            <div className={styles.scaleEnds} aria-hidden>
              <span>{SCALE.min}</span>
              <span>{SCALE.max}</span>
            </div>
          </>
        ) : (
          <>
            <div className={`${styles.predictRange} ${styles.tileValueEmpty}`}>–</div>
            <div className={styles.tileEmpty}>Needs a prediction for both sections</div>
          </>
        )}
      </div>
      <ul className={styles.predictSections}>
        {(["readingWriting", "math"] as const).map((key) => {
          const p = prediction[key];
          const section = key === "math" ? "math" : "reading-writing";
          return (
            <li key={key}>
              <span>{SECTION_NAMES[section]}</span>
              {p ? (
                <strong>
                  {p.low}–{p.high}
                </strong>
              ) : (
                <span className={styles.tileEmpty}>Not enough results yet</span>
              )}
            </li>
          );
        })}
      </ul>
      <p className={`${styles.muted} ${styles.predictBasis}`}>
        Based on {joinList(basis)}. Recent results and official scores count the most. The range is where your score is
        likely to land if you tested today; it&apos;s a practice guide, not an official prediction.
      </p>
    </section>
  );
}

function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
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
  if (focus.kind === "mistakes") return "My mistakes";
  if (focus.kind === "flagged") return "Flagged questions";
  return getSkill(focus.skill).skill.name;
}
