import type { ModuleTier } from "../db/schema";
import { DOMAINS, type Difficulty, type SectionId } from "../sat/taxonomy";

/**
 * The shape of a full-length practice test, following the public digital SAT
 * specifications: two sections, each in two timed modules. Module 1 mixes easy,
 * medium and hard questions; module 2 is easier or harder depending on how the
 * student did in module 1. The real test also includes a few unscored pretest
 * questions per module; ours are all scored.
 */

export interface SectionFormat {
  section: SectionId;
  questionsPerModule: number;
  minutesPerModule: number;
  /** Questions per domain in every module, in the order Reading and Writing shows them. */
  domainCounts: Record<string, number>;
}

export const TEST_FORMAT: readonly SectionFormat[] = [
  {
    section: "reading-writing",
    questionsPerModule: 27,
    minutesPerModule: 32,
    domainCounts: {
      "craft-and-structure": 8,
      "information-and-ideas": 7,
      "standard-english-conventions": 7,
      "expression-of-ideas": 5,
    },
  },
  {
    section: "math",
    questionsPerModule: 22,
    minutesPerModule: 35,
    domainCounts: {
      algebra: 8,
      "advanced-math": 8,
      "problem-solving-and-data-analysis": 3,
      "geometry-and-trigonometry": 3,
    },
  },
];

/** Suggested break between the sections. */
export const BREAK_MINUTES = 10;

/**
 * Seconds of slack after the clock runs out, for an answer that was on its way
 * when time ended. Answers saved later are refused.
 */
export const GRACE_SECONDS = 15;

/** Share of module 1 answered correctly that routes a student to the harder module 2. */
export const HARDER_ROUTE_THRESHOLD = 0.6;

/** Difficulty mix of each kind of module. */
export const TIER_MIX: Record<ModuleTier, Record<Difficulty, number>> = {
  standard: { easy: 1 / 3, medium: 1 / 3, hard: 1 / 3 },
  easier: { easy: 0.5, medium: 0.35, hard: 0.15 },
  harder: { easy: 0.15, medium: 0.35, hard: 0.5 },
};

export function sectionFormat(section: SectionId): SectionFormat {
  return TEST_FORMAT.find((f) => f.section === section)!;
}

/** The four modules in the order they're taken. */
export const MODULE_ORDER: readonly { section: SectionId; stage: 1 | 2 }[] = TEST_FORMAT.flatMap((f) => [
  { section: f.section, stage: 1 as const },
  { section: f.section, stage: 2 as const },
]);

export const TOTAL_MINUTES = TEST_FORMAT.reduce((n, f) => n + 2 * f.minutesPerModule, 0);
export const TOTAL_QUESTIONS = TEST_FORMAT.reduce((n, f) => n + 2 * f.questionsPerModule, 0);

/** Splits `total` into whole numbers in proportion to `shares` (largest remainder). */
export function apportion<K extends string>(total: number, shares: Record<K, number>): Record<K, number> {
  const keys = Object.keys(shares) as K[];
  const sum = keys.reduce((n, k) => n + shares[k], 0);
  const exact = keys.map((k) => ({ k, x: (total * shares[k]) / sum }));
  const out = Object.fromEntries(exact.map(({ k, x }) => [k, Math.floor(x)])) as Record<K, number>;
  let left = total - keys.reduce((n, k) => n + out[k], 0);
  for (const { k } of [...exact].sort((a, b) => (b.x % 1) - (a.x % 1) || keys.indexOf(a.k) - keys.indexOf(b.k))) {
    if (left-- <= 0) break;
    out[k]++;
  }
  return out;
}

/** Domain ids of a section, in test order. */
export function sectionDomains(section: SectionId): string[] {
  return DOMAINS.filter((d) => d.section === section).map((d) => d.id);
}
