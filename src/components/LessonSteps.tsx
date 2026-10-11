"use client";

import { useState } from "react";
import styles from "./LessonSteps.module.css";

export interface RenderedStep {
  name: string;
  /** Server-rendered step text (math already typeset). */
  body: React.ReactNode;
}

/** Worked example that reveals one step at a time, with Next, Back and Reveal all. */
export function LessonSteps({ steps }: { steps: RenderedStep[] }) {
  const [shown, setShown] = useState(1);
  const last = steps.length;

  return (
    <div className={styles.wrap}>
      <ol className={styles.steps} aria-live="polite">
        {steps.slice(0, shown).map((step, i) => (
          <li key={i} className={`${styles.step} ${i === shown - 1 ? styles.current : ""}`}>
            <span className={styles.num} aria-hidden>
              {i + 1}
            </span>
            <div>
              <strong className={styles.name}>{step.name}</strong>
              <p className={styles.body}>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className={styles.controls}>
        <button type="button" className="button secondary small" onClick={() => setShown((n) => Math.max(1, n - 1))} disabled={shown <= 1}>
          Back
        </button>
        <button type="button" className="button small" onClick={() => setShown((n) => Math.min(last, n + 1))} disabled={shown >= last}>
          Next step
        </button>
        <button type="button" className="button secondary small" onClick={() => setShown(shown >= last ? 1 : last)}>
          {shown >= last ? "Start over" : "Reveal all steps"}
        </button>
        <span className={styles.count}>
          Step {shown} of {last}
        </span>
      </div>
    </div>
  );
}
