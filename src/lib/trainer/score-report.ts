import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { scoreReports, type DomainBands, type SkillResults } from "../db/schema";
import { DOMAINS, type SectionId } from "../sat/taxonomy";
import { sigmoid, type SkillPrior } from "./mastery";

/**
 * Scores a student brings in from an official SAT or a Bluebook practice test,
 * and how the trainer turns them into a starting rating for each skill.
 *
 * College Board score reports show a section score (200-800) and, for each of
 * the eight content domains, a performance band drawn as 1 to 7 filled boxes.
 * Bluebook practice results add a question-by-question review that names each
 * question's skill, so students can optionally count right answers per skill.
 * Nothing from College Board is copied here; the domain and skill names are the
 * public test specification names already used by the question bank.
 */

export type ScoreReport = typeof scoreReports.$inferSelect;
export type ScoreReportKind = ScoreReport["kind"];

export const REPORT_KINDS: Record<ScoreReportKind, string> = {
  official: "Official SAT",
  "bluebook-practice": "Bluebook practice test",
};

export const MAX_BAND = 7;

/** What a student entered, checked and ready to save. */
export interface ScoreReportInput {
  kind: ScoreReportKind;
  testDate: string;
  readingWriting: number | null;
  math: number | null;
  domainBands: DomainBands;
  skillResults: SkillResults;
}

export type ParseResult = { ok: true; report: ScoreReportInput } | { ok: false; errors: string[] };

const SECTION_LABEL: Record<SectionId, string> = { "reading-writing": "Reading and Writing", math: "Math" };

/**
 * Reads the score entry form. Field names:
 * kind, testDate, score-<section>, band-<domain>, correct-<skill>, total-<skill>.
 * Everything except the kind and date is optional, but at least one score is needed.
 */
export function parseScoreReportForm(form: FormData, today = new Date()): ParseResult {
  const errors: string[] = [];
  const field = (name: string) => {
    const v = form.get(name);
    return typeof v === "string" ? v.trim() : "";
  };

  const kind = field("kind");
  if (kind !== "official" && kind !== "bluebook-practice") errors.push("Choose whether this was an official SAT or a Bluebook practice test.");

  const testDate = field("testDate");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(testDate) ? new Date(`${testDate}T00:00:00Z`) : null;
  if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== testDate) {
    errors.push("Enter the date you took the test.");
  } else if (date.getTime() > today.getTime() + 24 * 3600 * 1000) {
    errors.push("The test date can't be in the future.");
  } else if (testDate < "2023-01-01") {
    errors.push("Only digital SAT results (2023 or later) can be used.");
  }

  const sectionScore = (section: SectionId): number | null => {
    const raw = field(`score-${section}`);
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 200 || n > 800 || n % 10 !== 0) {
      errors.push(`${SECTION_LABEL[section]} score must be a number from 200 to 800 that ends in 0.`);
      return null;
    }
    return n;
  };
  const readingWriting = sectionScore("reading-writing");
  const math = sectionScore("math");

  const domainBands: DomainBands = {};
  for (const d of DOMAINS) {
    const raw = field(`band-${d.id}`);
    if (!raw) continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > MAX_BAND) errors.push(`${d.name}: pick from 1 to ${MAX_BAND} boxes.`);
    else domainBands[d.id] = n;
  }

  const skillResults: SkillResults = {};
  for (const d of DOMAINS) {
    for (const s of d.skills) {
      const rawCorrect = field(`correct-${s.id}`);
      const rawTotal = field(`total-${s.id}`);
      if (!rawCorrect && !rawTotal) continue;
      const correct = Number(rawCorrect || "0");
      const total = Number(rawTotal);
      if (!rawTotal || !Number.isInteger(total) || total < 1 || total > 30) {
        errors.push(`${s.name}: enter how many questions there were (1 to 30).`);
      } else if (!Number.isInteger(correct) || correct < 0 || correct > total) {
        errors.push(`${s.name}: the number right must be between 0 and ${total}.`);
      } else {
        skillResults[s.id] = { correct, total };
      }
    }
  }

  if (errors.length === 0 && readingWriting === null && math === null && !Object.keys(domainBands).length && !Object.keys(skillResults).length) {
    errors.push("Enter at least one score: a section score, a box count for a content area, or a skill's results.");
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, report: { kind: kind as ScoreReportKind, testDate, readingWriting, math, domainBands, skillResults } };
}

/** Expected share right across easy, medium and hard questions, the same measure the score estimate uses. */
function expectedShare(rating: number): number {
  return (sigmoid(rating + 1) + sigmoid(rating) + sigmoid(rating - 1)) / 3;
}

/** The rating whose expected share right is `share` (inverse of expectedShare). */
export function ratingForShare(share: number): number {
  const target = Math.min(0.97, Math.max(0.03, share));
  let lo = -3;
  let hi = 3;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (expectedShare(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** A section score as a rating, on the same 200-800 mapping the dashboard estimate uses. */
export function ratingForSectionScore(score: number): number {
  return ratingForShare((score - 200) / 600);
}

/** A domain's 1-7 boxes as a rating: each box stands for a seventh of the 200-800 range. */
export function ratingForBand(band: number): number {
  return ratingForSectionScore(200 + ((band - 0.5) / MAX_BAND) * 600);
}

/** How many answers' worth of evidence each kind of result counts as. */
const WEIGHT = { section: 0.5, band: 1.5, skillQuestion: 1, skillMax: 4, total: 5 };

/**
 * A starting rating for every skill the report says something about. A skill's
 * own results count most, then its domain's boxes, then the section score
 * (used only when its domain has no boxes). The combined evidence is capped at
 * a few answers, so practice soon takes over.
 */
export function priorsFromReport(report: Pick<ScoreReport, "readingWriting" | "math" | "domainBands" | "skillResults">): Map<string, SkillPrior> {
  const priors = new Map<string, SkillPrior>();
  const sectionScores: Record<SectionId, number | null> = { "reading-writing": report.readingWriting, math: report.math };
  for (const d of DOMAINS) {
    const band = report.domainBands[d.id];
    const section = sectionScores[d.section];
    for (const s of d.skills) {
      const parts: SkillPrior[] = [];
      if (band) parts.push({ rating: ratingForBand(band), weight: WEIGHT.band });
      else if (section) parts.push({ rating: ratingForSectionScore(section), weight: WEIGHT.section });
      const r = report.skillResults[s.id];
      if (r && r.total > 0) {
        // Smoothed so 0 of 2 or 2 of 2 doesn't read as certain.
        parts.push({ rating: ratingForShare((r.correct + 0.5) / (r.total + 1)), weight: Math.min(r.total * WEIGHT.skillQuestion, WEIGHT.skillMax) });
      }
      if (!parts.length) continue;
      const weight = parts.reduce((n, p) => n + p.weight, 0);
      const rating = parts.reduce((n, p) => n + p.rating * p.weight, 0) / weight;
      priors.set(s.id, { rating: Math.round(rating * 1000) / 1000, weight: Math.min(weight, WEIGHT.total) });
    }
  }
  return priors;
}

export function reportTotal(report: Pick<ScoreReport, "readingWriting" | "math">): number | null {
  return report.readingWriting !== null && report.math !== null ? report.readingWriting + report.math : null;
}

export async function listScoreReports(db: Db, userId: string): Promise<ScoreReport[]> {
  return db
    .select()
    .from(scoreReports)
    .where(eq(scoreReports.userId, userId))
    .orderBy(desc(scoreReports.testDate), desc(scoreReports.createdAt));
}

/** The report the trainer uses: the most recent test. */
export async function latestScoreReport(db: Db, userId: string): Promise<ScoreReport | undefined> {
  return (await listScoreReports(db, userId))[0];
}

/** Starting ratings from the latest report, or none. */
export async function loadPriors(db: Db, userId: string): Promise<Map<string, SkillPrior>> {
  const report = await latestScoreReport(db, userId);
  return report ? priorsFromReport(report) : new Map();
}

export async function addScoreReport(db: Db, userId: string, input: ScoreReportInput): Promise<ScoreReport> {
  const [row] = await db.insert(scoreReports).values({ userId, ...input }).returning();
  return row;
}

export async function deleteScoreReport(db: Db, userId: string, id: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await db.delete(scoreReports).where(and(eq(scoreReports.id, id), eq(scoreReports.userId, userId)));
}
