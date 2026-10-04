"use client";

import { THEMES, type Theme } from "@/lib/theme";
import { setTheme, useTheme } from "./theme-store";

const LABELS: Record<Theme, { title: string; hint: string }> = {
  system: { title: "Match my device", hint: "Light or dark, following your phone or computer's setting." },
  light: { title: "Light", hint: "Always light." },
  dark: { title: "Dark", hint: "Always dark." },
};

/** Three-way theme choice for the settings page. */
export function ThemePicker({ initial }: { initial: Theme }) {
  const current = useTheme(initial);
  return (
    <fieldset className="theme-picker">
      <legend>Color theme</legend>
      {THEMES.map((theme) => (
        <label key={theme} className="theme-option">
          <input
            type="radio"
            name="theme"
            value={theme}
            checked={current === theme}
            onChange={() => setTheme(theme)}
          />
          <span className={`theme-swatch theme-swatch-${theme}`} aria-hidden />
          <span>
            <strong>{LABELS[theme].title}</strong>
            <br />
            <span className="theme-hint">{LABELS[theme].hint}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
