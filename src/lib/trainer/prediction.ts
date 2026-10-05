import type { SectionId } from "../sat/taxonomy";
import type { ScoreEstimate } from "./mastery";

/**
 * A predicted score range, built from everything we know about a student:
 * official SAT and Bluebook scores they added, full-length practice tests they
 * took here, and the estimate from their everyday practice answers.
 *
 * Each result is treated as a measurement of the student's section score with
 * its own margin of error: official scores are the most reliable, then
 * Bluebook practice tests, then our practice tests, then the practice estimate.
 * Older results count for less, because students improve while they prepare.
 * The measurements are averaged by how reliable they are (inverse-variance
 * weighting), and the range is the band the student's score most likely falls
 * in (about 80%). When the results disagree with each other more than their
 * margins explain, the range widens to match.
 *
 * It is a practice guide, not an official prediction.
 */

export type EvidenceKind = "official" | "bluebook-practice" | "practice-test" | "practice";

/** One section score from one source. */
export interface Measurement {
  kind: EvidenceKind;
  section: SectionId;
  score: number;
  at: Date;
  /** Standard error in score points, before aging. */
  error: number;
}

/** Margin of error (one standard error, in section score points) for each source. */
export const MEASUREMENT_ERROR: Record<Exclude<EvidenceKind, "practice">, number> = {
  official: 30,
  "bluebook-practice": 35,
  "practice-test": 50,
};

/** How much a result's margin grows per week of age, in score points. */
export const DRIFT_PER_WEEK = 4;
/** Results older than this are left out. */
export const MAX_AGE_DAYS = 365;
/** z for an 80% range. */
const Z = 1.28;
/** Narrowest half-width a section range can have. */
const MIN_HALF_WIDTH = 20;

const WEEK_MS = 7 * 24 * 3600 * 1000;

/** Margin of error for the everyday practice estimate: shrinks with more answers, never below 60 points. */
export function practiceError(answers: number): number {
  return Math.max(60, 240 / Math.sqrt(Math.max(1, answers)));
}

export interface SectionPrediction {
  section: SectionId;
  /** Most likely score, 200-800 in steps of 10. */
  score: number;
  low: number;
  high: number;
  /** Standard error in points, after combining. */
  error: number;
}

export interface ScorePrediction {
  /** Null for a section with no results yet. */
  readingWriting: SectionPrediction | null;
  math: SectionPrediction | null;
  /** Only when both sections have a prediction. */
  total: { score: number; low: number; high: number } | null;
}

/** Combine one section's measurements into a range. */
export function predictSection(section: SectionId, measurements: readonly Measurement[], now: Date): SectionPrediction | null {
  const usable = measurements.filter(
    (m) => m.section === section && now.getTime() - m.at.getTime() <= MAX_AGE_DAYS * 24 * 3600 * 1000,
  );
  if (!usable.length) return null;

  const weighted = usable.map((m) => {
    const weeks = Math.max(0, (now.getTime() - m.at.getTime()) / WEEK_MS);
    const variance = m.error ** 2 + (DRIFT_PER_WEEK * weeks) ** 2;
    return { score: m.score, w: 1 / variance };
  });
  const sumW = weighted.reduce((n, x) => n + x.w, 0);
  const mean = weighted.reduce((n, x) => n + x.w * x.score, 0) / sumW;
  let error = 1 / Math.sqrt(sumW);
  if (weighted.length > 1) {
    // Results that disagree more than their margins allow mean we know less than the margins say.
    const spread = weighted.reduce((n, x) => n + x.w * (x.score - mean) ** 2, 0) / (weighted.length - 1);
    error *= Math.sqrt(Math.max(1, spread));
  }

  const half = Math.max(MIN_HALF_WIDTH, Z * error);
  return {
    section,
    score: clampRound(mean, 200, 800),
    low: Math.max(200, Math.floor((mean - half) / 10) * 10),
    high: Math.min(800, Math.ceil((mean + half) / 10) * 10),
    error,
  };
}

export function predictScore(measurements: readonly Measurement[], now = new Date()): ScorePrediction {
  const readingWriting = predictSection("reading-writing", measurements, now);
  const math = predictSection("math", measurements, now);
  let total: ScorePrediction["total"] = null;
  if (readingWriting && math) {
    const mean = readingWriting.score + math.score;
    const half = Math.max(2 * MIN_HALF_WIDTH, Z * Math.hypot(readingWriting.error, math.error));
    total = {
      score: mean,
      low: Math.max(400, Math.floor((mean - half) / 10) * 10),
      high: Math.min(1600, Math.ceil((mean + half) / 10) * 10),
    };
  }
  return { readingWriting, math, total };
}

/** Inputs as the dashboard loads them. */
export interface PredictionSources {
  /** Score reports the student added. */
  reports: readonly { kind: "official" | "bluebook-practice"; testDate: string; readingWriting: number | null; math: number | null }[];
  /** Finished practice tests taken here. */
  tests: readonly { completedAt: Date | null; scores: { readingWriting: number; math: number } | null }[];
  /**
   * The everyday practice estimate. Pass one computed without practice test
   * answers, so a test isn't counted twice.
   */
  practice: readonly ScoreEstimate[];
}

export function measurementsFrom(sources: PredictionSources, now = new Date()): Measurement[] {
  const out: Measurement[] = [];
  for (const r of sources.reports) {
    const at = new Date(`${r.testDate}T12:00:00Z`);
    const error = MEASUREMENT_ERROR[r.kind];
    if (r.readingWriting !== null) out.push({ kind: r.kind, section: "reading-writing", score: r.readingWriting, at, error });
    if (r.math !== null) out.push({ kind: r.kind, section: "math", score: r.math, at, error });
  }
  for (const t of sources.tests) {
    if (!t.completedAt || !t.scores) continue;
    const error = MEASUREMENT_ERROR["practice-test"];
    out.push({ kind: "practice-test", section: "reading-writing", score: t.scores.readingWriting, at: t.completedAt, error });
    out.push({ kind: "practice-test", section: "math", score: t.scores.math, at: t.completedAt, error });
  }
  for (const e of sources.practice) {
    if (e.score === null) continue;
    out.push({ kind: "practice", section: e.section, score: e.score, at: now, error: practiceError(e.attempts) });
  }
  return out;
}

/** What a prediction is based on, for the "Based on ..." line. */
export function describeBasis(measurements: readonly Measurement[], practiceAnswers: number, now = new Date()): string[] {
  const recent = measurements.filter((m) => now.getTime() - m.at.getTime() <= MAX_AGE_DAYS * 24 * 3600 * 1000);
  // A report or test usually has both sections; count each once.
  const count = (kind: EvidenceKind) => new Set(recent.filter((m) => m.kind === kind).map((m) => m.at.getTime())).size;
  const parts: string[] = [];
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const official = count("official");
  const bluebook = count("bluebook-practice");
  const tests = count("practice-test");
  if (official) parts.push(plural(official, "official SAT score", "official SAT scores"));
  if (bluebook) parts.push(plural(bluebook, "Bluebook practice test", "Bluebook practice tests"));
  if (tests) parts.push(plural(tests, "full-length practice test", "full-length practice tests"));
  if (recent.some((m) => m.kind === "practice")) parts.push(plural(practiceAnswers, "practice answer", "practice answers"));
  return parts;
}

function clampRound(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.round(x / 10) * 10));
}
