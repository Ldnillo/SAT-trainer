"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import styles from "./Calculator.module.css";

// The calculator's math library is big, so it only loads when a student opens the calculator.
const GraphingCalculator = dynamic(() => import("./GraphingCalculator"), {
  ssr: false,
  loading: () => <p className={styles.loading}>Loading calculator...</p>,
});
const DesmosCalculator = dynamic(() => import("./DesmosCalculator"), {
  ssr: false,
  loading: () => <p className={styles.loading}>Loading calculator...</p>,
});

interface Props {
  /** Where the calculator remembers its lines, such as one practice set or one test module. */
  storageKey: string;
  /** With a Desmos API key (DESMOS_API_KEY), the Desmos calculator is used instead of the built-in one. */
  desmosApiKey?: string;
  /** Button style: "link" in the test's top bar, a small button elsewhere. */
  variant?: "link" | "button";
}

/**
 * A "Calculator" button that opens a graphing calculator in a panel over the
 * page. On a computer the panel can be dragged by its title bar and made
 * larger; on a phone it slides up from the bottom. It stays open, with its
 * lines, from one question to the next.
 */
const OPEN_KEY = "nextscore-calculator-open";
const OPEN_EVENT = "nextscore-calculator-open";

/** Whether the calculator is open lives in session storage, so it stays open from one question to the next. */
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

export function CalculatorPanel({ storageKey, desmosApiKey, variant = "button" }: Props) {
  const open = useSyncExternalStore(subscribeOpen, readOpen, () => false);
  const [wide, setWide] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  // On a wide screen the page moves over so the calculator sits beside the question instead of on top of it (see globals.css).
  useEffect(() => {
    const root = document.documentElement;
    if (open && !wide && !pos) root.dataset.calculator = "docked";
    else delete root.dataset.calculator;
    return () => {
      delete root.dataset.calculator;
    };
  }, [open, wide, pos]);

  function toggle(next = !open) {
    try {
      sessionStorage.setItem(OPEN_KEY, next ? "1" : "0");
    } catch {
      // No storage: the calculator can't open. Rare enough (storage blocked entirely) to accept.
    }
    window.dispatchEvent(new Event(OPEN_EVENT));
  }

  function startDrag(e: ReactPointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button") || window.matchMedia("(max-width: 720px)").matches) return;
    const r = panel.current!.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function moveDrag(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const r = panel.current!.getBoundingClientRect();
    const x = Math.min(window.innerWidth - 80, Math.max(80 - r.width, e.clientX - drag.current.dx));
    const y = Math.min(window.innerHeight - 40, Math.max(0, e.clientY - drag.current.dy));
    setPos({ x, y });
  }

  return (
    <>
      <button
        type="button"
        className={variant === "link" ? "link-button" : `button secondary small ${styles.openButton}`}
        onClick={() => toggle()}
        aria-expanded={open}
      >
        {variant === "button" && (
          <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden focusable="false">
            <rect x="2.5" y="1.5" width="11" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <rect x="4.5" y="3.5" width="7" height="3" rx="0.5" fill="currentColor" />
            <circle cx="5.5" cy="9.5" r="0.9" fill="currentColor" />
            <circle cx="8" cy="9.5" r="0.9" fill="currentColor" />
            <circle cx="10.5" cy="9.5" r="0.9" fill="currentColor" />
            <circle cx="5.5" cy="12" r="0.9" fill="currentColor" />
            <circle cx="8" cy="12" r="0.9" fill="currentColor" />
            <circle cx="10.5" cy="12" r="0.9" fill="currentColor" />
          </svg>
        )}
        {open ? "Close calculator" : "Calculator"}
      </button>
      {open && (
        <div
          ref={panel}
          className={`${styles.panel} ${wide ? styles.wide : ""}`}
          style={pos ? { left: pos.x, top: pos.y, right: "auto" } : undefined}
          role="dialog"
          aria-label="Graphing calculator"
        >
          <div className={styles.panelHead} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => (drag.current = null)}>
            <span className={styles.panelTitle}>Graphing calculator</span>
            <span className={styles.panelButtons}>
              <button type="button" className={`${styles.headButton} ${styles.expand}`} onClick={() => setWide((v) => !v)} aria-label={wide ? "Make smaller" : "Make larger"}>
                {wide ? "⤡" : "⤢"}
              </button>
              <button type="button" className={styles.headButton} onClick={() => toggle(false)} aria-label="Close calculator">
                ×
              </button>
            </span>
          </div>
          <div className={styles.panelBody}>
            {desmosApiKey ? <DesmosCalculator apiKey={desmosApiKey} storageKey={storageKey} /> : <GraphingCalculator storageKey={storageKey} />}
          </div>
        </div>
      )}
    </>
  );
}
