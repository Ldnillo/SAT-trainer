import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createUser } from "../src/lib/auth/accounts";
import { grantPass, testAccess } from "../src/lib/billing/pass";
import { openDb, type Db } from "../src/lib/db/client";
import { insertQuestions, type NewQuestion } from "../src/lib/db/questions";
import { testAnswers } from "../src/lib/db/schema";
import type { QuestionContent } from "../src/lib/sat/question";
import { allSkills, DIFFICULTIES, getSkill, type Difficulty } from "../src/lib/sat/taxonomy";
import { assembleModule, type TestCandidate } from "../src/lib/test/assemble";
import { apportion, TIER_MIX } from "../src/lib/test/format";
import { routeFor, sectionScore, type ScoredResponse } from "../src/lib/test/scoring";
import {
  beginModule,
  closeExpiredModule,
  currentModuleIndex,
  getTest,
  loadModuleItems,
  saveTestAnswer,
  startTest,
  submitModule,
  unfinishedTest,
} from "../src/lib/test/tests";
import { loadAttempts } from "../src/lib/trainer/practice";
import { rwQuestion, sprQuestion } from "./fixtures";

function seeded(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

/** `perLevel` questions of each difficulty for every skill in the taxonomy. */
function bank(perLevel: number): TestCandidate[] {
  return allSkills().flatMap((s) =>
    DIFFICULTIES.flatMap((difficulty) =>
      Array.from({ length: perLevel }, (_, i) => ({ id: `${s.skill.id}-${difficulty}-${i}`, skill: s.skill.id, difficulty })),
    ),
  );
}

const level = (d: Difficulty) => DIFFICULTIES.indexOf(d);
const count = (qs: TestCandidate[], d: Difficulty) => qs.filter((q) => q.difficulty === d).length;

describe("test format", () => {
  it("apportions whole numbers that add up", () => {
    expect(apportion(27, TIER_MIX.standard)).toEqual({ easy: 9, medium: 9, hard: 9 });
    expect(apportion(8, TIER_MIX.harder)).toEqual({ easy: 1, medium: 3, hard: 4 });
    expect(Object.values(apportion(5, TIER_MIX.easier)).reduce((a, b) => a + b)).toBe(5);
  });
});

describe("assembling a module", () => {
  const candidates = bank(4);
  const none = new Map();

  it("fills each domain's count, Reading and Writing grouped by domain and easiest first", () => {
    const m = assembleModule({ section: "reading-writing", tier: "standard", candidates, seen: none, exclude: new Set(), random: seeded() });
    expect(m).toHaveLength(27);
    expect(new Set(m.map((q) => q.id)).size).toBe(27);
    const domains = m.map((q) => getSkill(q.skill).domain.id);
    expect(domains.filter((d) => d === "craft-and-structure")).toHaveLength(8);
    expect(domains.filter((d) => d === "expression-of-ideas")).toHaveLength(5);
    // Domain blocks in test order, each easiest to hardest.
    for (let i = 1; i < m.length; i++) {
      if (domains[i] === domains[i - 1]) expect(level(m[i].difficulty)).toBeGreaterThanOrEqual(level(m[i - 1].difficulty));
    }
    expect([...new Set(domains)]).toEqual(["craft-and-structure", "information-and-ideas", "standard-english-conventions", "expression-of-ideas"]);
    // Skills within a domain are spread out.
    expect(new Set(m.filter((q) => getSkill(q.skill).domain.id === "craft-and-structure").map((q) => q.skill)).size).toBe(3);
  });

  it("orders Math easiest to hardest and makes the harder module harder", () => {
    const harder = assembleModule({ section: "math", tier: "harder", candidates, seen: none, exclude: new Set(), random: seeded() });
    const easier = assembleModule({ section: "math", tier: "easier", candidates, seen: none, exclude: new Set(), random: seeded() });
    expect(harder).toHaveLength(22);
    expect(harder.every((q) => getSkill(q.skill).section === "math")).toBe(true);
    for (let i = 1; i < harder.length; i++) expect(level(harder[i].difficulty)).toBeGreaterThanOrEqual(level(harder[i - 1].difficulty));
    expect(count(harder, "hard")).toBeGreaterThan(count(easier, "hard"));
    expect(count(easier, "easy")).toBeGreaterThan(count(harder, "easy"));
  });

  it("never reuses questions in the test and prefers ones the student hasn't seen", () => {
    const first = assembleModule({ section: "math", tier: "standard", candidates, seen: none, exclude: new Set(), random: seeded() });
    const second = assembleModule({ section: "math", tier: "harder", candidates, seen: none, exclude: new Set(first.map((q) => q.id)), random: seeded(2) });
    expect(second.some((q) => first.some((f) => f.id === q.id))).toBe(false);

    const seen = new Map(candidates.filter((c) => c.difficulty === "hard" && c.id.endsWith("-0")).map((c) => [c.id, { correct: true, at: new Date() }]));
    const fresh = assembleModule({ section: "math", tier: "standard", candidates, seen, exclude: new Set(), random: seeded() });
    expect(fresh.some((q) => seen.has(q.id))).toBe(false);
  });

  it("falls back to the nearest difficulty when the bank is thin", () => {
    const easyOnly = candidates.filter((c) => c.difficulty !== "hard");
    const m = assembleModule({ section: "math", tier: "harder", candidates: easyOnly, seen: none, exclude: new Set(), random: seeded() });
    expect(m).toHaveLength(22);
    expect(count(m, "hard")).toBe(0);
  });
});

describe("scoring", () => {
  const responses = (spec: [Difficulty, number, number][]): ScoredResponse[] =>
    spec.flatMap(([difficulty, right, total]) => Array.from({ length: total }, (_, i) => ({ difficulty, correct: i < right })));

  it("routes on the share of module 1 answered correctly", () => {
    expect(routeFor(responses([["medium", 17, 27]]))).toBe("harder");
    expect(routeFor(responses([["medium", 16, 27]]))).toBe("easier");
  });

  it("maps a perfect test to 800 and an empty one to 200", () => {
    const m1 = responses([["easy", 9, 9], ["medium", 9, 9], ["hard", 9, 9]]);
    const hard2 = responses([["easy", 4, 4], ["medium", 9, 9], ["hard", 14, 14]]);
    expect(sectionScore([...m1, ...hard2])).toBe(800);
    expect(sectionScore([...m1, ...hard2].map((r) => ({ ...r, correct: false })))).toBe(200);
  });

  it("counts harder questions for more, so the easier route can't reach the top", () => {
    const m1 = responses([["easy", 9, 9], ["medium", 9, 9], ["hard", 9, 9]]);
    const easy2 = responses([["easy", 14, 14], ["medium", 9, 9], ["hard", 4, 4]]);
    const perfectEasier = sectionScore([...m1.map((r) => ({ ...r, correct: r.difficulty !== "hard" })), ...easy2]);
    expect(perfectEasier).toBeLessThan(750);
    // The same number right scores higher when the questions were harder.
    const onEasier = sectionScore(responses([["easy", 20, 23], ["medium", 12, 19], ["hard", 8, 12]]));
    const onHarder = sectionScore(responses([["easy", 13, 13], ["medium", 18, 19], ["hard", 9, 22]]));
    expect(onHarder).toBeGreaterThan(onEasier);
    const scores = [10, 20, 30, 40].map((right) => sectionScore(responses([["medium", right, 54]])));
    expect([...scores].sort((a, b) => a - b)).toEqual(scores);
  });
});

describe("practice tests (database)", () => {
  let db: Db;
  let close: () => Promise<void>;
  let userId: string;
  const NOW = new Date("2026-10-04T12:00:00Z");
  const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

  function row(skill: string, difficulty: Difficulty, content: QuestionContent): NewQuestion {
    const ref = getSkill(skill);
    return {
      sourceId: null,
      section: ref.section,
      domain: ref.domain.id,
      skill,
      difficulty,
      format: content.choices.length ? "multiple-choice" : "student-produced-response",
      status: "verified",
      content,
      validationIssues: [],
      verification: null,
      provenance: {
        generator: "authored",
        promptVersion: "test",
        createdAt: "2026-01-01",
        authorship: {
          writer: { name: "test", date: "2026-01-01" },
          inputs: { instructions: "test", examples: [] },
          passageSource: "original",
          reviews: [{ reviewer: "test", date: "2026-01-01", edits: "none" }],
        },
      },
    };
  }

  beforeEach(async () => {
    ({ db, close } = await openDb("memory://"));
    const r = await createUser(db, { email: "t@e.st", name: "T", password: "password1" });
    if (!r.ok) throw new Error("setup");
    userId = r.user.id;
    // Every question's key is A (multiple choice) or 7/4 (grid-in).
    await insertQuestions(
      db,
      allSkills().flatMap((s) =>
        DIFFICULTIES.flatMap((d) =>
          Array.from({ length: 4 }, (_, i) => row(s.skill.id, d, s.section === "math" && i % 2 ? sprQuestion() : rwQuestion())),
        ),
      ),
    );
  });
  afterEach(async () => close());

  /** Answers every question in the current module: `right` of them correctly. */
  async function answerModule(testId: string, right: number, at: Date) {
    const test = (await getTest(db, userId, testId))!;
    const index = currentModuleIndex(test);
    const items = await loadModuleItems(db, test, index);
    for (const [i, { question }] of items.entries()) {
      const correct = i < right;
      const answer = question.content.choices.length ? (correct ? "A" : "B") : correct ? "7/4" : "2";
      expect(await saveTestAnswer(db, userId, testId, question.id, { answer, flagged: false }, at)).toEqual({ ok: true });
    }
    return items.length;
  }

  it("needs a season pass, unless free tests are configured", async () => {
    expect((await testAccess(db, userId, NOW, 0)).allowed).toBe(false);
    expect((await testAccess(db, userId, NOW, 1)).freeTestsLeft).toBe(1);
    await grantPass(db, { userId, checkoutSessionId: "cs_1", paymentIntentId: "pi_1", amountCents: 3900, currency: "usd", days: 90 }, NOW);
    expect((await testAccess(db, userId, NOW, 0)).allowed).toBe(true);
  });

  it("runs four timed modules, routes module 2 and scores the test", async () => {
    const test = (await startTest(db, userId, seeded()))!;
    expect(test.modules).toHaveLength(1);
    expect(test.modules[0]).toMatchObject({ section: "reading-writing", stage: 1, tier: "standard" });
    expect(test.modules[0].questionIds).toHaveLength(27);
    expect((await unfinishedTest(db, userId))?.id).toBe(test.id);

    // Answers aren't accepted before the module starts.
    const q0 = test.modules[0].questionIds[0];
    expect(await saveTestAnswer(db, userId, test.id, q0, { answer: "A", flagged: false }, NOW)).toEqual({ ok: false, error: "not-current" });
    expect(await submitModule(db, userId, test.id, 0, NOW)).toBe(false);

    // RW module 1: all right, so module 2 is harder.
    expect(await beginModule(db, userId, test.id, 0, NOW)).toBe(true);
    await answerModule(test.id, 27, later(10));
    // Changing an answer and flagging keep one row per question.
    await saveTestAnswer(db, userId, test.id, q0, { answer: "C", flagged: true }, later(11));
    await saveTestAnswer(db, userId, test.id, q0, { answer: "A", flagged: true }, later(12));
    expect(await submitModule(db, userId, test.id, 0, later(20), seeded(2))).toBe(true);
    expect(await submitModule(db, userId, test.id, 0, later(20))).toBe(false);
    let t = (await getTest(db, userId, test.id))!;
    expect(t.modules[1]).toMatchObject({ section: "reading-writing", stage: 2, tier: "harder" });
    expect(t.modules[1].questionIds.some((id) => t.modules[0].questionIds.includes(id))).toBe(false);

    // RW module 2: the clock runs out with nothing answered; it closes itself.
    await beginModule(db, userId, test.id, 1, later(30));
    expect(await saveTestAnswer(db, userId, test.id, t.modules[1].questionIds[0], { answer: "A", flagged: false }, later(30 + 33))).toEqual({
      ok: false,
      error: "time-up",
    });
    t = await closeExpiredModule(db, userId, (await getTest(db, userId, test.id))!, later(30 + 33));
    expect(currentModuleIndex(t)).toBe(2);
    expect(t.modules[2]).toMatchObject({ section: "math", stage: 1, tier: "standard" });

    // Math module 1: a third right, so module 2 is easier.
    await beginModule(db, userId, test.id, 2, later(80));
    await answerModule(test.id, 7, later(90));
    await submitModule(db, userId, test.id, 2, later(100));
    t = (await getTest(db, userId, test.id))!;
    expect(t.modules[3]).toMatchObject({ section: "math", stage: 2, tier: "easier" });

    await beginModule(db, userId, test.id, 3, later(110));
    await answerModule(test.id, 22, later(120));
    await submitModule(db, userId, test.id, 3, later(130));
    t = (await getTest(db, userId, test.id))!;
    expect(currentModuleIndex(t)).toBe(-1);
    expect(t.completedAt).not.toBeNull();
    expect(t.scores!.total).toBe(t.scores!.readingWriting + t.scores!.math);
    expect(t.scores!.readingWriting).toBeGreaterThan(200);
    expect(t.scores!.readingWriting).toBeLessThan(800);
    expect(await unfinishedTest(db, userId)).toBeUndefined();

    // Answered questions count toward mastery; unanswered ones don't.
    const history = await loadAttempts(db, userId);
    expect(history).toHaveLength(27 + 22 + 22);
    expect(history.every((a) => a.practiceTestId === test.id && a.practiceSetId === null)).toBe(true);
    const graded = await db.select().from(testAnswers);
    expect(graded.every((a) => a.correct !== null)).toBe(true);
  });

  it("keeps each student's tests to themselves", async () => {
    const test = (await startTest(db, userId, seeded()))!;
    const other = await createUser(db, { email: "o@e.st", name: "O", password: "password1" });
    if (!other.ok) throw new Error("setup");
    expect(await getTest(db, other.user.id, test.id)).toBeUndefined();
    expect(await beginModule(db, other.user.id, test.id, 0, NOW)).toBe(false);
  });
});
