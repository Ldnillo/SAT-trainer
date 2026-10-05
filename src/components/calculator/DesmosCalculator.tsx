"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Calculator.module.css";

/** The small part of the Desmos API we use. */
interface DesmosApi {
  GraphingCalculator(el: HTMLElement, options?: Record<string, unknown>): {
    getState(): unknown;
    setState(state: unknown): void;
    destroy(): void;
  };
}

declare global {
  interface Window {
    Desmos?: DesmosApi;
  }
}

const VERSION = "v1.11";
let loading: Promise<DesmosApi> | null = null;

function loadDesmos(apiKey: string): Promise<DesmosApi> {
  if (window.Desmos) return Promise.resolve(window.Desmos);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.desmos.com/api/${VERSION}/calculator.js?apiKey=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.onload = () => (window.Desmos ? resolve(window.Desmos) : reject(new Error("Desmos didn't load")));
    script.onerror = () => {
      loading = null;
      reject(new Error("Desmos didn't load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * The Desmos graphing calculator, the one the digital SAT uses. Only shown
 * when DESMOS_API_KEY is set: Desmos needs a paid commercial plan for a paid
 * site like this one, so the built-in calculator is the default.
 */
export default function DesmosCalculator({ apiKey, storageKey }: { apiKey: string; storageKey: string }) {
  const el = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let calc: ReturnType<DesmosApi["GraphingCalculator"]> | null = null;
    let cancelled = false;
    const key = `${storageKey}:desmos`;
    loadDesmos(apiKey)
      .then((Desmos) => {
        if (cancelled || !el.current) return;
        calc = Desmos.GraphingCalculator(el.current, { settingsMenu: false, links: false, border: false });
        try {
          const saved = sessionStorage.getItem(key);
          if (saved) calc.setState(JSON.parse(saved));
        } catch {
          // Start fresh.
        }
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      if (!calc) return;
      try {
        sessionStorage.setItem(key, JSON.stringify(calc.getState()));
      } catch {
        // Nothing to keep.
      }
      calc.destroy();
    };
  }, [apiKey, storageKey]);

  if (failed) return <p className={styles.loading}>The calculator couldn&apos;t load. Check your connection and open it again.</p>;
  return <div ref={el} className={styles.desmos} />;
}
