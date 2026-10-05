import type { ReactNode } from "react";
import { MathText } from "@/components/MathText";
import styles from "./ReferenceSheet.module.css";

/**
 * Formulas a student may look up during Math. The formulas are standard math;
 * the grouping, wording and drawings are NextScore's own, not a copy of any
 * official sheet.
 */
interface Formula {
  name: string;
  math: string;
  picture: ReactNode;
}

const v = (x: number, y: number, label: string) => (
  <text x={x} y={y} className={styles.label}>
    {label}
  </text>
);

const angle = (x: number, y: number, label: string) => (
  <text x={x} y={y} className={styles.angle}>
    {label}
  </text>
);

const GROUPS: { title: string; items: Formula[] }[] = [
  {
    title: "Area and circles",
    items: [
      {
        name: "Rectangle",
        math: "$A = \\ell w$",
        picture: (
          <>
            <rect x="14" y="14" width="62" height="38" />
            {v(42, 66, "ℓ")}
            {v(82, 37, "w")}
          </>
        ),
      },
      {
        name: "Triangle",
        math: "$A = \\frac{1}{2}bh$",
        picture: (
          <>
            <path d="M10 56 L80 56 L54 12 Z" />
            <path d="M54 12 L54 56" className={styles.dashed} />
            {v(42, 70, "b")}
            {v(58, 38, "h")}
          </>
        ),
      },
      {
        name: "Circle",
        math: "$A = \\pi r^2$, $\\ C = 2\\pi r$",
        picture: (
          <>
            <circle cx="45" cy="36" r="25" />
            <path d="M45 36 L70 36" />
            <circle cx="45" cy="36" r="1.6" className={styles.dot} />
            {v(54, 31, "r")}
          </>
        ),
      },
    ],
  },
  {
    title: "Right triangles",
    items: [
      {
        name: "Pythagorean theorem",
        math: "$a^2 + b^2 = c^2$",
        picture: (
          <>
            <path d="M16 58 L16 14 L78 58 Z" />
            <path d="M16 50 L24 50 L24 58" />
            {v(6, 39, "a")}
            {v(44, 70, "b")}
            {v(50, 32, "c")}
          </>
        ),
      },
      {
        name: "30°-60°-90°",
        math: "Sides $x$, $x\\sqrt{3}$, $2x$",
        picture: (
          <>
            <path d="M16 58 L16 22 L78 58 Z" />
            <path d="M16 50 L24 50 L24 58" />
            {v(6, 43, "x")}
            {v(36, 72, "x√3")}
            {v(50, 36, "2x")}
            {angle(19, 36, "60°")}
            {angle(52, 55, "30°")}
          </>
        ),
      },
      {
        name: "45°-45°-90°",
        math: "Sides $s$, $s$, $s\\sqrt{2}$",
        picture: (
          <>
            <path d="M20 60 L20 16 L64 60 Z" />
            <path d="M20 52 L28 52 L28 60" />
            {v(10, 41, "s")}
            {v(40, 72, "s")}
            {v(46, 34, "s√2")}
            {angle(22, 31, "45°")}
            {angle(42, 57, "45°")}
          </>
        ),
      },
    ],
  },
  {
    title: "Volume",
    items: [
      {
        name: "Rectangular prism",
        math: "$V = \\ell wh$",
        picture: (
          <>
            <path d="M12 26 L58 26 L58 60 L12 60 Z" />
            <path d="M12 26 L28 12 L74 12 L58 26 M74 12 L74 46 L58 60" />
            {v(32, 72, "ℓ")}
            {v(68, 62, "w")}
            {v(80, 32, "h")}
          </>
        ),
      },
      {
        name: "Cylinder",
        math: "$V = \\pi r^2 h$",
        picture: (
          <>
            <ellipse cx="45" cy="16" rx="24" ry="7" />
            <path d="M21 16 L21 56 M69 16 L69 56" />
            <path d="M21 56 A24 7 0 0 0 69 56" />
            <path d="M21 56 A24 7 0 0 1 69 56" className={styles.dashed} />
            <path d="M45 16 L69 16" />
            {v(54, 12, "r")}
            {v(75, 40, "h")}
          </>
        ),
      },
      {
        name: "Sphere",
        math: "$V = \\frac{4}{3}\\pi r^3$",
        picture: (
          <>
            <circle cx="45" cy="36" r="26" />
            <path d="M19 36 A26 8 0 0 0 71 36" />
            <path d="M19 36 A26 8 0 0 1 71 36" className={styles.dashed} />
            <path d="M45 36 L66 21" />
            <circle cx="45" cy="36" r="1.6" className={styles.dot} />
            {v(49, 23, "r")}
          </>
        ),
      },
      {
        name: "Cone",
        math: "$V = \\frac{1}{3}\\pi r^2 h$",
        picture: (
          <>
            <path d="M21 56 L45 10 L69 56" />
            <path d="M21 56 A24 7 0 0 0 69 56" />
            <path d="M21 56 A24 7 0 0 1 69 56" className={styles.dashed} />
            <path d="M45 10 L45 56 L69 56" className={styles.dashed} />
            {v(48, 38, "h")}
            {v(55, 72, "r")}
          </>
        ),
      },
      {
        name: "Rectangular pyramid",
        math: "$V = \\frac{1}{3}\\ell wh$",
        picture: (
          <>
            <path d="M12 58 L60 58 L76 46 M12 58 L46 10 L60 58 M46 10 L76 46" />
            <path d="M12 58 L28 46 L76 46 M28 46 L46 10" className={styles.dashed} />
            <path d="M46 10 L46 52" className={styles.dashed} />
            {v(34, 70, "ℓ")}
            {v(72, 60, "w")}
            {v(49, 36, "h")}
          </>
        ),
      },
    ],
  },
];

const FACTS = [
  "A full circle is $360^\\circ$, which is $2\\pi$ radians.",
  "The three angles of any triangle add up to $180^\\circ$.",
];

export function ReferenceSheet() {
  return (
    <div className={styles.sheet}>
      {GROUPS.map((group) => (
        <section key={group.title}>
          <h3 className={styles.groupTitle}>{group.title}</h3>
          <ul className={styles.grid}>
            {group.items.map((f) => (
              <li key={f.name} className={styles.card}>
                <svg viewBox="0 0 90 76" className={styles.picture} aria-hidden focusable="false">
                  {f.picture}
                </svg>
                <span className={styles.name}>{f.name}</span>
                <span className={styles.math}>
                  <MathText text={f.math} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section>
        <h3 className={styles.groupTitle}>Good to know</h3>
        <ul className={styles.facts}>
          {FACTS.map((fact) => (
            <li key={fact}>
              <MathText text={fact} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
