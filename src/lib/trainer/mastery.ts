import { allSkills, DOMAINS, type Difficulty, type SectionId } from "../sat/taxonomy";

/**
 * Skill mastery and score estimates, computed from a student's answers.
 *
 * Each skill has an ability rating (Elo / one-parameter IRT style). Questions
 * have a fixed difficulty on the same scale (easy -1, medium 0, hard +1). The
 * chance a student answers correctly is sigmoid(rating - difficulty); after each
 * answer the rating moves toward the result, by less as attempts accumulate.
 * Everything is recomputed from the attempt history, so there is no stored
 * state to drift.
 *
 * A skill can start from a prior instead of 0: a rating read off an official
 * score report, worth a few answers' evidence. Practice answers then move the
 * rating on from there, so the report fades as real practice builds up.
 */

export const DIFFICULTY_LEVEL: Record<Difficulty, number> = { easy: -1, medium: 0, hard: 1 };

export interface AttemptLike {
  skill: string;
  difficulty: Difficulty;
  correct: boolean;
  createdAt: Date;
  practiceSetId?: string | null;
  practiceTestId?: string | null;
}

export interface SkillMastery {
  skill: string;
  rating: number;
  attempts: number;
  correct: number;
  /** Evidence carried in from a score report, counted like this many answers. 0 when there is none. */
  priorWeight?: number;
}

/** A starting rating for a skill, from outside practice (a score report). */
export interface SkillPrior {
  rating: number;
  /** How many answers' worth of evidence the prior is. */
  weight: number;
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** Chance of answering a question of this difficulty correctly. */
export function chanceCorrect(rating: number, difficulty: Difficulty): number {
  return sigmoid(rating - DIFFICULTY_LEVEL[difficulty]);
}

/** Step size: large while a skill is new, settling as evidence builds up. */
function stepSize(previousAttempts: number): number {
  return Math.max(0.3, 1.2 / Math.sqrt(1 + previousAttempts));
}

export function emptyMastery(skill: string, prior?: SkillPrior): SkillMastery {
  return prior
    ? { skill, rating: clamp(prior.rating, -3, 3), attempts: 0, correct: 0, priorWeight: prior.weight }
    : { skill, rating: 0, attempts: 0, correct: 0 };
}

/** Answers plus any prior evidence: how much the rating is based on. */
export function evidence(m: SkillMastery): number {
  return m.attempts + (m.priorWeight ?? 0);
}

export function applyAttempt(m: SkillMastery, a: Pick<AttemptLike, "difficulty" | "correct">): SkillMastery {
  const expected = chanceCorrect(m.rating, a.difficulty);
  const rating = m.rating + stepSize(evidence(m)) * ((a.correct ? 1 : 0) - expected);
  return { ...m, rating: clamp(rating, -3, 3), attempts: m.attempts + 1, correct: m.correct + (a.correct ? 1 : 0) };
}

/** Mastery for every skill in the taxonomy (unpracticed skills start at their prior, or rating 0). */
export function computeMastery(
  attempts: readonly AttemptLike[],
  priors: ReadonlyMap<string, SkillPrior> = new Map(),
): Map<string, SkillMastery> {
  const map = new Map(allSkills().map((s) => [s.skill.id, emptyMastery(s.skill.id, priors.get(s.skill.id))]));
  for (const a of chronological(attempts)) {
    const m = map.get(a.skill);
    if (m) map.set(a.skill, applyAttempt(m, a));
  }
  return map;
}

export type MasteryLevel = "not-started" | "needs-work" | "developing" | "strong";

export const MASTERY_LABELS: Record<MasteryLevel, string> = {
  "not-started": "Not started",
  "needs-work": "Needs work",
  developing: "Developing",
  strong: "Strong",
};

/** Level shown to the student, judged by the chance of getting a medium question right. */
export function masteryLevel(m: SkillMastery): MasteryLevel {
  if (evidence(m) === 0) return "not-started";
  const p = chanceCorrect(m.rating, "medium");
  return p < 0.5 ? "needs-work" : p < 0.75 ? "developing" : "strong";
}

/** The difficulty to practice next: the one the student is most likely to learn from. */
export function targetDifficulty(rating: number): Difficulty {
  if (rating < -0.5) return "easy";
  if (rating > 0.8) return "hard";
  return "medium";
}

/** Answers needed in a section before showing a score estimate. */
export const MIN_ATTEMPTS_FOR_ESTIMATE = 10;

export interface ScoreEstimate {
  section: SectionId;
  /** 200-800 in steps of 10, or null while there are too few answers. */
  score: number | null;
  attempts: number;
}

/**
 * A rough section score: the expected share of questions answered correctly
 * across the section (weighting domains by how often they appear on the test,
 * and averaging easy, medium and hard), mapped linearly onto 200-800.
 * It is a practice indicator, not a prediction of an official score.
 */
export function estimateScores(mastery: ReadonlyMap<string, SkillMastery>): ScoreEstimate[] {
  return (["reading-writing", "math"] as const).map((section) => {
    const domains = DOMAINS.filter((d) => d.section === section);
    let attempts = 0;
    let expected = 0;
    let weight = 0;
    for (const d of domains) {
      const ps = d.skills.map((s) => {
        const m = mastery.get(s.id) ?? emptyMastery(s.id);
        attempts += m.attempts;
        return (chanceCorrect(m.rating, "easy") + chanceCorrect(m.rating, "medium") + chanceCorrect(m.rating, "hard")) / 3;
      });
      expected += d.weight * (ps.reduce((x, y) => x + y, 0) / ps.length);
      weight += d.weight;
    }
    const share = expected / weight;
    const score = attempts >= MIN_ATTEMPTS_FOR_ESTIMATE ? Math.round((200 + 600 * share) / 10) * 10 : null;
    return { section, score, attempts };
  });
}

export interface ProgressPoint {
  /** The practice set or practice test these answers came from. */
  practiceSetId: string;
  at: Date;
  answered: number;
  correct: number;
  readingWriting: number | null;
  math: number | null;
}

/** The practice set or test an answer belongs to, for grouping. */
function sessionOf(a: AttemptLike): string {
  return a.practiceSetId ?? a.practiceTestId ?? "";
}

/** Score estimates after each practice set or test, for the progress chart. */
export function progressHistory(attempts: readonly AttemptLike[]): ProgressPoint[] {
  const ordered = chronological(attempts);
  const points: ProgressPoint[] = [];
  const map = computeMastery([]);
  for (let i = 0; i < ordered.length; i++) {
    const a = ordered[i];
    const m = map.get(a.skill);
    if (m) map.set(a.skill, applyAttempt(m, a));
    let point = points.at(-1);
    if (!point || point.practiceSetId !== sessionOf(a)) {
      point = { practiceSetId: sessionOf(a), at: a.createdAt, answered: 0, correct: 0, readingWriting: null, math: null };
      points.push(point);
    }
    point.answered++;
    if (a.correct) point.correct++;
    point.at = a.createdAt;
    if (!ordered[i + 1] || sessionOf(ordered[i + 1]) !== sessionOf(a)) {
      const [rw, math] = estimateScores(map);
      point.readingWriting = rw.score;
      point.math = math.score;
    }
  }
  return points;
}

function chronological<T extends AttemptLike>(attempts: readonly T[]): T[] {
  return [...attempts].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
