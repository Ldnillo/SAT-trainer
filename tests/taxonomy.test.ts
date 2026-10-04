import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { describe, expect, it } from "vitest";
import { buildGenerationPrompt, buildSolverPrompt, GENERATOR_SYSTEM_PROMPT } from "../src/lib/generator/prompts";
import { GeneratedBatchSchema } from "../src/lib/sat/question";
import { allSkills, DOMAINS, getSkill } from "../src/lib/sat/taxonomy";
import { rwQuestion } from "./fixtures";

describe("taxonomy", () => {
  it("has unique skill ids and domain weights that sum to 1 per section", () => {
    const ids = allSkills().map((s) => s.skill.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const section of ["reading-writing", "math"]) {
      const total = DOMAINS.filter((d) => d.section === section).reduce((s, d) => s + d.weight, 0);
      expect(total).toBeCloseTo(1);
    }
  });

  it("keeps Reading and Writing multiple choice only", () => {
    for (const ref of allSkills().filter((s) => s.section === "reading-writing")) {
      expect(ref.skill.formats).toEqual(["multiple-choice"]);
    }
  });

  it("throws on unknown skills", () => {
    expect(() => getSkill("nope")).toThrow(/Unknown skill/);
  });
});

describe("prompts", () => {
  it("converts the question schema to a structured output format", () => {
    expect(() => betaZodOutputFormat(GeneratedBatchSchema)).not.toThrow();
  });

  it("puts request details in the user prompt, not the cached system prompt", () => {
    const prompt = buildGenerationPrompt({
      ref: getSkill("inferences"),
      difficulty: "hard",
      format: "multiple-choice",
      count: 2,
      avoid: ["Coral reefs..."],
      topicAreas: ["life science", "economics"],
    });
    expect(prompt).toContain("Skill: Inferences");
    expect(prompt).toContain("Difficulty: hard");
    expect(prompt).toContain("- Coral reefs...");
    expect(GENERATOR_SYSTEM_PROMPT).not.toContain("Inferences");
  });

  it("never shows the answer key to the solver", () => {
    const text = buildSolverPrompt(rwQuestion(), getSkill("transitions"));
    expect(text).toContain("A) Thus,");
    expect(text).not.toContain("consequence transition fits");
  });
});
