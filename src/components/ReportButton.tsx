"use client";

import { useRef, useState, useTransition } from "react";
import { reportQuestion } from "@/app/practice/actions";
import { MAX_DETAILS, REPORT_REASONS } from "@/lib/trainer/report-reasons";
import { FlagButton } from "./FlagButton";
import flagStyles from "./FlagButton.module.css";
import styles from "./ReportButton.module.css";

const ERRORS: Record<string, string> = {
  "needs-details": "Please say what's wrong in the box.",
  "too-many": "You've sent a lot of reports in the last hour. Please try again later.",
  "not-found": "This question can't be reported right now.",
};

/**
 * "Report a problem" on a question: opens a short form (what's wrong, plus an
 * optional note) and saves it without leaving the page, so a half-picked
 * answer isn't lost. Reports are reviewed on /admin/reports.
 */
export function ReportButton({ questionId }: { questionId: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function open() {
    setError(null);
    dialog.current?.showModal();
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const reason = form.get("reason");
    if (typeof reason !== "string") {
      setError("Pick what's wrong first.");
      return;
    }
    const details = String(form.get("details") ?? "");
    const target = event.currentTarget;
    setError(null);
    start(async () => {
      const result = await reportQuestion(questionId, reason, details).catch(() => null);
      if (result?.ok) {
        setSent(true);
        target.reset();
      } else {
        setError((result && ERRORS[result.error]) ?? "Couldn't send. Try again.");
      }
    });
  }

  return (
    <>
      <button type="button" className={`${flagStyles.flag} ${styles.report}`} onClick={open}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden focusable="false">
          <circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 4.6v4.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="8" cy="11.2" r="0.95" fill="currentColor" />
        </svg>
        {sent ? "Reported" : "Report a problem"}
      </button>
      <dialog ref={dialog} className={styles.dialog} aria-labelledby={`report-${questionId}`} onClose={() => setSent(false)}>
        {sent ? (
          <div className={styles.thanks}>
            <h2 id={`report-${questionId}`}>Thanks for telling us</h2>
            <p>We&apos;ll check this question and fix it if something is wrong.</p>
            <div className={styles.buttons}>
              <button type="button" className="button" onClick={() => dialog.current?.close()}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h2 id={`report-${questionId}`}>Report a problem</h2>
            <fieldset className={styles.reasons}>
              <legend>What&apos;s wrong with this question?</legend>
              {REPORT_REASONS.map((r) => (
                <label key={r.id} className={styles.reason}>
                  <input type="radio" name="reason" value={r.id} required />
                  {r.label}
                </label>
              ))}
            </fieldset>
            <label className={styles.details}>
              Tell us more <span className={styles.muted}>(optional, unless you picked &quot;Something else&quot;)</span>
              <textarea name="details" rows={3} maxLength={MAX_DETAILS} placeholder="For example: I think the answer is C because..." />
            </label>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <div className={styles.buttons}>
              <button type="button" className="button secondary" onClick={() => dialog.current?.close()}>
                Cancel
              </button>
              <button type="submit" className="button" disabled={pending}>
                {pending ? "Sending..." : "Send report"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}

/** The buttons shown above a question: flag for review and report a problem. */
export function QuestionActions({ questionId, flagged }: { questionId: string; flagged: boolean }) {
  return (
    <span className={styles.group}>
      <FlagButton questionId={questionId} initial={flagged} />
      <ReportButton questionId={questionId} />
    </span>
  );
}
