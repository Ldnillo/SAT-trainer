import type { QuestionContent } from "../sat/question";
import { SECTION_NAMES, type Difficulty, type QuestionFormat, type SkillRef } from "../sat/taxonomy";

/** Bump when prompts change, so provenance shows which prompt wrote each question. */
export const PROMPT_VERSION = "2026-10-04.1";

/**
 * Stable system prompt for generation. Kept identical across requests so it can
 * be prompt-cached; everything request-specific goes in the user message.
 */
export const GENERATOR_SYSTEM_PROMPT = `You write original practice questions for students preparing for the digital SAT. Your questions must match the real test's format, tone and difficulty so that practice transfers to test day, while being entirely your own work.

## Originality rules (these protect the business legally, so follow them exactly)
- Write every passage, question and answer choice from scratch. Never reproduce, paraphrase or "reskin" a question you may have seen from the College Board, Khan Academy, Bluebook, a published prep book or an online forum. If an idea feels like a remembered test item, discard it and write something different.
- Reading and Writing passages are either fully original or quote a public-domain work (published before 1929, or a U.S. government publication). When quoting, quote accurately and fill in publicDomainSource. Never excerpt modern copyrighted books, articles or poems.
- Factual passages about real science, history or people must be accurate. When in doubt, describe a plausible hypothetical study or a fictional researcher instead of inventing facts about real ones.
- Never mention the College Board, and never call a question "official".

## Digital SAT style
Reading and Writing:
- One short passage per question, 25 to 150 words (cross-text items have two shorter passages). Passages read like edited academic or literary prose: science, history, social science, the humanities and literature, with a wide range of topics, places and people.
- Four answer choices, exactly one correct. Wrong choices are tempting for a specific reason (a common misreading, a choice that is true but does not answer the question, a grammatically plausible but wrong form), never absurd.
- Question stems are short and direct, for example asking which choice completes the text most logically, which choice best states the main idea, or which finding would most directly support a claim.
- A blank in a passage is written as ______ (six underscores).

Math:
- Concise stems with realistic contexts or pure algebra. Write expressions in LaTeX inside $...$ (for example $3x + 7 = 22$ or $\\frac{2}{3}$).
- No images are shown, so describe any figure, graph or scatterplot completely in words, or give a table or equation instead.
- Multiple choice has four choices, exactly one correct, with distractors that come from specific mistakes (sign errors, solving for the wrong quantity, misapplying a formula).
- Student-produced response questions have no choices. The answer must be enterable in the grid: up to 5 characters if positive and 6 if negative, as an integer, a decimal or a fraction (no mixed numbers, %, $ or units). List every acceptable equivalent form in acceptedAnswers (for example "3/4", ".75", "0.75"). For repeating decimals, give the fraction and the decimal rounded or truncated to fill the grid (for example "2/3", ".6666", ".6667", "0.666", "0.667").

## Difficulty
- easy: one step of reasoning, accessible text or arithmetic, distractors that a careful student rejects quickly.
- medium: two steps, or a moderately complex text; at least one distractor that is genuinely tempting.
- hard: several steps or dense, abstract text with subtle distinctions; distractors that catch students who rush. Still exactly one defensible answer.

## Quality bar
- Before finalizing each question, solve it yourself from scratch and confirm the key is correct and that no other choice could be defended.
- The explanation teaches: show the steps or the textual evidence a student would use, in plain language.
- For multiple choice, write a rationale for each of the three wrong choices explaining the mistake that leads to it. Do not write a rationale for the correct choice.
- Within a batch, vary topics, contexts, numbers and which letter is correct.

## Example (original, for format only; do not reuse its content)
Skill: Transitions, medium, multiple choice
${JSON.stringify(
  {
    passages: [
      {
        label: null,
        text: "Many desert plants store water in thick, waxy leaves that slow evaporation. The ocotillo, a shrub of the Sonoran Desert, takes a different approach. It grows leaves within days of a heavy rain and drops them as soon as the soil dries. ______ the plant spends most of the year as a bundle of bare, spiny stems, conserving water by having almost no leaf surface at all.",
      },
    ],
    table: null,
    stem: "Which choice completes the text with the most logical transition?",
    choices: [
      { label: "A", text: "As a result," },
      { label: "B", text: "Nevertheless," },
      { label: "C", text: "Similarly," },
      { label: "D", text: "For example," },
    ],
    correctChoice: "A",
    acceptedAnswers: [],
    explanation:
      "The sentence before the blank says the ocotillo drops its leaves whenever the soil dries. The sentence after the blank describes the consequence: the plant is leafless most of the year. A cause-and-effect transition fits, so \"As a result,\" is correct.",
    distractorRationales: [
      { label: "B", text: "\"Nevertheless\" signals a contrast, but being leafless follows from dropping leaves; it does not contradict it." },
      { label: "C", text: "\"Similarly\" introduces a comparable example, but the sentence describes a consequence of the previous one." },
      { label: "D", text: "\"For example\" introduces an illustration of a general claim, but the sentence states an outcome, not an instance." },
    ],
    publicDomainSource: null,
  } satisfies QuestionContent,
  null,
  2,
)}`;

/**
 * Subject areas rotated through Reading and Writing requests so a batch for one
 * skill doesn't keep landing on the same topics.
 */
const RW_TOPIC_AREAS = [
  "life science or ecology",
  "physical science, chemistry or astronomy",
  "earth science or climate",
  "world history or archaeology",
  "U.S. history or civics",
  "economics or psychology",
  "linguistics or anthropology",
  "visual arts, music or architecture",
  "literature (an original literary passage or a public-domain excerpt)",
  "technology or engineering",
];

export function pickTopicAreas(count: number, random: () => number = Math.random): string[] {
  const pool = [...RW_TOPIC_AREAS];
  const picked: string[] = [];
  while (picked.length < count) {
    if (pool.length === 0) pool.push(...RW_TOPIC_AREAS);
    picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  return picked;
}

export interface GenerationRequest {
  ref: SkillRef;
  difficulty: Difficulty;
  format: QuestionFormat;
  count: number;
  /** Short summaries of questions already in the bank for this skill, to steer away from repeats. */
  avoid: string[];
  topicAreas?: string[];
}

export function buildGenerationPrompt(req: GenerationRequest): string {
  const { ref, difficulty, format, count } = req;
  const lines = [
    `Write ${count} new question${count === 1 ? "" : "s"} with these specifications:`,
    "",
    `Section: ${SECTION_NAMES[ref.section]}`,
    `Domain: ${ref.domain.name}`,
    `Skill: ${ref.skill.name}`,
    `What the skill tests: ${ref.skill.description}`,
    `How to write it: ${ref.skill.guidance}`,
    `Difficulty: ${difficulty}`,
    `Format: ${format === "multiple-choice" ? "multiple choice (four choices, A-D)" : "student-produced response (no choices; fill acceptedAnswers)"}`,
  ];
  if (req.topicAreas?.length) {
    lines.push("", "Use one of these subject areas per question, in order:", ...req.topicAreas.map((t, i) => `${i + 1}. ${t}`));
  }
  if (req.avoid.length) {
    lines.push(
      "",
      "The bank already has questions that begin like the ones below. Use different topics, contexts and numbers:",
      ...req.avoid.map((a) => `- ${a}`),
    );
  }
  lines.push("", `Return exactly ${count} question${count === 1 ? "" : "s"} in the questions array.`);
  return lines.join("\n");
}

/** One-line summary of a question, used in the "avoid" list. */
export function summarize(q: QuestionContent, max = 100): string {
  const text = (q.passages[0]?.text ?? q.stem).replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export const SOLVER_SYSTEM_PROMPT = `You are an expert SAT tutor reviewing a practice question before students see it. You are given the question without its answer key.

1. Solve it independently and carefully, as a top student would.
2. Report the answer you reach: a letter A-D for multiple choice, or the numeric answer for a student-produced response (as an integer, decimal or fraction).
3. List any problems a student or teacher would object to: more than one defensible answer, no correct answer, ambiguous wording, factual errors in the passage, math that does not work out, a passage that is not suitable for the stated skill, or anything that looks copied from a real SAT question. Leave the list empty if the question is sound. Do not list stylistic preferences.
4. Estimate the difficulty (easy, medium or hard) relative to the digital SAT.`;

export function buildSolverPrompt(q: QuestionContent, ref: SkillRef): string {
  const parts: string[] = [`Skill: ${ref.skill.name} (${SECTION_NAMES[ref.section]})`, ""];
  for (const p of q.passages) {
    if (p.label) parts.push(p.label);
    parts.push(p.text, "");
  }
  if (q.table) {
    if (q.table.title) parts.push(q.table.title);
    parts.push(`| ${q.table.columns.join(" | ")} |`, `|${q.table.columns.map(() => " --- ").join("|")}|`);
    for (const row of q.table.rows) parts.push(`| ${row.join(" | ")} |`);
    parts.push("");
  }
  parts.push(q.stem, "");
  if (q.choices.length) {
    for (const c of q.choices) parts.push(`${c.label}) ${c.text}`);
  } else {
    parts.push("(Student-produced response: enter a number.)");
  }
  return parts.join("\n");
}
