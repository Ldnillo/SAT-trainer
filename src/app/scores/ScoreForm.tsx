"use client";

import { useActionState } from "react";
import { DOMAINS, SECTION_NAMES, SECTIONS } from "@/lib/sat/taxonomy";
import { MAX_BAND, REPORT_KINDS } from "@/lib/trainer/score-report";
import { saveScoreReport, type ScoreFormState } from "./actions";
import styles from "./scores.module.css";

const INITIAL: ScoreFormState = { errors: [], values: {}, attempt: 0 };

export function ScoreForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(saveScoreReport, INITIAL);
  const v = state.values;
  const hasSkillValues = Object.keys(v).some((k) => (k.startsWith("correct-") || k.startsWith("total-")) && v[k]);

  return (
    <form key={state.attempt} action={action} className={styles.form}>
      {state.errors.length > 0 && (
        <div className="notice bad" role="alert">
          <div>
            <p>
              <strong>Please fix {state.errors.length === 1 ? "this" : "these"}:</strong>
            </p>
            <ul>
              {state.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <fieldset className={styles.step}>
        <legend>1. Which test was it?</legend>
        <div className={styles.choices}>
          {(Object.keys(REPORT_KINDS) as (keyof typeof REPORT_KINDS)[]).map((kind) => (
            <label key={kind} className={styles.choice}>
              <input type="radio" name="kind" value={kind} defaultChecked={(v.kind ?? "official") === kind} />
              {REPORT_KINDS[kind]}
            </label>
          ))}
        </div>
        <label className={styles.field}>
          Test date
          <input type="date" name="testDate" min="2023-01-01" max={today} defaultValue={v.testDate} required />
        </label>
      </fieldset>

      <fieldset className={styles.step}>
        <legend>2. Section scores</legend>
        <p className={styles.muted}>The two big numbers on your results, each from 200 to 800. Leave one blank if you don&apos;t have it.</p>
        <div className={styles.sectionScores}>
          {SECTIONS.map((section) => (
            <label key={section} className={styles.field}>
              {SECTION_NAMES[section]}
              <input
                type="number"
                name={`score-${section}`}
                min={200}
                max={800}
                step={10}
                inputMode="numeric"
                placeholder="e.g. 620"
                defaultValue={v[`score-${section}`]}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.step}>
        <legend>3. Content areas</legend>
        <p className={styles.muted}>
          Your results show a row of boxes next to each content area, with some filled in. Click the box that matches
          how many are filled. More filled boxes means you did better in that area. Skip any you can&apos;t see.
        </p>
        {SECTIONS.map((section) => (
          <div key={section} className={styles.bandGroup}>
            <h3>{SECTION_NAMES[section]}</h3>
            {DOMAINS.filter((d) => d.section === section).map((d) => (
              <div key={d.id} className={styles.bandRow} role="radiogroup" aria-label={`${d.name}: filled boxes`}>
                <span className={styles.bandName}>{d.name}</span>
                <span className={styles.bands}>
                  {Array.from({ length: MAX_BAND }, (_, i) => i + 1).map((n) => (
                    <label key={n} className={styles.band} title={`${n} of ${MAX_BAND} boxes filled`}>
                      <input type="radio" name={`band-${d.id}`} value={n} defaultChecked={v[`band-${d.id}`] === String(n)} />
                      <span aria-hidden />
                      <span className={styles.srOnly}>{n}</span>
                    </label>
                  ))}
                  <label className={styles.bandSkip}>
                    <input type="radio" name={`band-${d.id}`} value="" defaultChecked={!v[`band-${d.id}`]} />
                    Not sure
                  </label>
                </span>
              </div>
            ))}
          </div>
        ))}
      </fieldset>

      <details className={styles.step} open={hasSkillValues}>
        <summary>4. Skill by skill (optional, for Bluebook practice tests)</summary>
        <p className={styles.muted}>
          A practice test&apos;s question review lists every question with its skill and whether you got it right. Count
          them up for any skills you like. This is the most precise way to point your practice at the right skills.
        </p>
        {DOMAINS.map((d) => (
          <div key={d.id} className={styles.skillGroup}>
            <h3>{d.name}</h3>
            {d.skills.map((s) => (
              <div key={s.id} className={styles.skillRow}>
                <span>{s.name}</span>
                <span className={styles.skillInputs}>
                  <input
                    type="number"
                    name={`correct-${s.id}`}
                    min={0}
                    max={30}
                    inputMode="numeric"
                    aria-label={`${s.name}: number right`}
                    defaultValue={v[`correct-${s.id}`]}
                  />
                  <span className={styles.muted}>right out of</span>
                  <input
                    type="number"
                    name={`total-${s.id}`}
                    min={1}
                    max={30}
                    inputMode="numeric"
                    aria-label={`${s.name}: number of questions`}
                    defaultValue={v[`total-${s.id}`]}
                  />
                </span>
              </div>
            ))}
          </div>
        ))}
      </details>

      <button type="submit" className="button large" disabled={pending}>
        {pending ? "Saving..." : "Save scores"}
      </button>
    </form>
  );
}
