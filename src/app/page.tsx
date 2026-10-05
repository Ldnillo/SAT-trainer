import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { MathText } from "@/components/MathText";
import { QuestionBody } from "@/components/Question";
import { currentUser } from "@/lib/auth/session";
import { BEST_VALUE_PLAN_ID, findPlan, formatPriceShort, PASS_PLANS, passConfig, percentOff } from "@/lib/billing/config";
import { sampleQuestions } from "@/lib/home/samples";
import dashboardDark from "@/assets/home/dashboard-dark.png";
import dashboardLight from "@/assets/home/dashboard-light.png";
import practiceDark from "@/assets/home/practice-dark.png";
import practiceLight from "@/assets/home/practice-light.png";
import testDark from "@/assets/home/test-dark.png";
import testLight from "@/assets/home/test-light.png";
import styles from "./home.module.css";
import { SampleQuestions, type RenderedSample } from "./SampleQuestions";

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

// Real screenshots of the signed-in site, in both themes. Retake them when these pages change.
const SCREENSHOTS: { title: string; body: string; alt: string; light: StaticImageData; dark: StaticImageData }[] = [
  {
    title: "Tailored practice sets",
    body: "Answer a question and the explanation appears right away, including why the choice you picked is wrong.",
    alt: "A NextScore practice question after answering, with the correct answer marked and a step-by-step explanation",
    light: practiceLight,
    dark: practiceDark,
  },
  {
    title: "A dashboard that tracks every skill",
    body: "Estimated section scores, your progress over time and your mastery of all 30 skills in one place.",
    alt: "The NextScore dashboard showing estimated scores and skill mastery bars",
    light: dashboardLight,
    dark: dashboardDark,
  },
  {
    title: "Full-length adaptive practice tests",
    body: "Timed modules that adapt like the real digital test, with a calculator, a reference sheet and a question navigator.",
    alt: "A NextScore full-length practice test question with the module timer and navigator",
    light: testLight,
    dark: testDark,
  },
];

function renderSamples(): RenderedSample[] {
  return sampleQuestions().map((s) => ({
    ...s,
    body: <QuestionBody content={s.content} />,
    choices: s.content.choices.map((c) => ({ label: c.label, text: <MathText text={c.text} /> })),
    rationales: Object.fromEntries(s.content.distractorRationales.map((r) => [r.label, <MathText key={r.label} text={r.text} />])),
    explanation: <MathText text={s.content.explanation} />,
  }));
}

// Example data for the hero preview; not a real student's results.
const PREVIEW_SKILLS = [
  { name: "Transitions", pct: 86 },
  { name: "Linear equations", pct: 72 },
  { name: "Inferences", pct: 54 },
  { name: "Nonlinear functions", pct: 38 },
];

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const user = await currentUser();
  const config = passConfig();
  const best = findPlan(BEST_VALUE_PLAN_ID)!;
  const freeSets =
    config.freeSets === 1 ? "Your first practice set is free" : `Your first ${config.freeSets} practice sets are free`;

  return (
    <main className={styles.home}>
      {params.deleted && <p className={styles.deleted}>Your account and its data have been deleted.</p>}
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
            {user ? (
              <Link href="/dashboard" className="button large">
                Go to your dashboard
              </Link>
            ) : (
              <>
                <Link href="/signup" className="button large">
                  Start practicing free
                </Link>
                <Link href="/login" className="button large secondary">
                  Sign in
                </Link>
              </>
            )}
            <a href="#try" className="button large secondary">
              Try a question
            </a>
          </div>
          {!user && config.freeSets > 0 && <p className={styles.note}>{freeSets}. No card needed.</p>}
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

      <section className={styles.section} id="try">
        <h2>Try a real NextScore question</h2>
        <p className={styles.sectionLede}>
          These come straight from the question bank students practice with. Pick one, answer it, and see the explanation.
        </p>
        <SampleQuestions
          samples={renderSamples()}
          ctaHref={user ? "/dashboard" : "/signup"}
          ctaLabel={user ? "Practice more" : "Practice more free"}
        />
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
        <h2>See what you get</h2>
        <div className={styles.shots}>
          {SCREENSHOTS.map((shot) => (
            <figure key={shot.title} className={styles.shot}>
              <div className={styles.shotFrame}>
                <Image
                  src={shot.light}
                  alt={shot.alt}
                  className={styles.shotLight}
                  sizes="(max-width: 860px) 100vw, 640px"
                  placeholder="blur"
                />
                <Image
                  src={shot.dark}
                  alt={shot.alt}
                  className={styles.shotDark}
                  sizes="(max-width: 860px) 100vw, 640px"
                  placeholder="blur"
                />
              </div>
              <figcaption>
                <h3>{shot.title}</h3>
                <p>{shot.body}</p>
              </figcaption>
            </figure>
          ))}
        </div>
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
              {formatPriceShort(best.priceCents, config.currency)} for {best.days} days{" "}
              <s className={styles.muted}>{formatPriceShort(best.listPriceCents, config.currency)}</s>
            </h2>
            <p className={styles.muted}>
              {percentOff(best)}% off. Or choose a shorter pass:{" "}
              {PASS_PLANS.filter((p) => p.id !== best.id)
                .map((p) => `${formatPriceShort(p.priceCents, config.currency)} for ${p.days} days`)
                .join(", ")}
              . One payment, no subscription. Try it free before you buy.
            </p>
          </div>
          <ul className="check-list">
            <li>Unlimited tailored practice across all 30 skills</li>
            <li>Skill mastery tracking and estimated section scores</li>
            <li>Explanations for every answer</li>
          </ul>
          <Link href={user ? "/pass" : "/signup"} className="button large">
            {user ? "Get the pass" : "Start free"}
          </Link>
        </div>
      </section>
    </main>
  );
}
