import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { importQuestionFiles, orphanedSourceIds } from "../src/lib/content/import";
import { openDb, type Db } from "../src/lib/db/client";
import { findQuestions } from "../src/lib/db/questions";
import type { QuestionContent } from "../src/lib/sat/question";
import { rwQuestion } from "./fixtures";

let db: Db;
let close: () => Promise<void>;
let dir: string;

beforeEach(async () => {
  ({ db, close } = await openDb("memory://"));
  dir = await mkdtemp(path.join(tmpdir(), "questions-"));
});
afterEach(async () => close());

const authorship = {
  writer: { name: "test-writer", date: "2026-10-04" },
  inputs: { instructions: "content/AUTHORING.md", examples: [] },
  passageSource: "original",
  reviews: [{ reviewer: "test-reviewer", date: "2026-10-04", edits: "none" }],
};

async function writeFileFor(
  skill: string,
  questions: { id: string; content: QuestionContent; difficulty?: string; authorship?: unknown }[],
) {
  await writeFile(
    path.join(dir, `${skill}.json`),
    JSON.stringify({
      skill,
      questions: questions.map((q) => ({ difficulty: "medium", format: "multiple-choice", authorship, ...q })),
    }),
  );
}

describe("importQuestionFiles", () => {
  it("adds valid questions as verified and is idempotent", async () => {
    await writeFileFor("transitions", [{ id: "transitions-001", content: rwQuestion() }]);

    const first = await importQuestionFiles(db, dir);
    expect(first.added).toEqual(["transitions-001"]);
    const [row] = await findQuestions(db, { skills: ["transitions"] });
    expect(row).toMatchObject({ sourceId: "transitions-001", status: "verified", provenance: { generator: "authored", author: "test-writer", authorship } });

    const second = await importQuestionFiles(db, dir);
    expect(second).toMatchObject({ added: [], unchanged: ["transitions-001"] });
  });

  it("updates a question when only its review record changes", async () => {
    await writeFileFor("transitions", [{ id: "transitions-001", content: rwQuestion() }]);
    await importQuestionFiles(db, dir);
    const reviewed = { ...authorship, reviews: [...authorship.reviews, { reviewer: "Justine", date: "2026-10-05", edits: "none" }] };
    await writeFileFor("transitions", [{ id: "transitions-001", content: rwQuestion(), authorship: reviewed }]);
    expect((await importQuestionFiles(db, dir)).updated).toEqual(["transitions-001"]);
    const [row] = await findQuestions(db, { skills: ["transitions"] });
    expect(row.provenance.authorship.reviews).toHaveLength(2);
  });

  it("updates a question in place when its file changes", async () => {
    await writeFileFor("transitions", [{ id: "transitions-001", content: rwQuestion() }]);
    await importQuestionFiles(db, dir);
    await writeFileFor("transitions", [{ id: "transitions-001", content: rwQuestion({ correctChoice: "A" }), difficulty: "hard" }]);

    const r = await importQuestionFiles(db, dir);
    expect(r.updated).toEqual(["transitions-001"]);
    const rows = await findQuestions(db, { skills: ["transitions"] });
    expect(rows).toHaveLength(1);
    expect(rows[0].difficulty).toBe("hard");
  });

  it("skips invalid questions and near-duplicates with reasons", async () => {
    await writeFileFor("transitions", [
      { id: "transitions-001", content: rwQuestion() },
      { id: "transitions-002", content: rwQuestion() },
      { id: "transitions-003", content: rwQuestion({ choices: [] }) },
    ]);
    const r = await importQuestionFiles(db, dir);
    expect(r.added).toEqual(["transitions-001"]);
    expect(r.failed.map((f) => f.id)).toEqual(["transitions-002", "transitions-003"]);
    expect(r.failed[0].problems.join()).toMatch(/Near-duplicate of transitions-001/);
  });

  it("rejects questions without a complete authorship record", async () => {
    const noReviews: Partial<typeof authorship> = { ...authorship };
    delete noReviews.reviews;
    await writeFileFor("transitions", [
      { id: "transitions-001", content: rwQuestion(), authorship: undefined },
      { id: "transitions-002", content: rwQuestion({ stem: "Which transition fits best?" }), authorship: { ...authorship, reviews: [] } },
      { id: "transitions-003", content: rwQuestion({ stem: "Pick the transition." }), authorship: noReviews },
    ]);
    const r = await importQuestionFiles(db, dir);
    expect(r.added).toEqual([]);
    expect(r.failed.map((f) => f.id)).toEqual(["transitions-001", "transitions-002", "transitions-003"]);
    expect(r.failed[0].problems.join()).toMatch(/authorship/);
    expect(r.failed[1].problems.join()).toMatch(/at least one review/);
  });

  it("enforces the originality rules in the authorship record", async () => {
    await writeFileFor("transitions", [
      {
        id: "transitions-001",
        content: rwQuestion(),
        authorship: { ...authorship, passageSource: { title: "A Recent Novel", author: "Someone", year: 1990 } },
      },
      {
        id: "transitions-002",
        content: rwQuestion({ stem: "Which transition fits best?" }),
        authorship: { ...authorship, inputs: { instructions: "x", examples: ["Bluebook practice test 4, question 12"] } },
      },
      {
        id: "transitions-003",
        content: rwQuestion({ stem: "Pick the transition." }),
        authorship: { ...authorship, passageSource: { title: "Walden", author: "Henry David Thoreau", year: 1854 } },
      },
    ]);
    const r = await importQuestionFiles(db, dir);
    expect(r.failed.map((f) => f.id)).toEqual(["transitions-001", "transitions-002"]);
    expect(r.failed[0].problems.join()).toMatch(/may still be under copyright/);
    expect(r.failed[1].problems.join()).toMatch(/official test material/);
    expect(r.added).toEqual(["transitions-003"]);
  });

  it("rejects files whose name and skill disagree, and reports orphans", async () => {
    await writeFileFor("transitions", [{ id: "transitions-001", content: rwQuestion() }]);
    await importQuestionFiles(db, dir);
    await writeFileFor("transitions", []);
    expect(await orphanedSourceIds(db, dir)).toEqual(["transitions-001"]);

    await writeFile(path.join(dir, "boundaries.json"), JSON.stringify({ skill: "transitions", questions: [] }));
    await expect(importQuestionFiles(db, dir)).rejects.toThrow(/file name says boundaries.json/);
  });
});

describe("content/questions", () => {
  it("every committed question passes validation", async () => {
    const r = await importQuestionFiles(db, path.join(process.cwd(), "content", "questions"));
    expect(r.failed).toEqual([]);
    expect(r.flagged).toEqual([]);
    expect(r.added.length).toBeGreaterThanOrEqual(30);
  });
});
