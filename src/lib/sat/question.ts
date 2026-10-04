import { z } from "zod";
import type { Difficulty, QuestionFormat, SectionId } from "./taxonomy";

export const CHOICE_LABELS = ["A", "B", "C", "D"] as const;
export type ChoiceLabel = (typeof CHOICE_LABELS)[number];

/**
 * The content of one question, exactly as the generator returns it.
 * This schema is also sent to the Claude API as the structured output format,
 * so it sticks to features structured outputs support (objects, arrays, enums,
 * nullable fields). Length and count rules are checked in validate.ts instead.
 */
export const QuestionContentSchema = z.object({
  passages: z
    .array(
      z.object({
        label: z
          .string()
          .nullable()
          .describe('Heading such as "Text 1" or "Text 2" for cross-text items; null otherwise.'),
        text: z.string().describe("Passage text. Blanks are written as ______ (six underscores)."),
      }),
    )
    .describe("Reading and Writing passages. Usually one; two for cross-text items; often none for math."),
  table: z
    .object({
      title: z.string().nullable(),
      columns: z.array(z.string()),
      rows: z.array(z.array(z.string())),
    })
    .nullable()
    .describe("A data table when the question needs one, otherwise null."),
  stem: z.string().describe("The question itself. Math uses LaTeX inside $...$ for expressions."),
  choices: z
    .array(z.object({ label: z.enum(CHOICE_LABELS), text: z.string() }))
    .describe("Exactly four choices A-D for multiple choice; empty for student-produced response."),
  correctChoice: z
    .enum(CHOICE_LABELS)
    .nullable()
    .describe("Label of the single correct choice; null for student-produced response."),
  acceptedAnswers: z
    .array(z.string())
    .describe(
      "Student-produced response only: every accepted way to enter the answer (e.g. \"3/4\", \".75\", \"0.75\"). Empty for multiple choice.",
    ),
  explanation: z.string().describe("Step-by-step explanation of why the correct answer is right."),
  distractorRationales: z
    .array(z.object({ label: z.enum(CHOICE_LABELS), text: z.string() }))
    .describe("For each wrong choice, why it is wrong or what mistake leads to it. Empty for student-produced response."),
  publicDomainSource: z
    .string()
    .nullable()
    .describe("Citation (author, title, year) if any text is quoted from a public-domain work; null if fully original."),
});

export type QuestionContent = z.infer<typeof QuestionContentSchema>;

export const GeneratedBatchSchema = z.object({
  questions: z.array(QuestionContentSchema),
});

export type QuestionStatus =
  /** Passed structural checks and the independent answer check. Ready for practice. */
  | "verified"
  /** Something needs a human look: the solver disagreed, flagged an issue, or a warning fired. */
  | "needs-review"
  /** Failed structural checks. Kept for the record, never served. */
  | "rejected";

export interface VerificationResult {
  model: string;
  solverAnswer: string | null;
  matchesKey: boolean;
  issues: string[];
  difficultyEstimate: Difficulty | null;
  checkedAt: string;
}

/** Record of how a question was made, kept so originality can be shown if challenged. */
export interface Provenance {
  /**
   * claude-api: written by the automated generator (npm run generate).
   * authored: written into a question file and loaded with npm run import
   * (by a person, or by Claude in a project session without the API).
   */
  generator: "claude-api" | "authored";
  /** Who or what wrote it, e.g. a model id or a person's name. */
  author?: string;
  requestedModel?: string;
  servedModel?: string;
  promptVersion: string;
  createdAt: string;
  batchId?: string;
  /** For authored questions: the file it was imported from. */
  sourceFile?: string;
  publicDomainSource: string | null;
}

export interface QuestionRecord {
  id: string;
  /** Stable id from a question file (e.g. "transitions-001"); null for generated questions. */
  sourceId: string | null;
  section: SectionId;
  domain: string;
  skill: string;
  difficulty: Difficulty;
  format: QuestionFormat;
  content: QuestionContent;
  status: QuestionStatus;
  validationIssues: string[];
  verification: VerificationResult | null;
  provenance: Provenance;
  createdAt: Date;
}
