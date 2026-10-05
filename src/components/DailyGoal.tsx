import { updateDailyGoal } from "@/app/dashboard/actions";
import { GOAL_CHOICES, type DailyProgress } from "@/lib/trainer/streak";
import styles from "./DailyGoal.module.css";

/** Today's progress toward the daily goal, the practice streak, and the last seven days. */
export function DailyGoal({ progress }: { progress: DailyProgress }) {
  const { goal, today, goalMet, streak, streakAtRisk, longestStreak, week } = progress;
  const left = goal - today;
  return (
    <section className={`${styles.card} surface`} aria-labelledby="daily-goal-title">
      <div className={styles.goal}>
        <h2 id="daily-goal-title" className={styles.title}>
          Today&apos;s goal
        </h2>
        <p className={styles.count}>
          <strong>{today}</strong> of {goal} questions
        </p>
        <div
          className={`${styles.bar} ${goalMet ? styles.barDone : ""}`}
          role="progressbar"
          aria-label="Questions answered today"
          aria-valuemin={0}
          aria-valuemax={goal}
          aria-valuenow={Math.min(today, goal)}
        >
          <div style={{ width: `${Math.min(today / goal, 1) * 100}%` }} />
        </div>
        <p className={styles.muted}>
          {goalMet
            ? "Goal reached. Nice work!"
            : today === 0
              ? `Answer ${goal} questions today to reach your goal.`
              : `${left} more ${left === 1 ? "question" : "questions"} to reach today's goal.`}
        </p>
      </div>

      <div className={styles.streak}>
        <div className={`${styles.streakValue} ${streak > 0 && !streakAtRisk ? styles.lit : ""}`}>
          <Flame />
          <span>{streak}</span>
        </div>
        <div className={styles.streakLabel}>day streak</div>
        <p className={styles.muted}>
          {streakAtRisk
            ? "Answer a question today to keep your streak going."
            : streak === 0
              ? "Answer a question to start a streak."
              : `Best: ${longestStreak} ${longestStreak === 1 ? "day" : "days"}`}
        </p>
      </div>

      <ol className={styles.week} aria-label="The last 7 days">
        {week.map((d, i) => {
          const state = d.goalMet ? "met" : d.answered > 0 ? "practiced" : "none";
          const label = new Date(`${d.day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
          return (
            <li key={d.day} className={styles[state]}>
              <span className={styles.dot} aria-hidden>
                {d.goalMet ? <Check /> : null}
              </span>
              <span className={styles.weekday} aria-hidden>
                {i === week.length - 1 ? "Today" : label.slice(0, 3)}
              </span>
              <span className={styles.srOnly}>
                {i === week.length - 1 ? "Today" : label}: {d.answered} {d.answered === 1 ? "question" : "questions"}
                {d.goalMet ? ", goal reached" : ""}
              </span>
            </li>
          );
        })}
      </ol>

      <details className={styles.change}>
        <summary>Change daily goal</summary>
        <form action={updateDailyGoal} className={styles.choices}>
          <fieldset>
            <legend className={styles.srOnly}>Questions per day</legend>
            {GOAL_CHOICES.map((n) => (
              <label key={n} className={styles.choice}>
                <input type="radio" name="goal" value={n} defaultChecked={n === goal} />
                <span>{n} a day</span>
              </label>
            ))}
          </fieldset>
          <button type="submit" className="button small">
            Save
          </button>
        </form>
      </details>
    </section>
  );
}

function Flame() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2c.6 3.2-1 5.3-2.6 7.2C8 10.9 6.5 12.6 6.5 15.3 6.5 18.9 9 22 12 22s5.5-2.6 5.5-6.3c0-2.6-1.3-4.4-2.3-5.6-.3 1.6-1.1 2.7-2.2 3.2.4-2.9-.1-7.4-1-11.3Zm.2 12.6c1.3 1.2 2.1 2.3 2.1 3.6 0 1.6-1 2.8-2.3 2.8s-2.3-1.1-2.3-2.6c0-1.5 1-2.6 2.5-3.8Z"
      />
    </svg>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="m3.5 8.5 3 3 6-7" />
    </svg>
  );
}
