/** NextScore mark: three rising bars, the last one in the highlight color. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden focusable="false">
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <rect x="7" y="17" width="4.5" height="8" rx="1.5" fill="var(--on-accent)" opacity="0.7" />
      <rect x="13.75" y="12" width="4.5" height="13" rx="1.5" fill="var(--on-accent)" opacity="0.85" />
      <rect x="20.5" y="7" width="4.5" height="18" rx="1.5" fill="var(--highlight)" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="logo">
      <LogoMark />
      <span className="wordmark">
        Next<strong>Score</strong>
      </span>
    </span>
  );
}
