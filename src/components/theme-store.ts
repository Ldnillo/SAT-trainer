"use client";

import { useSyncExternalStore } from "react";
import { parseTheme, THEME_COOKIE, type Theme } from "@/lib/theme";

const YEAR = 60 * 60 * 24 * 365;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The root layout sets data-theme only for an explicit light or dark choice. */
function readTheme(): Theme {
  return parseTheme(document.documentElement.dataset.theme);
}

/** Applies a theme at once and remembers it in a cookie for later visits. */
export function setTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${YEAR}; samesite=lax`;
  listeners.forEach((listener) => listener());
}

/** Whether the page is showing dark colors right now, whichever way that was chosen. */
export function showingDark(): boolean {
  const theme = readTheme();
  return theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

/** The current choice. `initial` is what the server rendered from the cookie. */
export function useTheme(initial: Theme): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => initial);
}
