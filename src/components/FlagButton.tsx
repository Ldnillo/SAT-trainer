"use client";

import { useState, useTransition } from "react";
import { flagQuestion } from "@/app/practice/actions";
import styles from "./FlagButton.module.css";

/**
 * Flags a question to come back to on the Review page. Saves without leaving
 * the page, so a half-picked answer isn't lost.
 */
export function FlagButton({ questionId, initial }: { questionId: string; initial: boolean }) {
  const [flagged, setFlagged] = useState(initial);
  const [failed, setFailed] = useState(false);
  const [, start] = useTransition();

  function toggle() {
    const next = !flagged;
    setFlagged(next);
    setFailed(false);
    start(async () => {
      const ok = await flagQuestion(questionId, next).catch(() => false);
      if (!ok) {
        setFlagged(!next);
        setFailed(true);
      }
    });
  }

  return (
    <span className={styles.wrap}>
      <button type="button" className={`${styles.flag} ${flagged ? styles.on : ""}`} aria-pressed={flagged} onClick={toggle}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden focusable="false">
          <path d="M3 1.5v13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M3.8 2.2h8.7l-2 3.3 2 3.3H3.8z" fill={flagged ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
        {flagged ? "Flagged for review" : "Flag for review"}
      </button>
      {failed && <span className={styles.error}>Couldn&apos;t save. Try again.</span>}
    </span>
  );
}
