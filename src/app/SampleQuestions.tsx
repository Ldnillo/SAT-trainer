"use client";

import Link from "next/link";
import { useState } from "react";
import q from "@/components/Question.module.css";
import { isCorrect } from "@/lib/trainer/answers";
import type { QuestionContent } from "@/lib/sat/question";
import styles from "./home.module.css";

/** One sample question with its text already rendered on the server (KaTeX stays off the client). */
export interface RenderedSample {
  id: string;
  section: string;
  skill: string;
  difficulty: string;
  content: QuestionContent;
  body: React.ReactNode;
  choices: { label: string; text: React.ReactNode }[];
  rationales: Record<string, React.ReactNode>;
  explanation: React.ReactNode;
}

/** Home page "try a question": pick a sample, answer it, see the explanation. Nothing is saved. */
export function SampleQuestions({ samples, ctaHref, ctaLabel }: { samples: RenderedSample[]; ctaHref: string; ctaLabel: string }) {
  const [index, setIndex] = useState(0);
  const sample = samples[index];
  return (
    <div className={styles.samples}>
      <div className={styles.sampleTabs} role="tablist" aria-label="Sample questions">
        {samples.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            id={`sample-tab-${s.id}`}
            aria-selected={i === index}
            aria-controls="sample-panel"
            className={styles.sampleTab}
            onClick={() => setIndex(i)}
          >
            <span>{s.skill}</span>
            <small>{s.section}</small>
          </button>
        ))}
      </div>
      <div id="sample-panel" role="tabpanel" aria-labelledby={`sample-tab-${sample.id}`} className={`${styles.samplePanel} surface`}>
        {/* Keyed so switching questions clears the previous answer. */}
        <SampleQuestion key={sample.id} sample={sample} ctaHref={ctaHref} ctaLabel={ctaLabel} />
      </div>
    </div>
  );
}

function SampleQuestion({ sample, ctaHref, ctaLabel }: { sample: RenderedSample; ctaHref: string; ctaLabel: string }) {
  const [answer, setAnswer] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const { content } = sample;
  const grid = content.choices.length === 0;
  const correct = answer !== null && isCorrect(content, answer);

  return (
    <>
      <p className={styles.sampleMeta}>
        {sample.section} · {sample.skill} · <span className={styles.capitalize}>{sample.difficulty}</span>
      </p>
      {sample.body}

      {grid ? (
        answer === null ? (
          <form
            className={styles.sampleGrid}
            onSubmit={(e) => {
              e.preventDefault();
              if (typed.trim()) setAnswer(typed.trim());
            }}
          >
            <label className={q.spr}>
              Your answer
              <input
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                inputMode="decimal"
                maxLength={10}
              />
              <span className={q.hint}>Enter a number, fraction (like 7/4) or decimal.</span>
            </label>
            <button type="submit" className="button" disabled={!typed.trim()}>
              Check answer
            </button>
          </form>
        ) : (
          <p className={q.sprReview}>
            Your answer: <strong>{answer}</strong>
            <span className={q.muted}> · Accepted answers: {content.acceptedAnswers.join(", ")}</span>
          </p>
        )
      ) : (
        <div className={q.choices} role="group" aria-label="Choices">
          {sample.choices.map((c) => {
            const isKey = c.label === content.correctChoice;
            const isPicked = c.label === answer;
            const state = answer === null ? "" : isKey ? q.right : isPicked ? q.wrong : "";
            return (
              <button
                key={c.label}
                type="button"
                className={`${q.choice} ${styles.sampleChoice} ${state}`}
                disabled={answer !== null}
                aria-pressed={isPicked}
                onClick={() => setAnswer(c.label)}
              >
                <span className={q.letter}>{c.label}</span>
                <span className={q.choiceText}>{c.text}</span>
                {answer !== null && (isKey || isPicked) && (
                  <span className={q.tags}>
                    {isPicked && <span className="badge plain">Your answer</span>}
                    {isKey && <span className="badge ok plain">Correct answer</span>}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {answer === null ? (
        <p className={styles.sampleHint}>Pick an answer to see the explanation.</p>
      ) : (
        <>
          <div className={correct ? q.feedbackRight : q.feedbackWrong} aria-live="polite">
            <strong className={q.verdict}>
              <span aria-hidden className={q.verdictIcon}>
                {correct ? "✓" : "✕"}
              </span>
              {correct ? "Correct." : "Not quite."}
            </strong>
            {!correct && sample.rationales[answer] && <p>{sample.rationales[answer]}</p>}
            <p>{sample.explanation}</p>
          </div>
          <div className={styles.sampleActions}>
            <Link href={ctaHref} className="button">
              {ctaLabel}
            </Link>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setAnswer(null);
                setTyped("");
              }}
            >
              Try it again
            </button>
          </div>
        </>
      )}
    </>
  );
}
