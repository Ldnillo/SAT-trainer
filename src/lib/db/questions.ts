import { and, asc, count, desc, eq, inArray, notInArray, sql, type SQL } from "drizzle-orm";
import type { Authorship, QuestionRecord, QuestionStatus } from "../sat/question";
import type { Difficulty, SectionId } from "../sat/taxonomy";
import type { Db } from "./client";
import { questions } from "./schema";

export type NewQuestion = Omit<QuestionRecord, "id" | "createdAt">;

export async function insertQuestions(db: Db, rows: NewQuestion[]): Promise<QuestionRecord[]> {
  if (rows.length === 0) return [];
  return db.insert(questions).values(rows).returning();
}

export interface QuestionQuery {
  section?: SectionId;
  domain?: string;
  skills?: string[];
  difficulties?: Difficulty[];
  /** Defaults to verified only, which is what students should see. */
  statuses?: QuestionStatus[];
  /** Questions to leave out, such as ones the student has already answered. */
  excludeIds?: string[];
  limit?: number;
  /** Random order, for drawing practice sets. Otherwise newest first. */
  random?: boolean;
}

/** The query the practice trainer uses: filter by skill, difficulty and status. */
export async function findQuestions(db: Db, q: QuestionQuery = {}): Promise<QuestionRecord[]> {
  const where: SQL[] = [inArray(questions.status, q.statuses ?? ["verified"])];
  if (q.section) where.push(eq(questions.section, q.section));
  if (q.domain) where.push(eq(questions.domain, q.domain));
  if (q.skills?.length) where.push(inArray(questions.skill, q.skills));
  if (q.difficulties?.length) where.push(inArray(questions.difficulty, q.difficulties));
  if (q.excludeIds?.length) where.push(notInArray(questions.id, q.excludeIds));

  return db
    .select()
    .from(questions)
    .where(and(...where))
    .orderBy(q.random ? sql`random()` : desc(questions.createdAt))
    .limit(q.limit ?? 50);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getQuestion(db: Db, id: string): Promise<QuestionRecord | undefined> {
  if (!UUID.test(id)) return undefined;
  const [row] = await db.select().from(questions).where(eq(questions.id, id));
  return row;
}

export async function setQuestionStatus(db: Db, id: string, status: QuestionStatus): Promise<void> {
  await db.update(questions).set({ status }).where(eq(questions.id, id));
}

export interface BankCount {
  skill: string;
  difficulty: Difficulty;
  status: QuestionStatus;
  count: number;
}

/** Question counts per skill, difficulty and status: shows where the bank is thin. */
export async function countQuestions(db: Db): Promise<BankCount[]> {
  return db
    .select({
      skill: questions.skill,
      difficulty: questions.difficulty,
      status: questions.status,
      count: count(),
    })
    .from(questions)
    .groupBy(questions.skill, questions.difficulty, questions.status)
    .orderBy(asc(questions.skill));
}

/** Appends a review to a question's authorship record. */
export async function addReview(db: Db, id: string, review: Authorship["reviews"][number]): Promise<void> {
  const q = await getQuestion(db, id);
  if (!q) throw new Error(`No question ${id}`);
  const authorship = { ...q.provenance.authorship, reviews: [...q.provenance.authorship.reviews, review] };
  await db.update(questions).set({ provenance: { ...q.provenance, authorship } }).where(eq(questions.id, id));
}
