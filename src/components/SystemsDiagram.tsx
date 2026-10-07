/** The three things two lines can do. Drawn as plain SVG so it follows the light and dark theme. */
export function SystemsDiagram() {
  const panels = [
    { title: "One solution", note: "Lines cross once", lines: [[10, 70, 90, 20], [10, 25, 90, 65]], solution: [50, 45] },
    { title: "No solution", note: "Parallel: same slope, different start", lines: [[10, 60, 90, 25], [10, 40, 90, 5]], solution: null },
    { title: "Infinitely many", note: "Same line written twice", lines: [[10, 60, 90, 25], [10, 60, 90, 25]], solution: null },
  ] as const;
  return (
    <figure style={{ margin: "12px 0", display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
      {panels.map((p) => (
        <div key={p.title} style={{ textAlign: "center" }}>
          <svg viewBox="0 0 100 80" role="img" aria-label={`${p.title}: ${p.note}`} style={{ width: "100%", maxWidth: 200 }}>
            <rect x="1" y="1" width="98" height="78" rx="6" fill="none" stroke="var(--muted)" strokeOpacity="0.4" />
            {p.lines.map(([x1, y1, x2, y2], i) => (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={i === 0 ? "var(--accent)" : "var(--ok)"}
                strokeWidth={p.title === "Infinitely many" ? (i === 0 ? 6 : 2) : 2.5}
                strokeLinecap="round"
                strokeOpacity={p.title === "Infinitely many" && i === 0 ? 0.5 : 1}
              />
            ))}
            {p.solution && <circle cx={p.solution[0]} cy={p.solution[1]} r="4" fill="var(--bad)" />}
          </svg>
          <strong style={{ display: "block", fontSize: 14 }}>{p.title}</strong>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>{p.note}</span>
        </div>
      ))}
    </figure>
  );
}
