import { describe, expect, it } from "vitest";
import { SAMPLE_QUESTION_IDS, sampleQuestions } from "../src/lib/home/samples";
import { isCorrect } from "../src/lib/trainer/answers";

describe("home page sample questions", () => {
  const samples = sampleQuestions();

  it("loads every listed question from the bank files", () => {
    expect(samples.map((s) => s.id)).toEqual([...SAMPLE_QUESTION_IDS]);
  });

  it("covers both sections", () => {
    expect(new Set(samples.map((s) => s.section))).toEqual(new Set(["Reading and Writing", "Math"]));
  });

  it("accepts each question's own key", () => {
    for (const { content } of samples) {
      expect(isCorrect(content, content.correctChoice ?? content.acceptedAnswers[0])).toBe(true);
    }
  });
});
