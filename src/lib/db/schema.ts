import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { Provenance, QuestionContent, QuestionStatus, VerificationResult } from "../sat/question";
import type { Difficulty, QuestionFormat, SectionId } from "../sat/taxonomy";

/**
 * The question bank. Metadata the trainer filters on (section, domain, skill,
 * difficulty, format, status) are plain indexed columns; the question body
 * lives in `content` as JSON so its shape can evolve without migrations.
 */
export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Stable id for questions imported from content/questions files; null for generated ones. */
    sourceId: text("source_id").unique(),
    section: text("section").$type<SectionId>().notNull(),
    domain: text("domain").notNull(),
    skill: text("skill").notNull(),
    difficulty: text("difficulty").$type<Difficulty>().notNull(),
    format: text("format").$type<QuestionFormat>().notNull(),
    status: text("status").$type<QuestionStatus>().notNull(),
    content: jsonb("content").$type<QuestionContent>().notNull(),
    validationIssues: jsonb("validation_issues").$type<string[]>().notNull().default([]),
    verification: jsonb("verification").$type<VerificationResult | null>(),
    provenance: jsonb("provenance").$type<Provenance>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("questions_skill_difficulty_status_idx").on(t.skill, t.difficulty, t.status),
    index("questions_domain_idx").on(t.domain),
  ],
);

/** Student accounts. Season passes attach to a user (see seasonPasses). */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Stored lowercased. */
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  /** scrypt$<salt>$<hash>, see src/lib/auth/password.ts. */
  passwordHash: text("password_hash").notNull(),
  /** When the student agreed to the terms and privacy policy and confirmed they are 13 or older (null for accounts made before that existed). */
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  /** Questions the student aims to answer each day (src/lib/trainer/streak.ts). */
  dailyGoal: integer("daily_goal").notNull().default(10),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Sign-in sessions. Only a SHA-256 of the cookie token is stored. */
export const authSessions = pgTable(
  "auth_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auth_sessions_user_idx").on(t.userId)],
);

/** Password reset links. Only a SHA-256 of the emailed token is stored; a link works once, for a limited time. */
export const passwordResets = pgTable(
  "password_resets",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("password_resets_user_idx").on(t.userId)],
);

/** Pending email changes: the new address is only used once its owner opens the emailed link. */
export const emailChanges = pgTable(
  "email_changes",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    newEmail: text("new_email").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("email_changes_user_idx").on(t.userId)],
);

/** Recent sign-in, sign-up and reset requests, counted per email or IP address to slow down password guessing and email spam. */
export const rateLimitHits = pgTable(
  "rate_limit_hits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("rate_limit_hits_key_idx").on(t.key, t.createdAt)],
);

/** One practice set: the questions picked for it, in order. */
export const practiceSets = pgTable(
  "practice_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** What the student asked for: tailored, one section, or one skill. */
    focus: jsonb("focus").$type<PracticeFocus>().notNull(),
    questionIds: jsonb("question_ids").$type<string[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("practice_sets_user_idx").on(t.userId, t.createdAt)],
);

export type PracticeFocus =
  | { kind: "tailored" }
  | { kind: "section"; section: SectionId }
  | { kind: "skill"; skill: string }
  /** Questions the student got wrong the last time they answered them. */
  | { kind: "mistakes" }
  /** Questions the student flagged for review. */
  | { kind: "flagged" };

/** Questions a student flagged to come back to later (src/lib/trainer/review.ts). Unflagging deletes the row. */
export const questionFlags = pgTable(
  "question_flags",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.questionId] })],
);

/**
 * Full-length timed practice tests (src/lib/test). A test holds up to four
 * modules: Reading and Writing 1 and 2, then Math 1 and 2. Each second module
 * is assembled when the first is submitted, easier or harder depending on how
 * the student did, as on the digital SAT.
 */
export const practiceTests = pgTable(
  "practice_tests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    modules: jsonb("modules").$type<TestModule[]>().notNull(),
    /** Section scores, set when the last module is submitted. */
    scores: jsonb("scores").$type<TestScores | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("practice_tests_user_idx").on(t.userId, t.createdAt)],
);

export type ModuleTier = "standard" | "easier" | "harder";

export interface TestModule {
  section: SectionId;
  stage: 1 | 2;
  tier: ModuleTier;
  /** In the order the student sees them. */
  questionIds: string[];
  /** ISO times. The clock starts when the student starts the module. */
  startedAt: string | null;
  submittedAt: string | null;
}

export interface TestScores {
  readingWriting: number;
  math: number;
  total: number;
}

/**
 * A student's current answers during a test. They can change answers and flag
 * questions until the module is submitted; then `correct` is filled in and the
 * answered questions are copied to `attempts`, so tests count toward mastery.
 */
export const testAnswers = pgTable(
  "test_answers",
  {
    practiceTestId: uuid("practice_test_id")
      .notNull()
      .references(() => practiceTests.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id),
    answer: text("answer").notNull().default(""),
    flagged: boolean("flagged").notNull().default(false),
    correct: boolean("correct"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.practiceTestId, t.questionId] })],
);

/**
 * Every answer a student submits. This is the single source of truth for skill
 * mastery and score estimates, which are recomputed from it (src/lib/trainer/mastery.ts).
 * Skill and difficulty are copied from the question so history stays stable if a question is edited.
 */
export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The practice set or the practice test the answer was given in; exactly one is set. */
    practiceSetId: uuid("practice_set_id").references(() => practiceSets.id, { onDelete: "cascade" }),
    practiceTestId: uuid("practice_test_id").references(() => practiceTests.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id),
    skill: text("skill").notNull(),
    difficulty: text("difficulty").$type<Difficulty>().notNull(),
    answer: text("answer").notNull(),
    correct: boolean("correct").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("attempts_user_idx").on(t.userId, t.createdAt),
    uniqueIndex("attempts_set_question_idx").on(t.practiceSetId, t.questionId),
    uniqueIndex("attempts_test_question_idx").on(t.practiceTestId, t.questionId),
  ],
);

/**
 * Season passes bought through Stripe Checkout. One row per payment. A student
 * has practice access while any non-revoked pass covers the current time;
 * buying again while a pass is active starts the new one when the old one ends.
 */
export const seasonPasses = pgTable(
  "season_passes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Makes fulfilment idempotent: the webhook and the return page may both report the same payment. */
    stripeCheckoutSessionId: text("stripe_checkout_session_id").notNull().unique(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    /** Set when the payment is fully refunded; the pass then stops counting. */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("season_passes_user_idx").on(t.userId, t.expiresAt),
    index("season_passes_payment_intent_idx").on(t.stripePaymentIntentId),
  ],
);

/** How a student did in one content domain, read off a score report (filled boxes, 1-7). */
export type DomainBands = Partial<Record<string, number>>;
/** Per-skill results from a test's question review, e.g. { "transitions": { correct: 3, total: 4 } }. */
export type SkillResults = Partial<Record<string, { correct: number; total: number }>>;

/**
 * Scores a student typed in from an official SAT or a Bluebook practice test.
 * Bluebook has no export, so these are entered by hand. The trainer uses the
 * latest one as a starting point for each skill (see src/lib/trainer/score-report.ts).
 */
export const scoreReports = pgTable(
  "score_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** "official" (a real SAT, PSAT or school day test) or "bluebook-practice". */
    kind: text("kind").$type<"official" | "bluebook-practice">().notNull(),
    /** The day the test was taken, YYYY-MM-DD. */
    testDate: text("test_date").notNull(),
    readingWriting: integer("reading_writing"),
    math: integer("math"),
    domainBands: jsonb("domain_bands").$type<DomainBands>().notNull().default({}),
    skillResults: jsonb("skill_results").$type<SkillResults>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("score_reports_user_idx").on(t.userId, t.testDate)],
);

/** Why a student reported a question. */
export type ReportReason = "wrong-answer" | "typo" | "unclear" | "explanation" | "other";
/** open: not looked at yet. fixed: the question was corrected. dismissed: nothing wrong. */
export type ReportStatus = "open" | "fixed" | "dismissed";

/**
 * Problems students report on a question ("the answer is wrong", a typo, ...),
 * reviewed on /admin/reports (src/lib/trainer/reports.ts).
 */
export const questionReports = pgTable(
  "question_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    reason: text("reason").$type<ReportReason>().notNull(),
    /** What the student wrote, up to 1000 characters; empty when they wrote nothing. */
    details: text("details").notNull().default(""),
    status: text("status").$type<ReportStatus>().notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [index("question_reports_status_idx").on(t.status, t.createdAt), index("question_reports_question_idx").on(t.questionId)],
);
