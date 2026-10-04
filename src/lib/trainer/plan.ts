import { allSkills, type Difficulty } from "../sat/taxonomy";
import { chanceCorrect, emptyMastery, targetDifficulty, type SkillMastery } from "./mastery";

/**
 * Picks the questions for a practice set.
 *
 * Skills are drawn at random, weighted by priority: how much a skill counts on
 * the test (its domain's weight shared among the domain's skills) times how
 * much room the student has to improve, plus a bonus for skills with little
 * evidence yet. A skill already in the set is less likely to be drawn again,
 * so a set covers several weak skills rather than drilling one.
 * Each skill's question is chosen at the difficulty that suits the student's
 * rating, preferring questions they haven't seen, then ones they got wrong.
 */

export interface Candidate {
  id: string;
  skill: string;
  difficulty: Difficulty;
}

export interface SeenQuestion {
  correct: boolean;
  at: Date;
}

export interface PlanInput {
  /** Candidate questions (verified only), for every skill allowed in this set. */
  candidates: readonly Candidate[];
  mastery: ReadonlyMap<string, SkillMastery>;
  /** Questions this student has answered before, by question id (latest answer). */
  seen: ReadonlyMap<string, SeenQuestion>;
  size: number;
  random?: () => number;
}

const IMPORTANCE: ReadonlyMap<string, number> = new Map(
  allSkills().map((s) => [s.skill.id, s.domain.weight / s.domain.skills.length]),
);

/** How useful practicing this skill is right now. */
export function skillPriority(m: SkillMastery): number {
  const room = 1 - chanceCorrect(m.rating, "medium");
  const uncertainty = 1 / (1 + m.attempts);
  return (IMPORTANCE.get(m.skill) ?? 0.05) * (room + 0.5 * uncertainty);
}

const FALLBACK: Record<Difficulty, Difficulty[]> = {
  easy: ["easy", "medium", "hard"],
  medium: ["medium", "easy", "hard"],
  hard: ["hard", "medium", "easy"],
};

/** Best question for one skill: unseen first, then missed, then the longest ago seen; nearest difficulty within each group. */
export function pickQuestion(
  candidates: readonly Candidate[],
  target: Difficulty,
  seen: ReadonlyMap<string, SeenQuestion>,
  random: () => number = Math.random,
): Candidate | undefined {
  const freshness = (c: Candidate) => {
    const s = seen.get(c.id);
    return !s ? 0 : !s.correct ? 1 : 2;
  };
  const order = FALLBACK[target];
  const ranked = candidates
    .map((c) => ({ c, key: [freshness(c), order.indexOf(c.difficulty), seen.get(c.id)?.at.getTime() ?? 0, random()] }))
    .sort((a, b) => {
      for (let i = 0; i < a.key.length; i++) if (a.key[i] !== b.key[i]) return a.key[i] - b.key[i];
      return 0;
    });
  return ranked[0]?.c;
}

export function planPracticeSet({ candidates, mastery, seen, size, random = Math.random }: PlanInput): Candidate[] {
  const bySkill = new Map<string, Candidate[]>();
  for (const c of candidates) bySkill.set(c.skill, [...(bySkill.get(c.skill) ?? []), c]);

  const chosen: Candidate[] = [];
  const timesPicked = new Map<string, number>();
  while (chosen.length < size) {
    const open = [...bySkill.entries()].filter(([, cs]) => cs.length > 0);
    if (open.length === 0) break;
    const weights = open.map(([skill]) => {
      const m = mastery.get(skill) ?? emptyMastery(skill);
      return skillPriority(m) / (1 + 2 * (timesPicked.get(skill) ?? 0));
    });
    const [skill, pool] = open[weightedIndex(weights, random)];
    const m = mastery.get(skill) ?? emptyMastery(skill);
    const q = pickQuestion(pool, targetDifficulty(m.rating), seen, random)!;
    chosen.push(q);
    pool.splice(pool.indexOf(q), 1);
    timesPicked.set(skill, (timesPicked.get(skill) ?? 0) + 1);
  }
  return chosen;
}

function weightedIndex(weights: number[], random: () => number): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}
