import type { ProgressPoint } from "@/lib/trainer/mastery";
import styles from "./ProgressChart.module.css";

const W = 640;
const H = 240;
const PAD = { top: 16, right: 96, bottom: 28, left: 40 };
const Y_MIN = 200;
const Y_MAX = 800;

const SERIES = [
  { key: "readingWriting", name: "Reading and Writing", color: "var(--series-1)" },
  { key: "math", name: "Math", color: "var(--series-2)" },
] as const;

/** Estimated section scores after each practice set. One shared 200-800 axis. */
export function ProgressChart({ points }: { points: ProgressPoint[] }) {
  const x = (i: number) => PAD.left + (points.length === 1 ? 0 : (i / (points.length - 1)) * (W - PAD.left - PAD.right));
  const y = (v: number) => PAD.top + (1 - (v - Y_MIN) / (Y_MAX - Y_MIN)) * (H - PAD.top - PAD.bottom);
  const date = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  // End labels: push them apart when the two lines finish close together.
  const lastValue = (key: (typeof SERIES)[number]["key"]) => points.findLast((p) => p[key] !== null)?.[key] ?? null;
  const [rwEnd, mathEnd] = [lastValue("readingWriting"), lastValue("math")];
  const labelY: Record<string, number> = {};
  if (rwEnd !== null) labelY.readingWriting = y(rwEnd);
  if (mathEnd !== null) labelY.math = y(mathEnd);
  if (rwEnd !== null && mathEnd !== null && Math.abs(labelY.readingWriting - labelY.math) < 16) {
    const mid = (labelY.readingWriting + labelY.math) / 2;
    const rwAbove = rwEnd >= mathEnd;
    labelY.readingWriting = mid + (rwAbove ? -8 : 8);
    labelY.math = mid + (rwAbove ? 8 : -8);
  }

  return (
    <figure className={styles.figure}>
      <div className={styles.legend}>
        {SERIES.map((s) => (
          <span key={s.key}>
            <i style={{ background: s.color }} /> {s.name}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Estimated section scores after each practice set">
        {[200, 400, 600, 800].map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className={styles.grid} />
            <text x={PAD.left - 6} y={y(v)} className={styles.axis} textAnchor="end" dominantBaseline="middle">
              {v}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={H - 6} className={styles.axis}>
          Set 1
        </text>
        {points.length > 1 && (
          <text x={x(points.length - 1)} y={H - 6} className={styles.axis} textAnchor="end">
            Set {points.length}
          </text>
        )}
        {SERIES.map((s) => {
          const pts = points.map((p, i) => ({ i, v: p[s.key], p })).filter((d) => d.v !== null) as {
            i: number;
            v: number;
            p: ProgressPoint;
          }[];
          if (pts.length === 0) return null;
          const last = pts.at(-1)!;
          return (
            <g key={s.key}>
              <polyline
                points={pts.map((d) => `${x(d.i)},${y(d.v)}`).join(" ")}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
              />
              {pts.map((d) => (
                <g key={d.i}>
                  <circle cx={x(d.i)} cy={y(d.v)} r={4} fill={s.color} stroke="var(--background)" strokeWidth={2} />
                  <circle cx={x(d.i)} cy={y(d.v)} r={12} fill="transparent">
                    <title>
                      {`${s.name}: ${d.v} (set ${d.i + 1}, ${date(d.p.at)}, ${d.p.correct}/${d.p.answered} correct)`}
                    </title>
                  </circle>
                </g>
              ))}
              <text x={x(points.length - 1) + 10} y={labelY[s.key]} className={styles.label} dominantBaseline="middle">
                {s.key === "math" ? "Math" : "R&W"} {last.v}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
