"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import styles from "./ReferencePanel.module.css";

const OPEN_KEY = "nextscore-reference-open";
const OPEN_EVENT = "nextscore-reference-open";

/** Whether the sheet is open lives in session storage, so it stays open from one question to the next. */
function subscribeOpen(callback: () => void) {
  window.addEventListener(OPEN_EVENT, callback);
  return () => window.removeEventListener(OPEN_EVENT, callback);
}

function readOpen(): boolean {
  try {
    return sessionStorage.getItem(OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * A "Formulas" button for math practice questions that opens the formula
 * reference sheet under the question tools.
 */
export function ReferencePanel({ children }: { children: ReactNode }) {
  const open = useSyncExternalStore(subscribeOpen, readOpen, () => false);

  function toggle() {
    try {
      sessionStorage.setItem(OPEN_KEY, open ? "0" : "1");
    } catch {
      // No storage: the sheet can't open. Rare enough (storage blocked entirely) to accept.
    }
    window.dispatchEvent(new Event(OPEN_EVENT));
  }

  return (
    <>
      <button type="button" className={`button secondary small ${styles.openButton}`} onClick={toggle} aria-expanded={open} aria-controls="reference-sheet">
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden focusable="false">
          <path d="M3 2.5h7.5L13 5v8.5H3z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M5.5 7h5M5.5 9.5h5M5.5 12h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        {open ? "Close formulas" : "Formulas"}
      </button>
      {open && (
        <section id="reference-sheet" className={`${styles.panel} surface`} aria-label="Formula reference">
          {children}
        </section>
      )}
    </>
  );
}
