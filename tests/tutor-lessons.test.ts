import { describe, expect, it } from "vitest";
import { splitMath } from "../src/lib/sat/math-text";
import { getSkill } from "../src/lib/sat/taxonomy";
import { getLesson, LESSONS, lessonForSkill } from "../src/lib/tutor/lessons";

describe("tutor lessons", () => {
  it("has unique slugs and real bank skills", () => {
    expect(new Set(LESSONS.map((l) => l.slug)).size).toBe(LESSONS.length);
    for (const lesson of LESSONS) for (const skill of lesson.skills) expect(() => getSkill(skill)).not.toThrow();
  });

  it("looks lessons up by slug and by skill", () => {
    expect(getLesson("systems-of-equations")?.skills).toContain("systems-of-linear-equations");
    expect(lessonForSkill("systems-of-linear-equations")?.slug).toBe("systems-of-equations");
    expect(lessonForSkill("transitions")).toBeUndefined();
  });

  it("gives every lesson a trap, rule, steps and an authorship review", () => {
    for (const lesson of LESSONS) {
      expect(lesson.trap.length).toBeGreaterThan(0);
      expect(lesson.rule.length).toBeGreaterThan(0);
      expect(lesson.authorship.reviews.length).toBeGreaterThan(0);
      for (const example of lesson.examples) expect(example.steps.length).toBeGreaterThan(2);
    }
  });

  it("keeps math delimiters balanced in every text", () => {
    for (const lesson of LESSONS) {
      const texts = [lesson.trap, lesson.rule, ...lesson.clues, ...lesson.examples.flatMap((e) => [e.problem, ...e.steps.map((s) => s.text)])];
      for (const text of texts) expect((text.match(/\$/g) ?? []).length % 2, text).toBe(0);
      for (const text of texts) expect(splitMath(text).length).toBeGreaterThan(0);
    }
  });
});
