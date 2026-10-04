import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createUser, exportUserData } from "../src/lib/auth/accounts";
import { openDb, type Db } from "../src/lib/db/client";
import { allSkills } from "../src/lib/sat/taxonomy";
import { applyAttempt, computeMastery, emptyMastery, masteryLevel } from "../src/lib/trainer/mastery";
import { planPracticeSet, type Candidate } from "../src/lib/trainer/plan";
import {
  addScoreReport,
  deleteScoreReport,
  listScoreReports,
  loadPriors,
  parseScoreReportForm,
  priorsFromReport,
  ratingForBand,
  ratingForSectionScore,
  type ScoreReportInput,
} from "../src/lib/trainer/score-report";

const TODAY = new Date("2026-10-04T12:00:00Z");

function form(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

function seeded(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

const EMPTY = { readingWriting: null, math: null, domainBands: {}, skillResults: {} };

describe("score entry form", () => {
  it("reads section scores, domain boxes and skill results", () => {
    const r = parseScoreReportForm(
      form({
        kind: "bluebook-practice",
        testDate: "2026-09-12",
        "score-reading-writing": "610",
        "score-math": "",
        "band-algebra": "3",
        "band-craft-and-structure": "",
        "correct-transitions": "1",
        "total-transitions": "4",
        "correct-boundaries": "",
        "total-boundaries": "",
      }),
      TODAY,
    );
    expect(r).toEqual({
      ok: true,
      report: {
        kind: "bluebook-practice",
        testDate: "2026-09-12",
        readingWriting: 610,
        math: null,
        domainBands: { algebra: 3 },
        skillResults: { transitions: { correct: 1, total: 4 } },
      },
    });
  });

  it("explains every mistake in plain words", () => {
    const r = parseScoreReportForm(
      form({
        kind: "other",
        testDate: "2026-12-01",
        "score-math": "805",
        "score-reading-writing": "615",
        "band-algebra": "8",
        "correct-transitions": "5",
        "total-transitions": "4",
        "correct-boundaries": "2",
      }),
      TODAY,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toHaveLength(7);
    expect(r.errors.join(" ")).toMatch(/future/);
    expect(r.errors.join(" ")).toMatch(/Boundaries: enter how many questions/);
  });

  it("needs at least one score and a real digital SAT date", () => {
    const none = parseScoreReportForm(form({ kind: "official", testDate: "2026-08-23" }), TODAY);
    expect(none.ok).toBe(false);
    const old = parseScoreReportForm(form({ kind: "official", testDate: "2019-05-04", "score-math": "600" }), TODAY);
    expect(old.ok ? [] : old.errors).toEqual(["Only digital SAT results (2023 or later) can be used."]);
    const bad = parseScoreReportForm(form({ kind: "official", testDate: "2026-02-30", "score-math": "600" }), TODAY);
    expect(bad.ok).toBe(false);
  });
});

describe("turning a report into starting ratings", () => {
  it("maps scores and boxes onto the rating scale in order", () => {
    expect(Math.abs(ratingForSectionScore(500))).toBeLessThan(0.01);
    expect(ratingForSectionScore(700)).toBeGreaterThan(ratingForSectionScore(500));
    expect(ratingForSectionScore(300)).toBeLessThan(0);
    for (let b = 1; b < 7; b++) expect(ratingForBand(b + 1)).toBeGreaterThan(ratingForBand(b));
  });

  it("uses a domain's boxes, falls back to the section score, and lets skill results count most", () => {
    const priors = priorsFromReport({
      ...EMPTY,
      readingWriting: 700,
      domainBands: { algebra: 2, "advanced-math": 6 },
      skillResults: { "linear-functions": { correct: 4, total: 4 } },
    });
    const algebra = priors.get("linear-equations-one-variable")!;
    const advanced = priors.get("equivalent-expressions")!;
    expect(algebra.rating).toBeLessThan(0);
    expect(advanced.rating).toBeGreaterThan(0);
    // Same weak domain, but this skill's own results were perfect.
    expect(priors.get("linear-functions")!.rating).toBeGreaterThan(algebra.rating);
    // Reading and Writing has no boxes, so every skill there takes the 700 section score, lightly.
    expect(priors.get("transitions")!.rating).toBeCloseTo(ratingForSectionScore(700), 2);
    expect(priors.get("transitions")!.weight).toBeLessThan(algebra.weight);
    // Math domains with no boxes and no Math score get nothing.
    expect(priors.has("circles")).toBe(false);
    for (const p of priors.values()) expect(p.weight).toBeLessThanOrEqual(5);
  });

  it("starts mastery from the report and lets practice take over", () => {
    const priors = priorsFromReport({ ...EMPTY, domainBands: { algebra: 1 } });
    const mastery = computeMastery([], priors);
    const m = mastery.get("linear-inequalities")!;
    expect(m.attempts).toBe(0);
    expect(m.rating).toBeLessThan(-1);
    expect(masteryLevel(m)).toBe("needs-work");
    expect(masteryLevel(mastery.get("circles")!)).toBe("not-started");

    // With a prior, one answer moves the rating less than it would on a blank skill.
    const fresh = applyAttempt(emptyMastery("x"), { difficulty: "easy", correct: true });
    const seeded = applyAttempt({ ...emptyMastery("x"), priorWeight: 2 }, { difficulty: "easy", correct: true });
    expect(seeded.rating).toBeLessThan(fresh.rating);
    expect(seeded.priorWeight).toBe(2);
  });

  it("aims tailored practice at the domains the report marks weak", () => {
    const candidates: Candidate[] = allSkills().flatMap((s) =>
      (["easy", "medium", "hard"] as const).map((difficulty) => ({ id: `${s.skill.id}-${difficulty}`, skill: s.skill.id, difficulty })),
    );
    const priors = priorsFromReport({
      readingWriting: 650,
      math: 650,
      domainBands: {
        algebra: 1,
        "advanced-math": 7,
        "problem-solving-and-data-analysis": 7,
        "geometry-and-trigonometry": 7,
        "craft-and-structure": 7,
        "information-and-ideas": 7,
        "standard-english-conventions": 7,
        "expression-of-ideas": 7,
      },
      skillResults: {},
    });
    const random = seeded(7);
    let algebra = 0;
    let total = 0;
    const algebraSkills = new Set(allSkills().filter((s) => s.domain.id === "algebra").map((s) => s.skill.id));
    for (let i = 0; i < 40; i++) {
      const set = planPracticeSet({ candidates, mastery: computeMastery([], priors), seen: new Map(), size: 10, random });
      total += set.length;
      algebra += set.filter((q) => algebraSkills.has(q.skill)).length;
      // A weak skill's first question in a set is an easy one.
      const firsts = new Map<string, Candidate>();
      for (const q of set) if (!firsts.has(q.skill)) firsts.set(q.skill, q);
      for (const q of firsts.values()) if (algebraSkills.has(q.skill)) expect(q.difficulty).toBe("easy");
    }
    // Algebra is 5 of 30 skills; with its weak boxes it should fill far more than a sixth of the sets.
    expect(algebra / total).toBeGreaterThan(0.4);
  });
});

describe("score reports (database)", () => {
  let db: Db;
  let close: () => Promise<void>;
  beforeEach(async () => ({ db, close } = await openDb("memory://")));
  afterEach(async () => close());

  const report = (testDate: string, math: number): ScoreReportInput => ({
    kind: "official",
    testDate,
    readingWriting: 600,
    math,
    domainBands: { algebra: 2 },
    skillResults: {},
  });

  it("saves reports, uses the latest test, and keeps them private to each student", async () => {
    const a = await createUser(db, { email: "a@b.co", name: "A", password: "password1" });
    const b = await createUser(db, { email: "c@d.co", name: "C", password: "password2" });
    const userA = a.ok ? a.user.id : "";
    const userB = b.ok ? b.user.id : "";

    expect((await loadPriors(db, userA)).size).toBe(0);
    const older = await addScoreReport(db, userA, report("2026-03-14", 500));
    await addScoreReport(db, userA, report("2026-08-23", 720));

    expect((await listScoreReports(db, userA)).map((r) => r.testDate)).toEqual(["2026-08-23", "2026-03-14"]);
    const priors = await loadPriors(db, userA);
    // Geometry has no boxes, so it takes the latest Math score (720), not the older 500.
    expect(priors.get("circles")!.rating).toBeCloseTo(ratingForSectionScore(720), 2);

    await deleteScoreReport(db, userB, older.id);
    expect(await listScoreReports(db, userA)).toHaveLength(2);
    expect(await listScoreReports(db, userB)).toHaveLength(0);
    await deleteScoreReport(db, userA, older.id);
    expect(await listScoreReports(db, userA)).toHaveLength(1);

    expect((await exportUserData(db, userA))!.scoreReports).toHaveLength(1);
  });
});
