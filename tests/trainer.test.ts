import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkCredentials, createSession, createUser, deleteSession, userForSession } from "../src/lib/auth/accounts";
import { openDb, type Db } from "../src/lib/db/client";
import { insertQuestions, type NewQuestion } from "../src/lib/db/questions";
import type { QuestionContent } from "../src/lib/sat/question";
import { getSkill, type Difficulty } from "../src/lib/sat/taxonomy";
import { splitMath } from "../src/lib/sat/math-text";
import { isCorrect } from "../src/lib/trainer/answers";
import {
  applyAttempt,
  computeMastery,
  emptyMastery,
  estimateScores,
  masteryLevel,
  progressHistory,
  targetDifficulty,
  type AttemptLike,
} from "../src/lib/trainer/mastery";
import { pickQuestion, planPracticeSet, skillPriority, type Candidate } from "../src/lib/trainer/plan";
import { loadAttempts, loadSetQuestions, startPracticeSet, submitAnswer } from "../src/lib/trainer/practice";
import { rwQuestion, sprQuestion } from "./fixtures";

/** Deterministic random numbers for repeatable plans. */
function seeded(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

function attempt(skill: string, correct: boolean, difficulty: Difficulty = "medium", minute = 0, set = "s1"): AttemptLike {
  return { skill, correct, difficulty, createdAt: new Date(2026, 0, 1, 0, minute), practiceSetId: set };
}

describe("answers", () => {
  it("checks multiple choice by label", () => {
    expect(isCorrect(rwQuestion(), "A")).toBe(true);
    expect(isCorrect(rwQuestion(), "b")).toBe(false);
  });

  it("accepts listed forms and the same number written differently, not rounded decimals", () => {
    const q = sprQuestion({ acceptedAnswers: ["7/4", "1.75"] });
    expect(isCorrect(q, " 7 / 4 ")).toBe(true);
    expect(isCorrect(q, "1.750")).toBe(true);
    expect(isCorrect(q, "14/8")).toBe(true);
    expect(isCorrect(q, "1.7")).toBe(false);
    expect(isCorrect(q, "")).toBe(false);
    const third = sprQuestion({ acceptedAnswers: ["2/3", ".6666", ".6667", "0.666", "0.667"] });
    expect(isCorrect(third, ".66")).toBe(false);
    expect(isCorrect(third, "0.6667")).toBe(true);
    expect(isCorrect(sprQuestion({ acceptedAnswers: ["-3"] }), "−3")).toBe(true);
  });
});

describe("mastery", () => {
  it("rises with correct answers, falls with wrong ones, and rewards harder questions more", () => {
    const up = applyAttempt(emptyMastery("transitions"), { difficulty: "medium", correct: true });
    const down = applyAttempt(emptyMastery("transitions"), { difficulty: "medium", correct: false });
    const hardUp = applyAttempt(emptyMastery("transitions"), { difficulty: "hard", correct: true });
    expect(up.rating).toBeGreaterThan(0);
    expect(down.rating).toBeLessThan(0);
    expect(hardUp.rating).toBeGreaterThan(up.rating);
  });

  it("labels levels and picks the difficulty to practice", () => {
    const m = computeMastery([
      ...Array.from({ length: 6 }, (_, i) => attempt("transitions", true, "hard", i)),
      ...Array.from({ length: 6 }, (_, i) => attempt("boundaries", false, "easy", i)),
    ]);
    expect(masteryLevel(m.get("transitions")!)).toBe("strong");
    expect(masteryLevel(m.get("boundaries")!)).toBe("needs-work");
    expect(masteryLevel(m.get("inferences")!)).toBe("not-started");
    expect(targetDifficulty(m.get("transitions")!.rating)).toBe("hard");
    expect(targetDifficulty(m.get("boundaries")!.rating)).toBe("easy");
  });

  it("estimates scores only after enough answers, and they go up with skill", () => {
    expect(estimateScores(computeMastery([])).map((s) => s.score)).toEqual([null, null]);
    const all = (correct: boolean) =>
      computeMastery(Array.from({ length: 30 }, (_, i) => attempt(["linear-functions", "percentages", "circles"][i % 3], correct, "medium", i)));
    const weak = estimateScores(all(false))[1].score!;
    const strong = estimateScores(all(true))[1].score!;
    expect(weak).toBeGreaterThanOrEqual(200);
    expect(strong).toBeLessThanOrEqual(800);
    expect(strong).toBeGreaterThan(weak);
    expect(strong % 10).toBe(0);
  });

  it("records one progress point per practice set", () => {
    const history = progressHistory([
      ...Array.from({ length: 10 }, (_, i) => attempt("transitions", i % 2 === 0, "medium", i, "a")),
      ...Array.from({ length: 10 }, (_, i) => attempt("transitions", true, "medium", 20 + i, "b")),
    ]);
    expect(history.map((p) => [p.practiceSetId, p.answered, p.correct])).toEqual([
      ["a", 10, 5],
      ["b", 10, 10],
    ]);
    expect(history[0].readingWriting).not.toBeNull();
    expect(history[1].readingWriting!).toBeGreaterThan(history[0].readingWriting!);
    expect(history[1].math).toBeNull();
  });
});

describe("planning", () => {
  const c = (id: string, skill: string, difficulty: Difficulty): Candidate => ({ id, skill, difficulty });

  it("prefers unseen questions, then missed ones, at the closest difficulty", () => {
    const pool = [c("e", "transitions", "easy"), c("m", "transitions", "medium"), c("h", "transitions", "hard")];
    expect(pickQuestion(pool, "medium", new Map())!.id).toBe("m");
    expect(pickQuestion(pool, "hard", new Map())!.id).toBe("h");
    const seen = new Map([
      ["m", { correct: true, at: new Date(1) }],
      ["h", { correct: false, at: new Date(2) }],
    ]);
    expect(pickQuestion(pool, "medium", seen)!.id).toBe("e");
    expect(pickQuestion(pool.slice(1), "medium", seen)!.id).toBe("h");
  });

  it("gives weak, heavily tested skills priority over strong ones", () => {
    const m = computeMastery([
      ...Array.from({ length: 8 }, (_, i) => attempt("linear-functions", false, "easy", i)),
      ...Array.from({ length: 8 }, (_, i) => attempt("circles", true, "hard", i)),
    ]);
    expect(skillPriority(m.get("linear-functions")!)).toBeGreaterThan(skillPriority(m.get("circles")!));
  });

  it("builds a set with no repeats, mostly from weak skills", () => {
    const skills = ["linear-functions", "circles", "transitions", "boundaries"];
    const candidates = skills.flatMap((s) => (["easy", "medium", "hard"] as const).flatMap((d) => [1, 2, 3].map((n) => c(`${s}-${d}-${n}`, s, d))));
    const mastery = computeMastery([
      ...Array.from({ length: 10 }, (_, i) => attempt("linear-functions", false, "easy", i)),
      ...Array.from({ length: 10 }, (_, i) => attempt("circles", true, "hard", i)),
      ...Array.from({ length: 10 }, (_, i) => attempt("transitions", true, "hard", i)),
      ...Array.from({ length: 10 }, (_, i) => attempt("boundaries", true, "hard", i)),
    ]);
    const counts = new Map<string, number>();
    for (let seed = 1; seed <= 20; seed++) {
      const set = planPracticeSet({ candidates, mastery, seen: new Map(), size: 10, random: seeded(seed) });
      expect(new Set(set.map((q) => q.id)).size).toBe(10);
      for (const q of set) counts.set(q.skill, (counts.get(q.skill) ?? 0) + 1);
      // Easy questions suit this student; harder ones only once the three easy ones are used.
      const lf = set.filter((q) => q.skill === "linear-functions");
      expect(lf.filter((q) => q.difficulty === "easy")).toHaveLength(Math.min(lf.length, 3));
    }
    expect(counts.get("linear-functions")!).toBeGreaterThan(counts.get("circles")!);
  });

  it("returns a short set when the bank is small", () => {
    expect(planPracticeSet({ candidates: [c("a", "transitions", "easy")], mastery: computeMastery([]), seen: new Map(), size: 10 })).toHaveLength(1);
  });
});

describe("accounts and practice (database)", () => {
  let db: Db;
  let close: () => Promise<void>;
  beforeEach(async () => ({ db, close } = await openDb("memory://")));
  afterEach(async () => close());

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
      provenance: { generator: "authored", promptVersion: "test", createdAt: "2026-01-01", authorship: { writer: { name: "test", date: "2026-01-01" }, inputs: { instructions: "test", examples: [] }, passageSource: "original", reviews: [{ reviewer: "test", date: "2026-01-01", edits: "none" }] } },
    };
  }

  it("signs up, signs in and keeps sessions", async () => {
    const r = await createUser(db, { email: " Sam@Example.com ", name: "Sam", password: "correct horse" });
    expect(r.ok).toBe(true);
    expect(await createUser(db, { email: "sam@example.com", name: "Sam", password: "another one" })).toEqual({ ok: false, error: "email-taken" });
    expect(await createUser(db, { email: "x@y.z", name: "X", password: "short" })).toEqual({ ok: false, error: "short-password" });

    expect(await checkCredentials(db, "sam@example.com", "wrong password")).toBeUndefined();
    const user = await checkCredentials(db, "SAM@example.com", "correct horse");
    expect(user?.name).toBe("Sam");

    const { token } = await createSession(db, user!.id);
    expect((await userForSession(db, token))?.email).toBe("sam@example.com");
    expect(await userForSession(db, token, new Date(Date.now() + 31 * 86400000))).toBeUndefined();
    await deleteSession(db, token);
    expect(await userForSession(db, token)).toBeUndefined();
  });

  it("runs a practice set from start to finish and records attempts", async () => {
    await insertQuestions(db, [
      row("transitions", "medium", rwQuestion()),
      row("linear-equations-one-variable", "easy", sprQuestion()),
      { ...row("boundaries", "easy", rwQuestion({ stem: "Unreviewed" })), status: "needs-review" },
    ]);
    const r = await createUser(db, { email: "a@b.co", name: "A", password: "password1" });
    const userId = r.ok ? r.user.id : "";

    const set = await startPracticeSet(db, userId, { kind: "tailored" }, 10, seeded());
    expect(set!.questionIds).toHaveLength(2);

    const items = await loadSetQuestions(db, set!);
    const mc = items.find((i) => i.question.format === "multiple-choice")!.question;
    const spr = items.find((i) => i.question.format !== "multiple-choice")!.question;

    expect(await submitAnswer(db, userId, set!.id, mc.id, "B")).toEqual({ ok: true, correct: false, completed: false });
    expect(await submitAnswer(db, userId, set!.id, mc.id, "A")).toMatchObject({ ok: true, completed: false });
    expect((await loadAttempts(db, userId)).map((a) => a.correct)).toEqual([false]);
    expect(await submitAnswer(db, userId, set!.id, spr.id, "1.75")).toEqual({ ok: true, correct: true, completed: true });

    const other = await createUser(db, { email: "c@d.co", name: "C", password: "password2" });
    expect(await submitAnswer(db, other.ok ? other.user.id : "", set!.id, spr.id, "1")).toEqual({ ok: false, error: "not-found" });

    expect(await startPracticeSet(db, userId, { kind: "skill", skill: "boundaries" })).toBeUndefined();
  });
});

describe("splitMath", () => {
  it("separates math from text and handles escaped dollars", () => {
    expect(splitMath("If $4x = 7$, find $x$.")).toEqual([
      { kind: "text", value: "If " },
      { kind: "math", value: "4x = 7" },
      { kind: "text", value: ", find " },
      { kind: "math", value: "x" },
      { kind: "text", value: "." },
    ]);
    expect(splitMath("costs $\\$4$ or \\$5")).toEqual([
      { kind: "text", value: "costs " },
      { kind: "math", value: "\\$4" },
      { kind: "text", value: " or $5" },
    ]);
    expect(splitMath("a $b")).toEqual([{ kind: "text", value: "a " }, { kind: "text", value: "$b" }]);
  });
});

describe("committed questions render", () => {
  it("every text field has balanced $...$ math", async () => {
    const { readdir, readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const dir = path.join(process.cwd(), "content", "questions");
    const unbalanced: string[] = [];
    const visit = (v: unknown, where: string) => {
      if (typeof v === "string") {
        if ((v.replace(/\\\$/g, "").match(/\$/g)?.length ?? 0) % 2 !== 0) unbalanced.push(where);
      } else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) visit(x, `${where}.${k}`);
    };
    for (const f of await readdir(dir)) visit(JSON.parse(await readFile(path.join(dir, f), "utf8")), f);
    expect(unbalanced).toEqual([]);
  });
});
