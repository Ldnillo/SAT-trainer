import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createUser } from "../src/lib/auth/accounts";
import { openDb, type Db } from "../src/lib/db/client";
import { practiceTests } from "../src/lib/db/schema";
import { completedTests } from "../src/lib/test/tests";
import {
  describeBasis,
  measurementsFrom,
  practiceError,
  predictScore,
  predictSection,
  type Measurement,
} from "../src/lib/trainer/prediction";

const NOW = new Date("2026-10-05T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 3600 * 1000);

function m(score: number, overrides: Partial<Measurement> = {}): Measurement {
  return { kind: "practice-test", section: "math", score, at: NOW, error: 50, ...overrides };
}

describe("section prediction", () => {
  it("is null with no results", () => {
    expect(predictSection("math", [], NOW)).toBeNull();
    expect(predictSection("math", [m(600, { section: "reading-writing" })], NOW)).toBeNull();
  });

  it("centres one result with a range from its margin of error", () => {
    const p = predictSection("math", [m(600)], NOW)!;
    expect(p.score).toBe(600);
    expect(p.low).toBe(530);
    expect(p.high).toBe(670);
  });

  it("narrows as agreeing results add up", () => {
    const one = predictSection("math", [m(600)], NOW)!;
    const three = predictSection("math", [m(600), m(610), m(590)], NOW)!;
    expect(three.high - three.low).toBeLessThan(one.high - one.low);
    expect(three.score).toBe(600);
  });

  it("widens when results disagree more than their margins explain", () => {
    const agree = predictSection("math", [m(600), m(610)], NOW)!;
    const disagree = predictSection("math", [m(450), m(750)], NOW)!;
    expect(disagree.high - disagree.low).toBeGreaterThan(agree.high - agree.low);
  });

  it("trusts an official score more than a practice estimate", () => {
    const p = predictSection("math", [m(700, { kind: "official", error: 30 }), m(500, { kind: "practice", error: 60 })], NOW)!;
    expect(p.score).toBe(660);
  });

  it("counts older results for less and drops ones over a year old", () => {
    const p = predictSection("math", [m(500, { at: daysAgo(180) }), m(650)], NOW)!;
    expect(p.score).toBeGreaterThan(620);
    expect(predictSection("math", [m(500, { at: daysAgo(400) })], NOW)).toBeNull();
  });

  it("stays on the 200-800 scale", () => {
    const top = predictSection("math", [m(800)], NOW)!;
    const bottom = predictSection("math", [m(200)], NOW)!;
    expect(top.high).toBe(800);
    expect(bottom.low).toBe(200);
  });
});

describe("total prediction", () => {
  it("needs both sections", () => {
    expect(predictScore([m(600)], NOW).total).toBeNull();
  });

  it("adds the sections and combines their margins", () => {
    const p = predictScore([m(600), m(550, { section: "reading-writing" })], NOW);
    expect(p.total!.score).toBe(1150);
    // Wider than either section's range, narrower than the two added together.
    expect(p.total!.high - p.total!.low).toBeGreaterThan(p.math!.high - p.math!.low);
    expect(p.total!.high - p.total!.low).toBeLessThan(p.math!.high - p.math!.low + (p.readingWriting!.high - p.readingWriting!.low));
  });
});

describe("measurements", () => {
  const sources = {
    reports: [
      { kind: "official" as const, testDate: "2026-08-23", readingWriting: 580, math: null },
      { kind: "bluebook-practice" as const, testDate: "2026-09-12", readingWriting: 600, math: 620 },
    ],
    tests: [
      { completedAt: daysAgo(3), scores: { readingWriting: 610, math: 640 } },
      { completedAt: null, scores: null },
    ],
    practice: [
      { section: "reading-writing" as const, score: 590, attempts: 40 },
      { section: "math" as const, score: null, attempts: 4 },
    ],
  };

  it("reads reports, finished tests and the practice estimate", () => {
    const ms = measurementsFrom(sources, NOW);
    expect(ms.map((x) => `${x.kind}:${x.section}:${x.score}`)).toEqual([
      "official:reading-writing:580",
      "bluebook-practice:reading-writing:600",
      "bluebook-practice:math:620",
      "practice-test:reading-writing:610",
      "practice-test:math:640",
      "practice:reading-writing:590",
    ]);
  });

  it("describes what the prediction is based on", () => {
    expect(describeBasis(measurementsFrom(sources, NOW), 40, NOW)).toEqual([
      "1 official SAT score",
      "1 Bluebook practice test",
      "1 full-length practice test",
      "40 practice answers",
    ]);
  });

  it("gives the practice estimate a margin that shrinks with more answers", () => {
    expect(practiceError(10)).toBeGreaterThan(practiceError(16));
    expect(practiceError(1000)).toBe(60);
  });
});

describe("completed tests", () => {
  let db: Db;
  let close: () => Promise<void>;
  beforeEach(async () => ({ db, close } = await openDb("memory://")));
  afterEach(() => close());

  it("lists only finished tests, newest first", async () => {
    const created = await createUser(db, { email: "p@example.com", name: "P", password: "password1" });
    const user = { id: created.ok ? created.user.id : "" };
    await db.insert(practiceTests).values([
      { userId: user.id, modules: [], scores: { readingWriting: 500, math: 500, total: 1000 }, completedAt: daysAgo(10) },
      { userId: user.id, modules: [] },
      { userId: user.id, modules: [], scores: { readingWriting: 600, math: 600, total: 1200 }, completedAt: daysAgo(1) },
    ]);
    const tests = await completedTests(db, user.id);
    expect(tests.map((t) => t.scores?.total)).toEqual([1200, 1000]);
  });
});
