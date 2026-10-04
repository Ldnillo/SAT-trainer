import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
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

export type PracticeFocus = { kind: "tailored" } | { kind: "section"; section: SectionId } | { kind: "skill"; skill: string };

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
    practiceSetId: uuid("practice_set_id")
      .notNull()
      .references(() => practiceSets.id, { onDelete: "cascade" }),
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
