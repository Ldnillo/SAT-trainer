import Link from "next/link";
import { formatPrice, passConfig } from "@/lib/billing/config";
import styles from "./home.module.css";

const STEPS = [
  {
    title: "Practice",
    body: "Answer short sets of digital SAT style questions in Reading and Writing and Math.",
  },
  {
    title: "Get a read on every skill",
    body: "Each answer updates your mastery of all 30 skills the test covers, from transitions to systems of equations.",
  },
  {
    title: "Focus where points are",
    body: "Your next set leans on your weakest, most heavily tested skills, at the difficulty that stretches you.",
  },
];

const FEATURES = [
  {
    title: "Original questions",
    body: "Every passage and question is written for NextScore to match the digital SAT format. Nothing is copied from real tests.",
  },
  {
    title: "Explanations for every answer",
    body: "See why the right answer works and why each wrong choice is tempting, right after you answer.",
  },
  {
    title: "Score estimates that move",
    body: "Your estimated section scores update after every set, so you can watch your progress add up.",
  },
  {
    title: "Built for the whole season",
    body: "One payment covers months of unlimited practice. No subscription to remember to cancel.",
  },
];

// Example data for the hero preview; not a real student's results.
const PREVIEW_SKILLS = [
  { name: "Transitions", pct: 86 },
  { name: "Linear equations", pct: 72 },
  { name: "Inferences", pct: 54 },
  { name: "Nonlinear functions", pct: 38 },
];

export default function Home() {
  const config = passConfig();
  const price = formatPrice(config.priceCents, config.currency).replace(/\.00$/, "");
  const freeSets =
    config.freeSets === 1 ? "Your first practice set is free" : `Your first ${config.freeSets} practice sets are free`;

  return (
    <main className={styles.home}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>Digital SAT practice</p>
          <h1 className={styles.headline}>
            Practice smarter. <span>Raise your next score.</span>
          </h1>
          <p className={styles.lede}>
            NextScore finds the skills where you can gain the most points and builds every practice set around them.
          </p>
          <div className={styles.ctas}>
            <Link href="/signup" className="button large">
              Start practicing free
            </Link>
            <Link href="/login" className="button large secondary">
              Sign in
            </Link>
          </div>
          {config.freeSets > 0 && <p className={styles.note}>{freeSets}. No card needed.</p>}
        </div>

        <figure className={`${styles.preview} surface`} aria-label="Example of a NextScore dashboard">
          <figcaption className={styles.previewLabel}>Example dashboard</figcaption>
          <div className={styles.previewScores}>
            <div>
              <span>Reading and Writing</span>
              <strong>640</strong>
            </div>
            <div>
              <span>Math</span>
              <strong>610</strong>
            </div>
            <div className={styles.previewTotal}>
              <span>Total</span>
              <strong>1250</strong>
            </div>
          </div>
          <div className={styles.previewSkills}>
            {PREVIEW_SKILLS.map((s) => (
              <div key={s.name} className={styles.previewSkill}>
                <span>{s.name}</span>
                <div className={styles.bar}>
                  <div style={{ width: `${s.pct}%` }} data-low={s.pct < 60 || undefined} />
                </div>
              </div>
            ))}
          </div>
          <div className={styles.previewNext}>Next set: Nonlinear functions and Inferences</div>
        </figure>
      </section>

      <section className={styles.section}>
        <h2>How it works</h2>
        <ol className={styles.steps}>
          {STEPS.map((step, i) => (
            <li key={step.title} className="surface">
              <span className={styles.stepNumber}>{i + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.section}>
        <h2>Why NextScore</h2>
        <div className={styles.features}>
          {FEATURES.map((f) => (
            <div key={f.title} className={styles.feature}>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={`${styles.pricing} surface`}>
          <div>
            <p className={styles.eyebrow}>Season pass</p>
            <h2 className={styles.pricingTitle}>
              {price} for {config.days} days
            </h2>
            <p className={styles.muted}>One payment, no subscription. Try it free before you buy.</p>
          </div>
          <ul className="check-list">
            <li>Unlimited tailored practice across all 30 skills</li>
            <li>Skill mastery tracking and estimated section scores</li>
            <li>Explanations for every answer</li>
          </ul>
          <Link href="/signup" className="button large">
            Start free
          </Link>
        </div>
      </section>
    </main>
  );
}
