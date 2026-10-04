"use client";

import { setTheme, showingDark } from "./theme-store";

/**
 * Header button that flips between light and dark. Both icons are rendered and CSS shows the one
 * matching the page, so the server and browser agree even when the device setting decides.
 */
export function ThemeToggle() {
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setTheme(showingDark() ? "light" : "dark")}
      aria-label="Switch between light and dark mode"
      title="Switch between light and dark mode"
    >
      <svg className="theme-icon-moon" width="18" height="18" viewBox="0 0 24 24" aria-hidden focusable="false">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="currentColor" />
      </svg>
      <svg className="theme-icon-sun" width="18" height="18" viewBox="0 0 24 24" aria-hidden focusable="false">
        <circle cx="12" cy="12" r="4.5" fill="currentColor" />
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </g>
      </svg>
    </button>
  );
}
