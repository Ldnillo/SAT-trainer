import { all, create, type EvalFunction, type MathNode } from "mathjs";

/**
 * The math behind the built-in graphing calculator: turns what a student types
 * on each line into something to draw or a value to show. Lines work like a
 * Desmos expression list:
 *
 *   y = 2x + 3        a line          x^2 + y^2 = 25   a circle
 *   x^2 - 4           also a graph    y < 2x + 1       shaded region
 *   a = 3             a constant      f(x) = x^2 + a   a named function, also graphed
 *   f(3)              a value         (2, 5)           a point
 *
 * mathjs (Apache-2.0) does the parsing and arithmetic; everything else here is
 * ours. `predictable` keeps results real numbers: sqrt(-1) is NaN, not a complex number.
 */
const math = create(all, { predictable: true });

export type Comparison = "=" | "<" | ">" | "<=" | ">=";

export type Line =
  | { kind: "empty" }
  | { kind: "error"; message: string }
  /** No x or y: just a number, like 3/8 + 1 or f(2). */
  | { kind: "value"; value: number }
  /** a = 3. */
  | { kind: "constant"; name: string; value: number }
  /** y = f(x), a bare expression in x, or a named function f(x) = ... */
  | { kind: "function"; f: (x: number) => number; name?: string }
  /** Anything else with x and y: F(x, y) compared with 0, like x^2 + y^2 - 25 = 0 or y - 2x - 1 < 0. */
  | { kind: "relation"; F: (x: number, y: number) => number; op: Comparison }
  | { kind: "point"; x: number; y: number };

export interface Options {
  /** Trig in degrees instead of radians. */
  degrees: boolean;
}

const FUNCTIONS = [
  "sin", "cos", "tan", "sec", "csc", "cot",
  "arcsin", "arccos", "arctan", "asin", "acos", "atan",
  "sqrt", "cbrt", "abs", "ln", "log", "exp",
  "floor", "ceil", "round", "min", "max", "mod",
];
const CONSTANTS = ["pi", "e"];

/** Functions whose behaviour we set ourselves: SAT conventions (log is base 10) and the degrees switch. */
function builtins(degrees: boolean): Record<string, (...a: number[]) => number> {
  const toRad = degrees ? Math.PI / 180 : 1;
  const fromRad = degrees ? 180 / Math.PI : 1;
  return {
    sin: (a) => Math.sin(a * toRad),
    cos: (a) => Math.cos(a * toRad),
    tan: (a) => Math.tan(a * toRad),
    sec: (a) => 1 / Math.cos(a * toRad),
    csc: (a) => 1 / Math.sin(a * toRad),
    cot: (a) => 1 / Math.tan(a * toRad),
    arcsin: (a) => Math.asin(a) * fromRad,
    arccos: (a) => Math.acos(a) * fromRad,
    arctan: (a) => Math.atan(a) * fromRad,
    asin: (a) => Math.asin(a) * fromRad,
    acos: (a) => Math.acos(a) * fromRad,
    atan: (a) => Math.atan(a) * fromRad,
    ln: (a) => Math.log(a),
    log: (a, base) => (base === undefined ? Math.log10(a) : Math.log(a) / Math.log(base)),
    cbrt: (a) => Math.cbrt(a),
  };
}

const DEFINITION = /^\s*([A-Za-z][A-Za-z0-9_]*)\s*(?:\(\s*([A-Za-z])\s*\))?\s*=(?!=)/;

/** Names a set of lines defines: constants (a = 3) and functions (f(x) = ...). x and y can't be redefined. */
function definedNames(texts: string[]): { constants: Set<string>; functions: Set<string> } {
  const constants = new Set<string>();
  const functions = new Set<string>();
  for (const t of texts) {
    const m = DEFINITION.exec(normalize(t));
    if (!m || /^[xy]+$/.test(m[1]) || FUNCTIONS.includes(m[1])) continue;
    if (m[2]) functions.add(m[1]);
    else constants.add(m[1]);
  }
  return { constants, functions };
}

function normalize(text: string): string {
  return text
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/[−–]/g, "-")
    .replace(/×|·/g, "*")
    .replace(/÷/g, "/")
    .replace(/π/g, "pi")
    .replace(/√/g, "sqrt")
    .replace(/\*\*/g, "^");
}

/** |x - 2| becomes abs(x - 2). A bar opens after an operator, an opening bracket or the start; otherwise it closes. */
function absoluteBars(text: string): string {
  let out = "";
  let depth = 0;
  for (const ch of text) {
    if (ch !== "|") {
      out += ch;
      continue;
    }
    const prev = out.trimEnd().slice(-1);
    const opens = depth === 0 || prev === "" || /[-+*/^(,=<>]/.test(prev) || out.trimEnd().endsWith("abs(");
    if (opens) {
      out += "abs(";
      depth++;
    } else {
      out += ")";
      depth--;
    }
  }
  return out + ")".repeat(Math.max(0, depth));
}

/**
 * Rewrites what students type into what mathjs reads, Desmos style:
 * xy is x times y, sin x is sin(x), a(x + 1) is a times (x + 1).
 */
function rewrite(text: string, names: { constants: Set<string>; functions: Set<string> }): string {
  const s = absoluteBars(normalize(text));
  let out = "";
  let i = 0;
  while (i < s.length) {
    const m = /^[A-Za-z][A-Za-z0-9_]*/.exec(s.slice(i));
    if (!m || (i > 0 && /[0-9.]/.test(s[i - 1]) && /^e\d/.test(m[0]))) {
      out += s[i++];
      continue;
    }
    const word = m[0];
    i += word.length;
    const bare = FUNCTIONS.includes(word) || names.functions.has(word) ? /^\s*(-?[0-9.]*)([A-Za-z][A-Za-z0-9_]*)?(\^[0-9.]+)?/.exec(s.slice(i)) : null;
    if (bare && !/^\s*\(/.test(s.slice(i)) && (bare[1] || bare[2])) {
      // sin x, sin 2x, ln x^2: a function name with its argument after a space.
      i += bare[0].length;
      const ident = bare[2] ? splitWord(bare[2], names, "") : "";
      out += `${word}(${bare[1]}${bare[1] && ident ? "*" : ""}${ident}${bare[3] ?? ""})`;
      continue;
    }
    out += splitWord(word, names, s.slice(i));
  }
  return out;
}

function splitWord(word: string, names: { constants: Set<string>; functions: Set<string> }, rest: string): string {
  const isFunction = (w: string) => FUNCTIONS.includes(w) || names.functions.has(w);
  const isVariable = (w: string) => w === "x" || w === "y" || CONSTANTS.includes(w) || names.constants.has(w);
  const opensParen = /^\s*\(/.test(rest);

  if (isFunction(word)) return word;
  if (isVariable(word)) return opensParen ? `${word}*` : word;

  // sinx, 2sinx: a function name followed by its argument.
  const fn = [...FUNCTIONS, ...names.functions].sort((a, b) => b.length - a.length).find((f) => word.startsWith(f));
  if (fn && word.length > fn.length) return `${fn}(${splitWord(word.slice(fn.length), names, "")})${opensParen ? "*" : ""}`;

  // Multi-letter words that aren't names are products of single letters: 2ab is 2*a*b.
  const joined = [...word].join("*");
  return opensParen ? `${joined}*` : joined;
}

function symbolsIn(node: MathNode): Set<string> {
  const found = new Set<string>();
  node.traverse((n, path, parent) => {
    if (n.type === "SymbolNode" && !(parent?.type === "FunctionNode" && path === "fn")) found.add((n as unknown as { name: string }).name);
  });
  return found;
}

function splitComparison(text: string): { lhs: string; op: Comparison; rhs: string } | { lhs: string; op: null } | null {
  const parts = text.split(/(<=|>=|<|>|=)/);
  if (parts.length === 1) return { lhs: text, op: null };
  if (parts.length !== 3) return null;
  return { lhs: parts[0], op: parts[1] as Comparison, rhs: parts[2] };
}

function asNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v && typeof v === "object" && "valueOf" in v) {
    const n = Number((v as { valueOf: () => unknown }).valueOf());
    if (!Number.isNaN(n)) return n;
  }
  return NaN;
}

function friendly(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/Undefined (symbol|function)/.test(msg)) {
    const name = /Undefined (?:symbol|function) (\w+)/.exec(msg)?.[1];
    return name ? `Define ${name} first, like ${name} = 2.` : "Something here isn't defined yet.";
  }
  if (/Parenthesis|Value expected|Unexpected end/.test(msg)) return "Check your brackets and operators.";
  return "That doesn't look like math yet.";
}

/**
 * Reads every line. Lines can use constants and functions defined on any other
 * line, in any order, as in Desmos.
 */
export function compileLines(texts: string[], options: Options = { degrees: false }): Line[] {
  const names = definedNames(texts);
  const scope: Record<string, unknown> = { ...builtins(options.degrees) };
  const prepared = texts.map((t) => {
    const trimmed = t.trim();
    if (!trimmed) return { text: "" };
    return { text: rewrite(trimmed, names) };
  });

  // Constants and functions first, repeatedly, so a = b + 1 works whatever order the lines are in.
  const definitions = new Map<number, Line>();
  for (let pass = 0; pass < texts.length + 1; pass++) {
    let progress = false;
    prepared.forEach(({ text }, i) => {
      if (definitions.has(i) || !text) return;
      const m = DEFINITION.exec(text);
      if (!m || /^[xy]+$/.test(m[1]) || FUNCTIONS.includes(m[1]) || (!m[2] && !names.constants.has(m[1]))) return;
      try {
        const node = math.parse(text);
        if (m[2]) {
          node.compile().evaluate(scope);
          const fn = scope[m[1]] as (x: number) => unknown;
          definitions.set(i, { kind: "function", name: m[1], f: (x) => asNumber(fn(x)) });
          progress = true;
        } else {
          const value = asNumber(math.parse(text.slice(text.indexOf("=") + 1)).compile().evaluate(scope));
          if (Number.isNaN(value) && pass < texts.length) return;
          scope[m[1]] = value;
          definitions.set(i, { kind: "constant", name: m[1], value });
          progress = true;
        }
      } catch {
        // Try again next pass, once whatever it needs is defined.
      }
    });
    if (!progress) break;
  }

  return prepared.map(({ text }, i): Line => {
    if (!text) return { kind: "empty" };
    const defined = definitions.get(i);
    if (defined) return defined;
    try {
      return compileLine(text, scope);
    } catch (err) {
      return { kind: "error", message: friendly(err) };
    }
  });
}

function compileLine(text: string, scope: Record<string, unknown>): Line {
  const point = pointParts(text);
  if (point) {
    const x = asNumber(math.evaluate(point[0], { ...scope }));
    const y = asNumber(math.evaluate(point[1], { ...scope }));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { kind: "error", message: "A point needs two numbers, like (2, 5)." };
    return { kind: "point", x, y };
  }

  const split = splitComparison(text);
  if (!split) return { kind: "error", message: "Use one =, < or > per line." };

  const check = (node: MathNode) => {
    for (const name of symbolsIn(node)) {
      if (name === "x" || name === "y" || name in scope || CONSTANTS.includes(name)) continue;
      throw new Error(`Undefined symbol ${name}`);
    }
  };

  if (split.op === null) {
    const node = math.parse(split.lhs);
    check(node);
    const symbols = symbolsIn(node);
    if (symbols.has("y")) return { kind: "error", message: "Add an equation, like y = ... or ... = 0." };
    const code = node.compile();
    if (!symbols.has("x")) {
      const value = asNumber(code.evaluate({ ...scope }));
      return Number.isNaN(value) ? { kind: "error", message: "Undefined." } : { kind: "value", value };
    }
    return { kind: "function", f: evalX(code, scope) };
  }

  const lhs = math.parse(split.lhs);
  const rhs = math.parse(split.rhs);
  check(lhs);
  check(rhs);
  const rhsSymbols = symbolsIn(rhs);
  const lhsIsY = lhs.type === "SymbolNode" && (lhs as unknown as { name: string }).name === "y";

  // y = f(x): an ordinary graph, which also gets intercepts, extremes and intersections.
  if (split.op === "=" && lhsIsY && !rhsSymbols.has("y")) {
    return { kind: "function", f: evalX(rhs.compile(), scope) };
  }

  const l = lhs.compile();
  const r = rhs.compile();
  const vars = { ...scope, x: 0, y: 0 };
  return {
    kind: "relation",
    op: split.op,
    F: (x, y) => {
      vars.x = x;
      vars.y = y;
      return asNumber(l.evaluate(vars)) - asNumber(r.evaluate(vars));
    },
  };
}

/** (2, 5) split at its top-level comma, or null when the line isn't a point. */
function pointParts(text: string): [string, string] | null {
  if (!text.startsWith("(") || !text.endsWith(")")) return null;
  const inner = text.slice(1, -1);
  let depth = 0;
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === "(") depth++;
    else if (inner[i] === ")" && --depth < 0) return null;
    else if (inner[i] === "," && depth === 0) return [inner.slice(0, i), inner.slice(i + 1)];
  }
  return null;
}

function evalX(code: EvalFunction, scope: Record<string, unknown>): (x: number) => number {
  const vars = { ...scope, x: 0 };
  return (x) => {
    vars.x = x;
    try {
      return asNumber(code.evaluate(vars));
    } catch {
      return NaN;
    }
  };
}

/* ------------------------------------------------------------------ */
/* Points of interest: what Desmos shows as grey dots on a graph.      */

export type PointKind = "x-intercept" | "y-intercept" | "minimum" | "maximum" | "intersection";

export interface PointOfInterest {
  x: number;
  y: number;
  kind: PointKind;
  /** Index of the line (or lines, for an intersection) it belongs to. */
  lines: number[];
}

function bisect(g: (x: number) => number, a: number, b: number): number {
  let ga = g(a);
  for (let i = 0; i < 60; i++) {
    const m = (a + b) / 2;
    const gm = g(m);
    if (gm === 0) return m;
    if (Math.sign(gm) === Math.sign(ga)) {
      a = m;
      ga = gm;
    } else b = m;
  }
  return (a + b) / 2;
}

/** Zeros of g on [x0, x1], skipping sign changes that are jumps (like 1/x at 0) rather than crossings. */
function zeros(g: (x: number) => number, x0: number, x1: number, samples: number, tolerance: number): number[] {
  const out: number[] = [];
  const step = (x1 - x0) / samples;
  let prevX = x0;
  let prev = g(x0);
  for (let i = 1; i <= samples; i++) {
    const x = x0 + i * step;
    const v = g(x);
    if (Number.isFinite(prev) && Number.isFinite(v)) {
      if (prev === 0) out.push(prevX);
      else if (Math.sign(prev) !== Math.sign(v) && v !== 0) {
        const z = bisect(g, prevX, x);
        if (Math.abs(g(z)) < tolerance) out.push(z);
      }
    }
    prevX = x;
    prev = v;
  }
  return out;
}

/** Local minimums and maximums of f on [x0, x1]. */
function extremes(f: (x: number) => number, x0: number, x1: number, samples: number): { x: number; kind: "minimum" | "maximum" }[] {
  const out: { x: number; kind: "minimum" | "maximum" }[] = [];
  const step = (x1 - x0) / samples;
  const ys = Array.from({ length: samples + 1 }, (_, i) => f(x0 + i * step));
  for (let i = 1; i < samples; i++) {
    const [a, b, c] = [ys[i - 1], ys[i], ys[i + 1]];
    if (![a, b, c].every(Number.isFinite)) continue;
    const isMin = b <= a && b <= c && (b < a || b < c);
    const isMax = b >= a && b >= c && (b > a || b > c);
    if (!isMin && !isMax) continue;
    // Golden-section search between the neighbours for the exact turning point.
    let lo = x0 + (i - 1) * step;
    let hi = x0 + (i + 1) * step;
    const sign = isMin ? 1 : -1;
    const r = (Math.sqrt(5) - 1) / 2;
    for (let k = 0; k < 60; k++) {
      const m1 = hi - r * (hi - lo);
      const m2 = lo + r * (hi - lo);
      if (sign * f(m1) < sign * f(m2)) hi = m2;
      else lo = m1;
    }
    const x = (lo + hi) / 2;
    // Flat stretches (like y = 3) aren't turning points.
    if (Math.abs(f(x) - a) < 1e-12 && Math.abs(f(x) - c) < 1e-12) continue;
    out.push({ x, kind: isMin ? "minimum" : "maximum" });
  }
  return out;
}

/** Intercepts, turning points and intersections of the graphed functions in the visible x range. */
export function pointsOfInterest(lines: Line[], x0: number, x1: number, yScale: number, samples = 800): PointOfInterest[] {
  const fns = lines.flatMap((l, i) => (l.kind === "function" ? [{ f: l.f, i }] : []));
  const tol = Math.max(1e-6, yScale * 1e-3);
  const out: PointOfInterest[] = [];
  for (const { f, i } of fns) {
    for (const x of zeros(f, x0, x1, samples, tol)) out.push({ x, y: 0, kind: "x-intercept", lines: [i] });
    const y0 = f(0);
    if (x0 <= 0 && 0 <= x1 && Number.isFinite(y0)) out.push({ x: 0, y: y0, kind: "y-intercept", lines: [i] });
    for (const e of extremes(f, x0, x1, samples)) {
      // A turning point is only found to about 8 digits; round so x^2 has its minimum at 0, not 1.5e-8.
      const x = Math.round(e.x * 1e6) / 1e6;
      out.push({ x, y: f(x), kind: e.kind, lines: [i] });
    }
  }
  for (let a = 0; a < fns.length; a++) {
    for (let b = a + 1; b < fns.length; b++) {
      const g = (x: number) => fns[a].f(x) - fns[b].f(x);
      for (const x of zeros(g, x0, x1, samples, tol)) out.push({ x, y: fns[a].f(x), kind: "intersection", lines: [fns[a].i, fns[b].i] });
    }
  }
  return out.map((p) => ({ ...p, x: clean(p.x), y: clean(p.y) }));
}

/** Rounds away floating-point noise: 2.9999999999 is 3. */
function clean(n: number): number {
  const r = Math.round(n * 1e9) / 1e9;
  return Object.is(r, -0) ? 0 : r;
}

/** How a number is shown: up to 10 significant digits, without trailing zeros. */
export function formatNumber(n: number, digits = 10): string {
  if (!Number.isFinite(n)) return Number.isNaN(n) ? "undefined" : n > 0 ? "∞" : "-∞";
  const c = Math.abs(n) < 1e-12 ? 0 : n;
  if (c === 0) return "0";
  if (Math.abs(c) >= 1e10 || Math.abs(c) < 1e-6) return c.toExponential(4).replace(/\.?0+e/, "e");
  return String(Number(c.toPrecision(digits)));
}

/** A simple fraction equal to n (to within floating-point error), like 7/4 for 1.75. Null when there isn't a small one. */
export function asFraction(n: number, maxDenominator = 1000): string | null {
  if (!Number.isFinite(n) || Number.isInteger(clean(n))) return null;
  let [h0, h1, k0, k1] = [0, 1, 1, 0];
  let x = Math.abs(n);
  for (let i = 0; i < 30; i++) {
    const a = Math.floor(x);
    [h0, h1] = [h1, a * h1 + h0];
    [k0, k1] = [k1, a * k1 + k0];
    if (k1 > maxDenominator) return null;
    if (Math.abs(Math.abs(n) - h1 / k1) < 1e-9 * Math.max(1, Math.abs(n))) return `${n < 0 ? "-" : ""}${h1}/${k1}`;
    x = 1 / (x - a);
    if (!Number.isFinite(x)) break;
  }
  return null;
}
