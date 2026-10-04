import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../src/lib/db/client";
import { findQuestions } from "../src/lib/db/questions";
import type { QuestionModel, SolverResult } from "../src/lib/generator/claude";
import { answerMatches, generateQuestions } from "../src/lib/generator/generate";
import type { GenerationRequest } from "../src/lib/generator/prompts";
import type { QuestionContent } from "../src/lib/sat/question";
import { rwQuestion, sprQuestion } from "./fixtures";

class FakeModel implements QuestionModel {
  readonly model = "fake-model";
  requests: GenerationRequest[] = [];
  constructor(
    private questions: QuestionContent[],
    private solve_: (q: QuestionContent) => SolverResult,
  ) {}
  async generate(req: GenerationRequest) {
    this.requests.push(req);
    return { questions: this.questions, servedModel: "fake-model" };
  }
  async solve(q: QuestionContent) {
    return { ...this.solve_(q), servedModel: "fake-model" };
  }
}

const agree = (q: QuestionContent): SolverResult => ({
  answer: q.correctChoice ?? q.acceptedAnswers[0],
  issues: [],
  difficultyEstimate: "medium",
});

let db: Db;
let close: () => Promise<void>;
beforeEach(async () => {
  ({ db, close } = await openDb("memory://"));
});
afterEach(async () => close());

describe("generateQuestions", () => {
  it("saves questions the solver agrees with as verified, with provenance", async () => {
    const model = new FakeModel([rwQuestion()], agree);
    const { saved } = await generateQuestions(db, model, { skillId: "transitions", difficulty: "medium", count: 1 });

    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      section: "reading-writing",
      domain: "expression-of-ideas",
      skill: "transitions",
      difficulty: "medium",
      format: "multiple-choice",
      status: "verified",
      provenance: { generator: "claude-api", requestedModel: "fake-model", publicDomainSource: null },
    });
    expect(model.requests[0].topicAreas).toHaveLength(1);
  });

  it("flags questions the solver answers differently for review", async () => {
    const model = new FakeModel([rwQuestion()], () => ({ answer: "B", issues: [], difficultyEstimate: "medium" }));
    const { saved } = await generateQuestions(db, model, { skillId: "transitions", difficulty: "medium", count: 1 });
    expect(saved[0].status).toBe("needs-review");
    expect(saved[0].verification).toMatchObject({ solverAnswer: "B", matchesKey: false });
  });

  it("flags a large difficulty mismatch for review", async () => {
    const model = new FakeModel([rwQuestion()], (q) => ({ ...agree(q), difficultyEstimate: "easy" }));
    const { saved } = await generateQuestions(db, model, { skillId: "transitions", difficulty: "hard", count: 1 });
    expect(saved[0].status).toBe("needs-review");
  });

  it("rejects malformed questions without calling the solver", async () => {
    let solved = 0;
    const bad = rwQuestion({ choices: rwQuestion().choices.slice(0, 2) });
    const model = new FakeModel([bad], (q) => (solved++, agree(q)));
    const { saved } = await generateQuestions(db, model, { skillId: "transitions", difficulty: "easy", count: 1 });
    expect(saved[0].status).toBe("rejected");
    expect(solved).toBe(0);
  });

  it("rejects near-duplicates of questions already in the bank and avoids their topics", async () => {
    await generateQuestions(db, new FakeModel([rwQuestion()], agree), { skillId: "transitions", difficulty: "medium", count: 1 });
    const model = new FakeModel([rwQuestion()], agree);
    const { saved } = await generateQuestions(db, model, { skillId: "transitions", difficulty: "medium", count: 1 });
    expect(saved[0].status).toBe("rejected");
    expect(saved[0].validationIssues.join()).toMatch(/Near-duplicate/);
    expect(model.requests[0].avoid[0]).toMatch(/^Honeybees communicate/);
  });

  it("handles grid-in math questions", async () => {
    const model = new FakeModel([sprQuestion()], () => ({ answer: "1.75", issues: [], difficultyEstimate: "easy" }));
    const { saved } = await generateQuestions(db, model, {
      skillId: "linear-equations-one-variable",
      difficulty: "easy",
      count: 1,
      format: "student-produced-response",
    });
    expect(saved[0]).toMatchObject({ section: "math", format: "student-produced-response", status: "verified" });
  });

  it("lets the trainer query verified questions by skill and difficulty", async () => {
    await generateQuestions(db, new FakeModel([rwQuestion()], agree), { skillId: "transitions", difficulty: "hard", count: 1 });
    await generateQuestions(db, new FakeModel([sprQuestion()], agree), {
      skillId: "linear-equations-one-variable",
      difficulty: "easy",
      count: 1,
      format: "student-produced-response",
    });

    expect(await findQuestions(db, { skills: ["transitions"], difficulties: ["hard"] })).toHaveLength(1);
    expect(await findQuestions(db, { skills: ["transitions"], difficulties: ["easy"] })).toHaveLength(0);
    const math = await findQuestions(db, { section: "math" });
    expect(math).toHaveLength(1);
    expect(await findQuestions(db, { excludeIds: [math[0].id], section: "math" })).toHaveLength(0);
  });

  it("refuses formats a skill doesn't use", async () => {
    await expect(
      generateQuestions(db, new FakeModel([], agree), { skillId: "transitions", difficulty: "easy", count: 1, format: "student-produced-response" }),
    ).rejects.toThrow(/can't be student-produced-response/);
  });
});

describe("answerMatches", () => {
  it("normalizes letter answers", () => {
    expect(answerMatches(rwQuestion(), "(a)")).toBe(true);
    expect(answerMatches(rwQuestion(), "B")).toBe(false);
  });
  it("compares grid-in answers by value", () => {
    expect(answerMatches(sprQuestion(), "1.750")).toBe(true);
    expect(answerMatches(sprQuestion(), "7/4")).toBe(true);
    expect(answerMatches(sprQuestion(), "2")).toBe(false);
  });
});
