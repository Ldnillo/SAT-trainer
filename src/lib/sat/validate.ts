import { CHOICE_LABELS, type QuestionContent } from "./question";
import type { QuestionFormat, SkillRef } from "./taxonomy";

export interface ValidationIssue {
  severity: "error" | "warning";
  message: string;
}

export const BLANK = "______";

/** Reading and Writing passages on the digital SAT run 25 to 150 words. */
export const MIN_PASSAGE_WORDS = 25;
export const MAX_PASSAGE_WORDS = 150;

/** Skills whose passages must contain a blank for the answer to fill. */
const SKILLS_REQUIRING_BLANK = new Set([
  "boundaries",
  "form-structure-and-sense",
  "transitions",
  "inferences",
]);

/** Words that must never appear: we are not official and must not imply it. */
const FORBIDDEN_PHRASES = [/college\s*board/i, /\bofficial\s+sat\b/i];

export function countWords(text: string): number {
  return text
    .replace(/_{3,}/g, " blank ")
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/**
 * Student-produced response rules: up to 5 characters for a positive answer and
 * 6 for a negative one (the minus sign counts), written as an integer, decimal
 * or fraction. No mixed numbers, no symbols such as % or $.
 */
export function isValidGridInAnswer(answer: string): boolean {
  if (!/^-?(\d+|\d*\.\d+|\d+\/\d+)$/.test(answer)) return false;
  const max = answer.startsWith("-") ? 6 : 5;
  if (answer.length > max) return false;
  if (answer.includes("/") && Number(answer.split("/")[1]) === 0) return false;
  return true;
}

export function gridInValue(answer: string): number {
  if (answer.includes("/")) {
    const negative = answer.startsWith("-");
    const [n, d] = answer.replace("-", "").split("/").map(Number);
    return (negative ? -1 : 1) * (n / d);
  }
  return Number(answer);
}

export function validateQuestion(
  q: QuestionContent,
  ref: SkillRef,
  format: QuestionFormat,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const error = (message: string) => issues.push({ severity: "error", message });
  const warn = (message: string) => issues.push({ severity: "warning", message });

  if (!q.stem.trim()) error("Question stem is empty.");
  if (!q.explanation.trim()) error("Explanation is empty.");

  const allText = [q.stem, q.explanation, ...q.passages.map((p) => p.text), ...q.choices.map((c) => c.text)].join("\n");
  for (const pattern of FORBIDDEN_PHRASES) {
    if (pattern.test(allText)) error(`Text mentions "${allText.match(pattern)?.[0]}"; questions must not reference College Board or claim to be official.`);
  }

  if (!ref.skill.formats.includes(format)) {
    error(`Skill ${ref.skill.id} does not use the ${format} format.`);
  }

  // ---- answer format
  if (format === "multiple-choice") {
    const labels = q.choices.map((c) => c.label).join("");
    if (labels !== CHOICE_LABELS.join("")) {
      error(`Multiple choice needs exactly four choices labeled A-D in order (got "${labels}").`);
    }
    const texts = q.choices.map((c) => c.text.trim().toLowerCase());
    if (texts.some((t) => !t)) error("A choice is empty.");
    if (new Set(texts).size !== texts.length) error("Two or more choices have the same text.");
    if (!q.correctChoice) error("Multiple choice question has no correct choice.");
    if (q.acceptedAnswers.length > 0) warn("Multiple choice question lists grid-in answers; they will be ignored.");

    const wrong = CHOICE_LABELS.filter((l) => l !== q.correctChoice);
    const explained = new Set(q.distractorRationales.map((r) => r.label));
    const missing = wrong.filter((l) => !explained.has(l));
    if (missing.length) warn(`No rationale for wrong choice(s) ${missing.join(", ")}.`);
    if (q.correctChoice && explained.has(q.correctChoice)) {
      warn("A distractor rationale was written for the correct choice.");
    }
  } else {
    if (q.choices.length > 0) error("Student-produced response questions must not have choices.");
    if (q.correctChoice) error("Student-produced response questions must not set correctChoice.");
    if (q.acceptedAnswers.length === 0) error("Student-produced response question has no accepted answers.");
    const bad = q.acceptedAnswers.filter((a) => !isValidGridInAnswer(a));
    if (bad.length) error(`Accepted answer(s) not enterable as a grid-in: ${bad.join(", ")}.`);
    const values = q.acceptedAnswers.filter(isValidGridInAnswer).map(gridInValue);
    if (values.length > 1 && values.some((v) => Math.abs(v - values[0]) > 1e-3)) {
      error(`Accepted answers disagree in value: ${q.acceptedAnswers.join(", ")}.`);
    }
  }

  // ---- section-specific shape
  if (ref.section === "reading-writing") {
    if (q.passages.length === 0) error("Reading and Writing questions need a passage.");

    const words = q.passages.reduce((sum, p) => sum + countWords(p.text), 0);
    if (q.passages.length > 0 && words < MIN_PASSAGE_WORDS) {
      error(`Passage is ${words} words; minimum is ${MIN_PASSAGE_WORDS}.`);
    }
    // Cross-text pairs are two passages, so they get room for both.
    const max = ref.skill.id === "cross-text-connections" ? MAX_PASSAGE_WORDS + 30 : MAX_PASSAGE_WORDS;
    if (words > max) error(`Passage is ${words} words; maximum is ${max}.`);

    if (ref.skill.id === "cross-text-connections" && q.passages.length !== 2) {
      error("Cross-text connections need exactly two passages.");
    }
    if (ref.skill.id !== "cross-text-connections" && q.passages.length > 1) {
      error("Only cross-text connections may have more than one passage.");
    }
    if (ref.skill.id === "command-of-evidence-quantitative" && !q.table) {
      error("Quantitative evidence questions need a data table.");
    }
    if (SKILLS_REQUIRING_BLANK.has(ref.skill.id) && !q.passages.some((p) => p.text.includes(BLANK))) {
      error(`Skill ${ref.skill.id} needs a blank (${BLANK}) in the passage.`);
    }
  }

  if (q.table) {
    const width = q.table.columns.length;
    if (width === 0 || q.table.rows.length === 0) error("Table is empty.");
    if (q.table.rows.some((r) => r.length !== width)) error("Table rows do not match the number of columns.");
  }

  return issues;
}

export function hasErrors(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}
