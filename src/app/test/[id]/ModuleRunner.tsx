"use client";

import { GridInInput } from "@/components/GridInInput";
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { CalculatorPanel } from "@/components/calculator/CalculatorPanel";
import questionStyles from "@/components/Question.module.css";
import { saveTestResponse, submitTestModule } from "../actions";
import styles from "../test.module.css";

export interface RunnerItem {
  id: string;
  /** Passages, table and stem, rendered on the server. */
  body: ReactNode;
  /** Empty for student-produced response. */
  choices: { label: string; text: ReactNode }[];
}

interface Response {
  answer: string;
  flagged: boolean;
}

interface Props {
  testId: string;
  index: number;
  title: string;
  /** Time left when the page was rendered. */
  remainingMs: number;
  items: RunnerItem[];
  initial: Record<string, Response>;
  /** Math reference sheet, shown on request. */
  reference?: ReactNode;
  /** Math modules: the graphing calculator, remembered under this key for the module. */
  calculator?: { storageKey: string; desmosApiKey?: string };
}

const WARN_MS = 5 * 60_000;

function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * One timed module, run in the browser. Answers and flags are saved to the
 * server as they change, so a refresh or a dropped connection loses nothing;
 * the server also enforces the clock. When time runs out the module is
 * submitted automatically.
 */
export function ModuleRunner({ testId, index, title, remainingMs, items, initial, reference, calculator }: Props) {
  const [current, setCurrent] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [showTimer, setShowTimer] = useState(true);
  const [showReference, setShowReference] = useState(false);
  const [responses, setResponses] = useState<Record<string, Response>>(initial);
  const [remaining, setRemaining] = useState(remainingMs);
  const [saveError, setSaveError] = useState(false);
  const [submitting, startSubmit] = useTransition();
  const pending = useRef<Promise<unknown>>(Promise.resolve());
  const submitted = useRef(false);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const submit = useCallback(() => {
    if (submitted.current) return;
    submitted.current = true;
    startSubmit(async () => {
      for (const t of timers.current.values()) clearTimeout(t);
      await pending.current;
      await submitTestModule(testId, index);
    });
  }, [testId, index]);

  useEffect(() => {
    const end = Date.now() + remainingMs;
    const tick = () => {
      const left = end - Date.now();
      setRemaining(left);
      if (left <= 0) submit();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [remainingMs, submit]);

  function persist(id: string, r: Response) {
    pending.current = pending.current
      .then(() => saveTestResponse(testId, id, r.answer, r.flagged))
      .then((result) => {
        if (!result.ok && result.error === "time-up") submit();
        setSaveError(!result.ok && result.error !== "time-up");
      })
      .catch(() => setSaveError(true));
  }

  function update(id: string, change: Partial<Response>, delay = 0) {
    const r = { ...(responses[id] ?? { answer: "", flagged: false }), ...change };
    setResponses((all) => ({ ...all, [id]: r }));
    clearTimeout(timers.current.get(id));
    if (delay === 0) persist(id, r);
    else timers.current.set(id, setTimeout(() => persist(id, r), delay));
  }

  function go(i: number) {
    setReviewing(false);
    setShowNav(false);
    setCurrent(i);
  }

  const item = items[current];
  const response = responses[item.id] ?? { answer: "", flagged: false };
  const answeredCount = items.filter((q) => responses[q.id]?.answer).length;
  const low = remaining <= WARN_MS;

  const navigator = (
    <div className={styles.navGrid}>
      {items.map((q, i) => {
        const r = responses[q.id];
        return (
          <button
            key={q.id}
            type="button"
            onClick={() => go(i)}
            className={`${styles.navCell} ${r?.answer ? styles.navAnswered : ""} ${!reviewing && i === current ? styles.navCurrent : ""}`}
            aria-label={`Question ${i + 1}${r?.answer ? ", answered" : ", unanswered"}${r?.flagged ? ", marked for review" : ""}`}
          >
            {i + 1}
            {r?.flagged && <span className={styles.navFlag} aria-hidden />}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className={styles.runner}>
      <div className={styles.topBar}>
        <div className={styles.moduleTitle}>{title}</div>
        <div className={styles.timerBox}>
          {showTimer ? (
            <span className={`${styles.timer} ${low ? styles.timerLow : ""}`} role="timer" aria-live={low ? "polite" : "off"}>
              {clock(remaining)}
            </span>
          ) : (
            <span className={styles.timerHidden}>Timer hidden</span>
          )}
          <button type="button" className="link-button" onClick={() => setShowTimer((v) => !v)}>
            {showTimer ? "Hide" : "Show"}
          </button>
        </div>
        <div className={styles.topTools}>
          {calculator && <CalculatorPanel variant="link" storageKey={calculator.storageKey} desmosApiKey={calculator.desmosApiKey} />}
          {reference && (
            <button type="button" className="link-button" onClick={() => setShowReference((v) => !v)}>
              {showReference ? "Close reference" : "Reference"}
            </button>
          )}
        </div>
      </div>

      {showReference && reference && <div className={styles.reference}>{reference}</div>}
      {saveError && <p className="notice bad">Your last answer didn&apos;t save. Check your connection; it will retry when you change an answer.</p>}

      {reviewing ? (
        <section className={styles.reviewPage}>
          <h2>Check your work</h2>
          <p className={styles.muted}>
            You&apos;ve answered {answeredCount} of {items.length} questions. Pick a question to go back to it. Once you submit
            this module you can&apos;t return to it.
          </p>
          {navigator}
          <p className={styles.legend}>
            <span className={`${styles.navCell} ${styles.navAnswered}`} aria-hidden /> Answered
            <span className={styles.navCell} aria-hidden /> Unanswered
            <span className={styles.navCell} aria-hidden>
              <span className={styles.navFlag} />
            </span>{" "}
            For review
          </p>
          <button type="button" className="button" onClick={submit} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit module"}
          </button>
        </section>
      ) : (
        <section className={styles.question} key={item.id}>
          <div className={styles.questionHead}>
            <span className={styles.number}>{current + 1}</span>
            <label className={styles.flag}>
              <input type="checkbox" checked={response.flagged} onChange={(e) => update(item.id, { flagged: e.target.checked })} />
              Mark for review
            </label>
          </div>
          {item.body}
          {item.choices.length > 0 ? (
            <fieldset className={questionStyles.choices}>
              <legend className={questionStyles.hidden}>Choices</legend>
              {item.choices.map((c) => (
                <label key={c.label} className={questionStyles.choice}>
                  <input
                    type="radio"
                    name={`answer-${item.id}`}
                    value={c.label}
                    checked={response.answer === c.label}
                    onChange={() => update(item.id, { answer: c.label })}
                    className={questionStyles.radio}
                  />
                  <span className={questionStyles.letter}>{c.label}</span>
                  <span className={questionStyles.choiceText}>{c.text}</span>
                </label>
              ))}
            </fieldset>
          ) : (
            <label className={questionStyles.spr}>
              Your answer
              <GridInInput value={response.answer} onValueChange={(v) => update(item.id, { answer: v }, 600)} />
              <span className={questionStyles.hint}>Enter a number, fraction (like 7/4) or decimal. Negative answers start with -.</span>
            </label>
          )}
        </section>
      )}

      <div className={styles.bottomBar}>
        {showNav && !reviewing && <div className={styles.navPopover}>{navigator}</div>}
        {reviewing ? (
          <span />
        ) : (
          <button type="button" className="button secondary small" onClick={() => setShowNav((v) => !v)} aria-expanded={showNav}>
            Question {current + 1} of {items.length} {showNav ? "▴" : "▾"}
          </button>
        )}
        <div className={styles.bottomActions}>
          <button
            type="button"
            className="button secondary small"
            onClick={() => (reviewing ? go(items.length - 1) : go(current - 1))}
            disabled={!reviewing && current === 0}
          >
            Back
          </button>
          {!reviewing && (
            <button
              type="button"
              className="button small"
              onClick={() => (current === items.length - 1 ? (setReviewing(true), setShowNav(false)) : go(current + 1))}
            >
              {current === items.length - 1 ? "Review answers" : "Next"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
