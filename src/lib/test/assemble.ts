import type { ModuleTier } from "../db/schema";
import { DIFFICULTIES, getSkill, type Difficulty, type SectionId } from "../sat/taxonomy";
import type { SeenQuestion } from "../trainer/plan";
import { apportion, sectionDomains, sectionFormat, TIER_MIX } from "./format";

export interface TestCandidate {
  id: string;
  skill: string;
  difficulty: Difficulty;
}

export interface AssembleInput {
  section: SectionId;
  tier: ModuleTier;
  /** Verified questions of the section. */
  candidates: readonly TestCandidate[];
  /** Questions the student has answered before (practice or earlier tests). */
  seen: ReadonlyMap<string, SeenQuestion>;
  /** Questions already in this test, never reused. */
  exclude: ReadonlySet<string>;
  random?: () => number;
}

const NEAREST: Record<Difficulty, Difficulty[]> = {
  easy: ["easy", "medium", "hard"],
  medium: ["medium", "easy", "hard"],
  hard: ["hard", "medium", "easy"],
};

/**
 * Picks one module's questions: the section's domain counts, each domain split
 * into the tier's difficulty mix. For each slot it prefers questions the
 * student hasn't seen, then ones they missed, then the right difficulty, then
 * a skill used least so far in the module, so a module covers the domain's
 * skills. If the bank runs short of a difficulty, the nearest one fills in.
 *
 * Order: Reading and Writing groups questions by domain, each group easiest to
 * hardest; Math runs easiest to hardest across the module.
 */
export function assembleModule({ section, tier, candidates, seen, exclude, random = Math.random }: AssembleInput): TestCandidate[] {
  const format = sectionFormat(section);
  const used = new Set(exclude);
  const picked: (TestCandidate & { domain: string; jitter: number })[] = [];

  for (const domain of sectionDomains(section)) {
    const pool = candidates.filter((c) => !used.has(c.id) && getSkill(c.skill).domain.id === domain);
    const counts = apportion(format.domainCounts[domain] ?? 0, TIER_MIX[tier]);
    const skillUse = new Map<string, number>();
    for (const target of DIFFICULTIES) {
      for (let i = 0; i < counts[target]; i++) {
        const freshness = (c: TestCandidate) => {
          const s = seen.get(c.id);
          return !s ? 0 : !s.correct ? 1 : 2;
        };
        const best = pool
          .filter((c) => !used.has(c.id))
          .map((c) => ({ c, key: [freshness(c), NEAREST[target].indexOf(c.difficulty), skillUse.get(c.skill) ?? 0, random()] }))
          .sort((a, b) => {
            for (let k = 0; k < a.key.length; k++) if (a.key[k] !== b.key[k]) return a.key[k] - b.key[k];
            return 0;
          })[0]?.c;
        if (!best) break;
        used.add(best.id);
        skillUse.set(best.skill, (skillUse.get(best.skill) ?? 0) + 1);
        picked.push({ ...best, domain, jitter: random() });
      }
    }
  }

  const level = (d: Difficulty) => DIFFICULTIES.indexOf(d);
  const domainOrder = sectionDomains(section);
  return picked
    .sort((a, b) =>
      section === "reading-writing"
        ? domainOrder.indexOf(a.domain) - domainOrder.indexOf(b.domain) || level(a.difficulty) - level(b.difficulty) || a.jitter - b.jitter
        : level(a.difficulty) - level(b.difficulty) || a.jitter - b.jitter,
    )
    .map(({ id, skill, difficulty }) => ({ id, skill, difficulty }));
}
