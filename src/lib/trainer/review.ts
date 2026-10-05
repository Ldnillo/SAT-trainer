import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db } from "../db/client";
import { questionFlags, questions } from "../db/schema";
import type { QuestionRecord } from "../sat/question";
import type { Attempt } from "./practice";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Flags or unflags a question for the student. Flagging twice changes nothing. */
export async function setFlag(db: Db, userId: string, questionId: string, flagged: boolean): Promise<boolean> {
  if (!UUID.test(questionId)) return false;
  if (!flagged) {
    await db.delete(questionFlags).where(and(eq(questionFlags.userId, userId), eq(questionFlags.questionId, questionId)));
    return true;
  }
  const [question] = await db.select({ id: questions.id }).from(questions).where(eq(questions.id, questionId));
  if (!question) return false;
  await db.insert(questionFlags).values({ userId, questionId }).onConflictDoNothing();
  return true;
}

/** Ids of the questions the student has flagged. */
export async function flaggedIds(db: Db, userId: string): Promise<Set<string>> {
  const rows = await db.select({ id: questionFlags.questionId }).from(questionFlags).where(eq(questionFlags.userId, userId));
  return new Set(rows.map((r) => r.id));
}

export interface FlaggedQuestion {
  question: QuestionRecord;
  flaggedAt: Date;
}

/** Flagged questions students may see, oldest flag first. */
export async function loadFlagged(db: Db, userId: string): Promise<FlaggedQuestion[]> {
  const rows = await db
    .select({ question: questions, flaggedAt: questionFlags.createdAt })
    .from(questionFlags)
    .innerJoin(questions, eq(questions.id, questionFlags.questionId))
    .where(and(eq(questionFlags.userId, userId), eq(questions.status, "verified")))
    .orderBy(asc(questionFlags.createdAt));
  return rows;
}

export interface Mistake {
  questionId: string;
  /** The wrong answer the student gave last time. */
  answer: string;
  missedAt: Date;
  /** How many times the student has answered this question wrong. */
  timesMissed: number;
}

/**
 * Questions whose most recent answer was wrong, oldest miss first. A question
 * drops off the list once the student answers it correctly, in a retry set or
 * anywhere else.
 */
export function mistakesFrom(history: Pick<Attempt, "questionId" | "answer" | "correct" | "createdAt">[]): Mistake[] {
  const latest = new Map<string, Mistake>();
  const misses = new Map<string, number>();
  const sorted = [...history].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const a of sorted) {
    if (!a.correct) misses.set(a.questionId, (misses.get(a.questionId) ?? 0) + 1);
    if (a.correct) latest.delete(a.questionId);
    else latest.set(a.questionId, { questionId: a.questionId, answer: a.answer, missedAt: a.createdAt, timesMissed: 0 });
  }
  return [...latest.values()]
    .map((m) => ({ ...m, timesMissed: misses.get(m.questionId) ?? 1 }))
    .sort((a, b) => a.missedAt.getTime() - b.missedAt.getTime());
}

/** Loads the questions behind a list of ids, keeping only ones students may see, in the given order. */
export async function questionsInOrder(db: Db, ids: string[]): Promise<QuestionRecord[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(questions)
    .where(and(inArray(questions.id, ids), eq(questions.status, "verified")));
  const byId = new Map(rows.map((q) => [q.id, q]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}
