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
});

export type QuestionContent = z.infer<typeof QuestionContentSchema>;

export const PublicDomainWorkSchema = z.object({
  title: z.string().min(1),
  author: z.string().min(1),
  year: z.number().int(),
});
export type PublicDomainWork = z.infer<typeof PublicDomainWorkSchema>;

/** What the API generator returns: the question plus the source of any adapted passage. */
export const GeneratedQuestionSchema = QuestionContentSchema.extend({
  publicDomainSource: PublicDomainWorkSchema.nullable().describe(
    "The public-domain work (title, author, publication year) a passage quotes or adapts; null if every passage is original.",
  ),
});
export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;

export const GeneratedBatchSchema = z.object({
  questions: z.array(GeneratedQuestionSchema),
});

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dates are written YYYY-MM-DD");

/**
 * The authorship record every question carries, so its originality can be
 * shown if ever challenged. Required on every question file entry and filled
 * automatically by the API generator.
 */
export const AuthorshipSchema = z.object({
  /** Who wrote the question: the Claude model id (or a person's name) and the date. */
  writer: z.object({ name: z.string().min(1), date: DATE }),
  /** What the writer worked from. */
  inputs: z.object({
    /** The instructions or prompt used, or where to find them. */
    instructions: z.string().min(1),
    /** Example questions the writer was shown. Always our own, never College Board's. Empty if none. */
    examples: z.array(z.string().min(1)),
  }),
  /** "original", or the public-domain work a passage is adapted from. */
  passageSource: z.union([z.literal("original"), PublicDomainWorkSchema]),
  /** Who checked the question and when, and any edits they made ("none" if none). */
  reviews: z
    .array(z.object({ reviewer: z.string().min(1), date: DATE, edits: z.string().min(1) }))
    .min(1, "every question needs at least one review"),
});
export type Authorship = z.infer<typeof AuthorshipSchema>;

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
  /**
   * Writer, inputs, passage source and reviews. Generated questions that were
   * rejected before any check may have no reviews yet.
   */
  authorship: Authorship;
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
