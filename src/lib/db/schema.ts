import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
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
