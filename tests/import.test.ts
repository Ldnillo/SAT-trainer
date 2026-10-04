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

async function writeFileFor(skill: string, questions: { id: string; content: QuestionContent; difficulty?: string }[]) {
  await writeFile(
    path.join(dir, `${skill}.json`),
    JSON.stringify({
      skill,
      author: "test",
      questions: questions.map((q) => ({ difficulty: "medium", format: "multiple-choice", ...q })),
    }),
  );
}

describe("importQuestionFiles", () => {
  it("adds valid questions as verified and is idempotent", async () => {
    await writeFileFor("transitions", [{ id: "transitions-001", content: rwQuestion() }]);

    const first = await importQuestionFiles(db, dir);
    expect(first.added).toEqual(["transitions-001"]);
    const [row] = await findQuestions(db, { skills: ["transitions"] });
    expect(row).toMatchObject({ sourceId: "transitions-001", status: "verified", provenance: { generator: "authored", author: "test" } });

    const second = await importQuestionFiles(db, dir);
    expect(second).toMatchObject({ added: [], unchanged: ["transitions-001"] });
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

  it("rejects files whose name and skill disagree, and reports orphans", async () => {
    await writeFileFor("transitions", [{ id: "transitions-001", content: rwQuestion() }]);
    await importQuestionFiles(db, dir);
    await writeFileFor("transitions", []);
    expect(await orphanedSourceIds(db, dir)).toEqual(["transitions-001"]);

    await writeFile(path.join(dir, "boundaries.json"), JSON.stringify({ skill: "transitions", author: "x", questions: [] }));
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
