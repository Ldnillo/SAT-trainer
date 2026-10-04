import type { ModuleTier } from "../db/schema";
import type { Difficulty } from "../sat/taxonomy";
import { DIFFICULTY_LEVEL, sigmoid } from "../trainer/mastery";
import { HARDER_ROUTE_THRESHOLD } from "./format";

/**
 * Scoring for practice tests.
 *
 * The digital SAT scores each section with item response theory: harder
 * questions count for more, which is why the harder module 2 opens the top of
 * the scale. We do the same in a simplified form. Each question has the fixed
 * difficulty the trainer uses (easy -1, medium 0, hard +1); the student's
 * ability is estimated from every answer in the section (expected a
 * posteriori, with a standard normal prior) and mapped linearly onto 200-800.
 * Unanswered questions count as wrong. It is a practice estimate, not an
 * official score.
 */

export interface ScoredResponse {
  difficulty: Difficulty;
  correct: boolean;
}

/** How sharply a question separates students above and below its difficulty. */
const DISCRIMINATION = 1.7;
/** Section score points per unit of ability. */
const POINTS_PER_UNIT = 125;
const GRID = Array.from({ length: 161 }, (_, i) => -4 + i * 0.05);

export function routeFor(module1: readonly ScoredResponse[]): Exclude<ModuleTier, "standard"> {
  const correct = module1.filter((r) => r.correct).length;
  return module1.length > 0 && correct / module1.length >= HARDER_ROUTE_THRESHOLD ? "harder" : "easier";
}

/** Estimated ability on the trainer's difficulty scale. */
export function estimateAbility(responses: readonly ScoredResponse[]): number {
  let weight = 0;
  let sum = 0;
  for (const theta of GRID) {
    let logLikelihood = -(theta * theta) / 2;
    for (const r of responses) {
      const p = sigmoid(DISCRIMINATION * (theta - DIFFICULTY_LEVEL[r.difficulty]));
      logLikelihood += Math.log(r.correct ? p : 1 - p);
    }
    const w = Math.exp(logLikelihood);
    weight += w;
    sum += w * theta;
  }
  return sum / weight;
}

/** A 200-800 section score, in steps of 10. */
export function sectionScore(responses: readonly ScoredResponse[]): number {
  const score = 500 + POINTS_PER_UNIT * estimateAbility(responses);
  return Math.min(800, Math.max(200, Math.round(score / 10) * 10));
}
