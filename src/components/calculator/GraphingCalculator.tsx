"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  asFraction,
  compileLines,
  formatNumber,
  pointsOfInterest,
  type Line,
  type PointOfInterest,
} from "@/lib/calculator/engine";
import styles from "./Calculator.module.css";

/** Line colours, readable on light and dark backgrounds. */
const COLORS = ["#d6453d", "#2a78d6", "#2f9e57", "#8a4fd6", "#e07b1a", "#0f8f8f"];

interface Row {
  id: number;
  text: string;
}

/** What's on screen: the point at the centre and how many graph units one CSS pixel is. */
interface View {
  cx: number;
  cy: number;
  scale: number;
}

interface Saved {
  rows: string[];
  degrees: boolean;
  view: View | null;
}

const HOME: View = { cx: 0, cy: 0, scale: 0 };
const KEYS = ["x", "y", "^", "√", "π", "(", ")", "|", "≤", "≥", "/"];
const POINT_NAMES: Record<PointOfInterest["kind"], string> = {
  "x-intercept": "x-intercept",
  "y-intercept": "y-intercept",
  minimum: "minimum",
  maximum: "maximum",
  intersection: "intersection",
};

function load(key: string): Saved | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function save(key: string, value: Saved) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing or storage full: the calculator still works, it just won't remember.
  }
}

/** Grid spacing in graph units: 1, 2 or 5 times a power of ten, about every `px` pixels. */
function niceStep(scale: number, px: number): number {
  const raw = scale * px;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m < 2 ? 1 : m < 5 ? 2 : 5) * p;
}

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/**
 * NextScore's built-in graphing calculator: an expression list like Desmos
 * (the calculator on the digital SAT) next to a graph you can drag and zoom.
 * Tap a curve to read off a point; tap a grey dot for an intercept, a
 * minimum or maximum, or where two graphs cross.
 */
export default function GraphingCalculator({ storageKey }: { storageKey: string }) {
  // Restore what the student had, so moving to the next question keeps their work. (This component only renders in the browser.)
  const [saved] = useState(() => load(storageKey));
  const [rows, setRows] = useState<Row[]>(() => (saved?.rows.length ? saved.rows : [""]).map((text, id) => ({ id, text })));
  const [degrees, setDegrees] = useState(saved?.degrees ?? false);
  const [stored, setView] = useState<View>(saved?.view ?? HOME);
  const [active, setActive] = useState(0);
  const [label, setLabel] = useState<{ x: number; y: number; text: string } | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const nextId = useRef(rows.length);
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const inputs = useRef(new Map<number, HTMLInputElement>());
  const [theme, setTheme] = useState(0);

  useEffect(() => {
    save(storageKey, { rows: rows.map((r) => r.text), degrees, view: stored.scale ? stored : null });
  }, [storageKey, rows, degrees, stored]);

  // Fit the canvas to its box, and pick the starting zoom: about -10 to 10 across.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Until the student moves the graph, show about -12 to 12 across the shorter side.
  const home = (s: { w: number; h: number }): View => ({ cx: 0, cy: 0, scale: s.w ? 24 / Math.min(s.w, s.h) : 0 });
  const view = stored.scale ? stored : home(size);

  // Redraw in the new colours when the site switches between light and dark.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const bump = () => setTheme((t) => t + 1);
    media.addEventListener("change", bump);
    const mo = new MutationObserver(bump);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
    return () => {
      media.removeEventListener("change", bump);
      mo.disconnect();
    };
  }, []);

  const lines = useMemo(() => compileLines(rows.map((r) => r.text), { degrees }), [rows, degrees]);

  const x0 = view.cx - (size.w / 2) * view.scale;
  const x1 = view.cx + (size.w / 2) * view.scale;
  const points = useMemo(
    () => (view.scale && size.w ? pointsOfInterest(lines, x0, x1, size.h * view.scale, Math.min(1200, size.w * 2)) : []),
    [lines, x0, x1, size, view.scale],
  );
  const shownPoints = points.filter((p) => p.lines.includes(active));

  const toPx = useCallback(
    (x: number, y: number) => ({ px: size.w / 2 + (x - view.cx) / view.scale, py: size.h / 2 - (y - view.cy) / view.scale }),
    [size, view],
  );
  const toGraph = useCallback(
    (px: number, py: number) => ({ x: view.cx + (px - size.w / 2) * view.scale, y: view.cy - (py - size.h / 2) * view.scale }),
    [size, view],
  );

  // Draw.
  useEffect(() => {
    const c = canvas.current;
    if (!c || !size.w || !view.scale) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = size.w * dpr;
    c.height = size.h * dpr;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, { size, view, lines, toPx, toGraph, points: shownPoints, active });
  }, [size, view, lines, toPx, toGraph, shownPoints, active, theme]);

  /* ---------- Expression list ---------- */

  function setText(id: number, text: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, text } : r)));
    setLabel(null);
  }

  function addRow(after: number) {
    const id = nextId.current++;
    setRows((rs) => {
      const i = rs.findIndex((r) => r.id === after);
      return [...rs.slice(0, i + 1), { id, text: "" }, ...rs.slice(i + 1)];
    });
    requestAnimationFrame(() => inputs.current.get(id)?.focus());
  }

  function removeRow(id: number) {
    setLabel(null);
    setRows((rs) => {
      if (rs.length === 1) return [{ id: rs[0].id, text: "" }];
      const i = rs.findIndex((r) => r.id === id);
      const rest = rs.filter((r) => r.id !== id);
      const focus = rest[Math.max(0, i - 1)];
      requestAnimationFrame(() => inputs.current.get(focus.id)?.focus());
      return rest;
    });
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>, row: Row, i: number) {
    if (e.key === "Enter") {
      e.preventDefault();
      addRow(row.id);
    } else if (e.key === "Backspace" && row.text === "" && rows.length > 1) {
      e.preventDefault();
      removeRow(row.id);
    } else if (e.key === "ArrowUp" && i > 0) {
      inputs.current.get(rows[i - 1].id)?.focus();
    } else if (e.key === "ArrowDown" && i < rows.length - 1) {
      inputs.current.get(rows[i + 1].id)?.focus();
    }
  }

  /** The on-screen keys type into the line being edited, at the cursor. */
  function typeKey(key: string) {
    const row = rows[active] ?? rows[rows.length - 1];
    const input = inputs.current.get(row.id);
    const text = key === "√" ? "√(" : key;
    const start = input?.selectionStart ?? row.text.length;
    const end = input?.selectionEnd ?? row.text.length;
    setText(row.id, row.text.slice(0, start) + text + row.text.slice(end));
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + text.length, start + text.length);
    });
  }

  function clearAll() {
    setRows([{ id: nextId.current++, text: "" }]);
    setActive(0);
    setLabel(null);
  }

  /* ---------- Graph: drag to move, wheel or pinch to zoom, tap to read points ---------- */

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: boolean; pinch: number | null }>({ moved: false, pinch: null });

  function zoom(factor: number, px = size.w / 2, py = size.h / 2) {
    setView((cur) => {
      const v = cur.scale ? cur : home(size);
      const scale = Math.min(1e4, Math.max(1e-5, v.scale * factor));
      // Keep the point under the cursor in place.
      const gx = v.cx + (px - size.w / 2) * v.scale;
      const gy = v.cy - (py - size.h / 2) * v.scale;
      return { scale, cx: gx - (px - size.w / 2) * scale, cy: gy + (py - size.h / 2) * scale };
    });
    setLabel(null);
  }

  function local(e: { clientX: number; clientY: number }) {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    canvas.current!.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    gesture.current = { moved: false, pinch: null };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const now = local(e);
    pointers.current.set(e.pointerId, now);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (gesture.current.pinch) zoom(gesture.current.pinch / dist, (a.x + b.x) / 2, (a.y + b.y) / 2);
      gesture.current.pinch = dist;
      gesture.current.moved = true;
      return;
    }
    const dx = now.x - prev.x;
    const dy = now.y - prev.y;
    if (!gesture.current.moved && Math.hypot(dx, dy) < 2) return;
    gesture.current.moved = true;
    setView((cur) => {
      const v = cur.scale ? cur : home(size);
      return { ...v, cx: v.cx - dx * v.scale, cy: v.cy + dy * v.scale };
    });
    setLabel(null);
  }

  function onPointerUp(e: ReactPointerEvent<HTMLCanvasElement>) {
    const at = local(e);
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0 && !gesture.current.moved) readPoint(at.x, at.y);
    if (pointers.current.size < 2) gesture.current.pinch = null;
  }

  function readPoint(px: number, py: number) {
    // A grey dot nearby?
    let best: { d: number; x: number; y: number; text: string } | null = null;
    for (const p of points) {
      const { px: qx, py: qy } = toPx(p.x, p.y);
      const d = Math.hypot(qx - px, qy - py);
      if (d < 14 && (!best || d < best.d)) best = { d, x: p.x, y: p.y, text: POINT_NAMES[p.kind] };
    }
    if (best) {
      // One spot can be several things at once, like a minimum that is also the y-intercept.
      const here = points.filter((p) => p.x === best!.x && p.y === best!.y);
      const kinds = [...new Set(here.map((p) => POINT_NAMES[p.kind]))];
      setLabel({ x: best.x, y: best.y, text: kinds.join(" · ") });
      return;
    }
    // Otherwise a point on the nearest curve.
    const { x } = toGraph(px, py);
    let trace: { d: number; i: number; y: number } | null = null;
    lines.forEach((l, i) => {
      if (l.kind !== "function") return;
      const y = l.f(x);
      if (!Number.isFinite(y)) return;
      const d = Math.abs(toPx(x, y).py - py);
      if (d < 16 && (!trace || d < trace.d)) trace = { d, i, y };
    });
    if (trace) {
      const t = trace as { i: number; y: number };
      setActive(t.i);
      setLabel({ x: Number(x.toPrecision(4)), y: t.y, text: "" });
    } else setLabel(null);
  }

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = c.getBoundingClientRect();
      zoom(Math.exp(e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    };
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
  });

  const labelPos = label ? toPx(label.x, label.y) : null;

  return (
    <div className={styles.calc}>
      <div className={styles.list}>
        <div className={styles.listTools}>
          <button type="button" className={styles.tool} onClick={() => addRow(rows[rows.length - 1].id)} title="Add a line">
            + Line
          </button>
          <button type="button" className={styles.tool} onClick={() => setDegrees((d) => !d)} aria-pressed={degrees} title="Angle unit for sin, cos and tan">
            {degrees ? "Degrees" : "Radians"}
          </button>
          <button type="button" className={styles.tool} onClick={clearAll}>
            Clear all
          </button>
        </div>
        <ol className={styles.rows}>
          {rows.map((row, i) => (
            <li key={row.id} className={`${styles.row} ${i === active ? styles.rowActive : ""}`}>
              <span className={styles.swatch} style={{ background: drawable(lines[i]) ? COLORS[i % COLORS.length] : "transparent" }} aria-hidden>
                {i + 1}
              </span>
              <div className={styles.rowMain}>
                <input
                  ref={(el) => {
                    if (el) inputs.current.set(row.id, el);
                    else inputs.current.delete(row.id);
                  }}
                  value={row.text}
                  onChange={(e) => setText(row.id, e.target.value)}
                  onFocus={() => setActive(i)}
                  onKeyDown={(e) => onKey(e, row, i)}
                  className={styles.input}
                  aria-label={`Expression ${i + 1}`}
                  placeholder={i === 0 ? "Try y = 2x + 1" : ""}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <Result line={lines[i]} />
              </div>
              <button type="button" className={styles.remove} onClick={() => removeRow(row.id)} aria-label={`Delete expression ${i + 1}`}>
                ×
              </button>
            </li>
          ))}
        </ol>
        <div className={styles.keys} aria-label="Symbols">
          {KEYS.map((k) => (
            <button key={k} type="button" className={styles.key} onMouseDown={(e) => e.preventDefault()} onClick={() => typeKey(k)}>
              {k}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.graph} ref={box}>
        <canvas
          ref={canvas}
          className={styles.canvas}
          style={{ width: size.w, height: size.h }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="img"
          aria-label={describe(lines)}
        />
        {label && labelPos && (
          <div className={styles.pointLabel} style={{ left: labelPos.px, top: labelPos.py }}>
            {label.text && <span className={styles.pointKind}>{label.text}</span>}({formatNumber(label.x, 6)}, {formatNumber(label.y, 6)})
          </div>
        )}
        <div className={styles.zoom}>
          <button type="button" onClick={() => zoom(1 / 1.5)} aria-label="Zoom in">
            +
          </button>
          <button type="button" onClick={() => zoom(1.5)} aria-label="Zoom out">
            −
          </button>
          <button type="button" onClick={() => (setView(HOME), setLabel(null))} aria-label="Reset the view">
            ⌂
          </button>
        </div>
      </div>
    </div>
  );
}

function drawable(line: Line | undefined): boolean {
  return line?.kind === "function" || line?.kind === "relation" || line?.kind === "point";
}

function Result({ line }: { line: Line | undefined }) {
  if (!line) return null;
  if (line.kind === "error") return <span className={styles.error}>{line.message}</span>;
  if (line.kind === "value" || line.kind === "constant") {
    const fraction = asFraction(line.value);
    return (
      <span className={styles.value}>
        = {formatNumber(line.value)}
        {fraction && <span className={styles.fraction}> = {fraction}</span>}
      </span>
    );
  }
  return null;
}

function describe(lines: Line[]): string {
  const n = lines.filter(drawable).length;
  return n === 0 ? "Empty graph" : `Graph of ${n} expression${n === 1 ? "" : "s"}`;
}

/* ------------------------------------------------------------------ */

interface DrawArgs {
  size: { w: number; h: number };
  view: View;
  lines: Line[];
  toPx: (x: number, y: number) => { px: number; py: number };
  toGraph: (px: number, py: number) => { x: number; y: number };
  points: PointOfInterest[];
  active: number;
}

function draw(ctx: CanvasRenderingContext2D, { size, view, lines, toPx, toGraph, points }: DrawArgs) {
  const { w, h } = size;
  const fg = cssVar("--foreground", "#14172e");
  const muted = cssVar("--muted", "#5d6280");
  ctx.fillStyle = cssVar("--surface", "#ffffff");
  ctx.fillRect(0, 0, w, h);

  // Grid.
  const major = niceStep(view.scale, 90);
  const minor = major / (String(major).startsWith("2") ? 4 : 5);
  const tl = toGraph(0, 0);
  const br = toGraph(w, h);
  const gridLines = (step: number, alpha: number) => {
    ctx.strokeStyle = muted;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = Math.ceil(tl.x / step) * step; x <= br.x; x += step) {
      const px = Math.round(toPx(x, 0).px) + 0.5;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
    }
    for (let y = Math.ceil(br.y / step) * step; y <= tl.y; y += step) {
      const py = Math.round(toPx(0, y).py) + 0.5;
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  };
  gridLines(minor, 0.1);
  gridLines(major, 0.28);

  // Axes and labels.
  const origin = toPx(0, 0);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(0, Math.round(origin.py) + 0.5);
  ctx.lineTo(w, Math.round(origin.py) + 0.5);
  ctx.moveTo(Math.round(origin.px) + 0.5, 0);
  ctx.lineTo(Math.round(origin.px) + 0.5, h);
  ctx.stroke();

  ctx.fillStyle = muted;
  ctx.font = "11px system-ui, sans-serif";
  const labelY = Math.min(h - 4, Math.max(12, origin.py + 13));
  ctx.textAlign = "center";
  for (let x = Math.ceil(tl.x / major) * major; x <= br.x; x += major) {
    if (Math.abs(x) < major / 2) continue;
    ctx.fillText(formatNumber(x, 6), toPx(x, 0).px, labelY);
  }
  ctx.textAlign = "right";
  const labelX = Math.min(w - 4, Math.max(28, origin.px - 5));
  for (let y = Math.ceil(br.y / major) * major; y <= tl.y; y += major) {
    if (Math.abs(y) < major / 2) continue;
    ctx.fillText(formatNumber(y, 6), labelX, toPx(0, y).py + 4);
  }

  // Shaded inequalities go under the curves.
  lines.forEach((line, i) => {
    if (line.kind === "relation" && line.op !== "=") shade(ctx, line, COLORS[i % COLORS.length], w, h, toGraph);
  });

  lines.forEach((line, i) => {
    const color = COLORS[i % COLORS.length];
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    if (line.kind === "function") plotFunction(ctx, line.f, w, h, toPx, toGraph);
    else if (line.kind === "relation") {
      if (line.op === "<" || line.op === ">") ctx.setLineDash([8, 6]);
      contour(ctx, line.F, w, h, toGraph);
      ctx.setLineDash([]);
    } else if (line.kind === "point") {
      const { px, py } = toPx(line.x, line.y);
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Grey dots for the selected line's intercepts, turning points and intersections.
  for (const p of points) {
    const { px, py } = toPx(p.x, p.y);
    if (px < -5 || px > w + 5 || py < -5 || py > h + 5) continue;
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = muted;
    ctx.fill();
    ctx.strokeStyle = cssVar("--surface", "#ffffff");
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function plotFunction(
  ctx: CanvasRenderingContext2D,
  f: (x: number) => number,
  w: number,
  h: number,
  toPx: DrawArgs["toPx"],
  toGraph: DrawArgs["toGraph"],
) {
  ctx.beginPath();
  let pen = false;
  let prev: { px: number; py: number } | null = null;
  const step = 0.5;
  for (let px = -1; px <= w + 1; px += step) {
    const x = toGraph(px, 0).x;
    const y = f(x);
    if (!Number.isFinite(y)) {
      pen = false;
      prev = null;
      continue;
    }
    const py = toPx(x, y).py;
    // A big jump between neighbouring pixels is an asymptote (like 1/x at 0) unless the midpoint lies between them.
    if (prev && Math.abs(py - prev.py) > h) {
      const mid = toPx(0, f(toGraph(px - step / 2, 0).x)).py;
      const between = Number.isFinite(mid) && (mid - prev.py) * (py - mid) >= 0;
      if (!between) pen = false;
    }
    const clamped = Math.max(-h, Math.min(2 * h, py));
    if (pen) ctx.lineTo(px, clamped);
    else ctx.moveTo(px, clamped);
    pen = true;
    prev = { px, py };
  }
  ctx.stroke();
}

const CELL = 4;

/** Draws F(x, y) = 0 with marching squares on a grid of CELL-pixel squares. */
function contour(ctx: CanvasRenderingContext2D, F: (x: number, y: number) => number, w: number, h: number, toGraph: DrawArgs["toGraph"]) {
  const cols = Math.ceil(w / CELL) + 1;
  const rowsN = Math.ceil(h / CELL) + 1;
  const v = new Float64Array(cols * rowsN);
  for (let j = 0; j < rowsN; j++) {
    for (let i = 0; i < cols; i++) {
      const { x, y } = toGraph(i * CELL, j * CELL);
      v[j * cols + i] = F(x, y);
    }
  }
  const lerp = (a: number, b: number) => (Math.abs(a - b) < 1e-300 ? 0.5 : a / (a - b));
  ctx.beginPath();
  for (let j = 0; j < rowsN - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = v[j * cols + i];
      const b = v[j * cols + i + 1];
      const c = v[(j + 1) * cols + i + 1];
      const d = v[(j + 1) * cols + i];
      if (![a, b, c, d].every(Number.isFinite)) continue;
      const x = i * CELL;
      const y = j * CELL;
      const pts: [number, number][] = [];
      if (a > 0 !== b > 0) pts.push([x + CELL * lerp(a, b), y]);
      if (b > 0 !== c > 0) pts.push([x + CELL, y + CELL * lerp(b, c)]);
      if (d > 0 !== c > 0) pts.push([x + CELL * lerp(d, c), y + CELL]);
      if (a > 0 !== d > 0) pts.push([x, y + CELL * lerp(a, d)]);
      // Sign changes from a jump (like y = 1/x) have huge values on both sides; skip them.
      const big = Math.max(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d));
      const spread = Math.abs(Math.max(a, b, c, d) - Math.min(a, b, c, d));
      if (pts.length >= 2 && big > 1e6 && spread > 1e6) continue;
      for (let k = 0; k + 1 < pts.length; k += 2) {
        ctx.moveTo(pts[k][0], pts[k][1]);
        ctx.lineTo(pts[k + 1][0], pts[k + 1][1]);
      }
    }
  }
  ctx.stroke();
}

/** Lightly fills the region where an inequality holds. */
function shade(
  ctx: CanvasRenderingContext2D,
  line: Extract<Line, { kind: "relation" }>,
  color: string,
  w: number,
  h: number,
  toGraph: DrawArgs["toGraph"],
) {
  const holds = (v: number) => (line.op === "<" || line.op === "<=" ? v < 0 : v > 0);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.18;
  for (let py = 0; py < h; py += CELL) {
    let start = -1;
    for (let px = 0; px <= w; px += CELL) {
      const { x, y } = toGraph(px + CELL / 2, py + CELL / 2);
      const inside = px < w && holds(line.F(x, y));
      if (inside && start < 0) start = px;
      if (!inside && start >= 0) {
        ctx.fillRect(start, py, px - start, CELL);
        start = -1;
      }
    }
  }
  ctx.globalAlpha = 1;
}
