import { describe, expect, it } from "vitest";
import { getSkill } from "../src/lib/sat/taxonomy";
import { countWords, hasErrors, isValidGridInAnswer, validateQuestion } from "../src/lib/sat/validate";
import { rwQuestion, sprQuestion } from "./fixtures";

const errors = (issues: ReturnType<typeof validateQuestion>) =>
  issues.filter((i) => i.severity === "error").map((i) => i.message);

describe("validateQuestion", () => {
  it("accepts a well-formed Reading and Writing question", () => {
    expect(validateQuestion(rwQuestion(), getSkill("transitions"), "multiple-choice")).toEqual([]);
  });

  it("accepts a well-formed grid-in question", () => {
    expect(validateQuestion(sprQuestion(), getSkill("linear-equations-one-variable"), "student-produced-response")).toEqual([]);
  });

  it("rejects passages outside 25-150 words", () => {
    const short = rwQuestion({ passages: [{ label: null, text: "Too short ______ to count." }] });
    expect(errors(validateQuestion(short, getSkill("transitions"), "multiple-choice"))[0]).toMatch(/minimum is 25/);

    const long = rwQuestion({ passages: [{ label: null, text: `${"word ".repeat(160)}______` }] });
    expect(errors(validateQuestion(long, getSkill("transitions"), "multiple-choice"))[0]).toMatch(/maximum is 150/);
  });

  it("requires a blank for fill-in skills", () => {
    const q = rwQuestion({ passages: [{ label: null, text: "word ".repeat(40) }] });
    expect(errors(validateQuestion(q, getSkill("boundaries"), "multiple-choice"))).toContainEqual(expect.stringMatching(/needs a blank/));
  });

  it("requires four distinct choices A-D", () => {
    const q = rwQuestion({ choices: rwQuestion().choices.slice(0, 3) });
    expect(hasErrors(validateQuestion(q, getSkill("transitions"), "multiple-choice"))).toBe(true);
    const dup = rwQuestion({
      choices: ["A", "B", "C", "D"].map((label) => ({ label: label as "A", text: "Thus," })),
    });
    expect(errors(validateQuestion(dup, getSkill("transitions"), "multiple-choice"))).toContain("Two or more choices have the same text.");
  });

  it("requires two passages for cross-text and a table for quantitative evidence", () => {
    expect(errors(validateQuestion(rwQuestion(), getSkill("cross-text-connections"), "multiple-choice"))).toContain(
      "Cross-text connections need exactly two passages.",
    );
    expect(errors(validateQuestion(rwQuestion(), getSkill("command-of-evidence-quantitative"), "multiple-choice"))).toContain(
      "Quantitative evidence questions need a data table.",
    );
  });

  it("rejects grid-in answers that can't be entered or disagree", () => {
    const bad = sprQuestion({ acceptedAnswers: ["1 3/4"] });
    expect(hasErrors(validateQuestion(bad, getSkill("linear-equations-one-variable"), "student-produced-response"))).toBe(true);
    const mismatch = sprQuestion({ acceptedAnswers: ["7/4", "1.5"] });
    expect(errors(validateQuestion(mismatch, getSkill("linear-equations-one-variable"), "student-produced-response"))[0]).toMatch(/disagree/);
  });

  it("rejects grid-in format for Reading and Writing skills", () => {
    expect(hasErrors(validateQuestion(sprQuestion(), getSkill("transitions"), "student-produced-response"))).toBe(true);
  });

  it("rejects text that mentions College Board", () => {
    const q = rwQuestion({ stem: "Which choice is correct on the College Board test?" });
    expect(errors(validateQuestion(q, getSkill("transitions"), "multiple-choice"))[0]).toMatch(/College Board/);
  });
});

describe("grid-in answers", () => {
  it.each([
    ["3/4", true],
    [".75", true],
    ["0.75", true],
    ["-12/5", true],
    ["12345", true],
    ["123456", false],
    ["-0.6667", false],
    ["-.6667", true],
    ["1 1/2", false],
    ["50%", false],
    ["3/0", false],
  ])("%s -> %s", (answer, ok) => {
    expect(isValidGridInAnswer(answer)).toBe(ok);
  });
});

it("counts a blank as one word", () => {
  expect(countWords("The ______ ran, quickly.")).toBe(4);
});
