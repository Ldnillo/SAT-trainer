import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../db/client";
import { findQuestions } from "../db/questions";
import { attempts, practiceSets, questions, type PracticeFocus } from "../db/schema";
import type { QuestionRecord } from "../sat/question";
import { allSkills } from "../sat/taxonomy";
import { isCorrect } from "./answers";
import { computeMastery } from "./mastery";
import { planPracticeSet, type SeenQuestion } from "./plan";
import { loadFlagged, mistakesFrom, questionsInOrder } from "./review";

export const DEFAULT_SET_SIZE = 10;

export type PracticeSet = typeof practiceSets.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;

/** All of a student's answers, oldest first. */
export async function loadAttempts(db: Db, userId: string): Promise<Attempt[]> {
  return db.select().from(attempts).where(eq(attempts.userId, userId)).orderBy(asc(attempts.createdAt));
}

function skillsFor(focus: Exclude<PracticeFocus, { kind: "mistakes" | "flagged" }>): string[] {
  if (focus.kind === "skill") return [focus.skill];
  return allSkills()
    .filter((s) => focus.kind === "tailored" || s.section === focus.section)
    .map((s) => s.skill.id);
}

/**
 * Creates a practice set tailored to the student's current mastery.
 * Returns undefined when the bank has no verified questions for the focus.
 */
export async function startPracticeSet(
  db: Db,
  userId: string,
  focus: PracticeFocus,
  size = DEFAULT_SET_SIZE,
  random: () => number = Math.random,
): Promise<PracticeSet | undefined> {
  const history = await loadAttempts(db, userId);
  const picked = await pickFor(db, userId, focus, history, size, random);
  if (picked.length === 0) return undefined;

  const [set] = await db
    .insert(practiceSets)
    .values({ userId, focus, questionIds: picked.map((q) => q.id) })
    .returning();
  return set;
}

async function pickFor(
  db: Db,
  userId: string,
  focus: PracticeFocus,
  history: Attempt[],
  size: number,
  random: () => number,
): Promise<{ id: string }[]> {
  // Retry sets: the oldest mistakes or flags first, so everything comes round in turn.
  if (focus.kind === "mistakes") {
    return (await questionsInOrder(db, mistakesFrom(history).map((m) => m.questionId))).slice(0, size);
  }
  if (focus.kind === "flagged") {
    return (await loadFlagged(db, userId)).slice(0, size).map((f) => f.question);
  }
  const seen = new Map<string, SeenQuestion>();
  for (const a of history) seen.set(a.questionId, { correct: a.correct, at: a.createdAt });

  const candidates = await findQuestions(db, { skills: skillsFor(focus), limit: 5000 });
  return planPracticeSet({ candidates, mastery: computeMastery(history), seen, size, random });
}

export async function getPracticeSet(db: Db, userId: string, setId: string): Promise<PracticeSet | undefined> {
  if (!/^[0-9a-f-]{36}$/i.test(setId)) return undefined;
  const [set] = await db
    .select()
    .from(practiceSets)
    .where(and(eq(practiceSets.id, setId), eq(practiceSets.userId, userId)));
  return set;
}

export async function recentPracticeSets(db: Db, userId: string, limit = 10): Promise<PracticeSet[]> {
  return db.select().from(practiceSets).where(eq(practiceSets.userId, userId)).orderBy(desc(practiceSets.createdAt)).limit(limit);
}

/** The set's questions in order, with the student's answer to each so far. */
export async function loadSetQuestions(
  db: Db,
  set: PracticeSet,
): Promise<{ question: QuestionRecord; attempt: Attempt | undefined }[]> {
  const [rows, answers] = await Promise.all([
    db.select().from(questions).where(inArray(questions.id, set.questionIds)),
    db.select().from(attempts).where(eq(attempts.practiceSetId, set.id)),
  ]);
  const byId = new Map(rows.map((q) => [q.id, q]));
  return set.questionIds.flatMap((id) => {
    const question = byId.get(id);
    return question ? [{ question, attempt: answers.find((a) => a.questionId === id) }] : [];
  });
}

export type SubmitResult =
  | { ok: true; correct: boolean; completed: boolean }
  | { ok: false; error: "not-found" | "not-in-set" | "empty-answer" };

/** Records an answer. Answering the same question twice in a set keeps the first answer. */
export async function submitAnswer(
  db: Db,
  userId: string,
  setId: string,
  questionId: string,
  answer: string,
): Promise<SubmitResult> {
  const set = await getPracticeSet(db, userId, setId);
  if (!set) return { ok: false, error: "not-found" };
  if (!set.questionIds.includes(questionId)) return { ok: false, error: "not-in-set" };
  if (!answer.trim()) return { ok: false, error: "empty-answer" };

  const [question] = await db.select().from(questions).where(eq(questions.id, questionId));
  if (!question) return { ok: false, error: "not-in-set" };
  const correct = isCorrect(question.content, answer);
  await db
    .insert(attempts)
    .values({
      userId,
      practiceSetId: set.id,
      questionId,
      skill: question.skill,
      difficulty: question.difficulty,
      answer: answer.trim().slice(0, 50),
      correct,
    })
    .onConflictDoNothing();

  const answered = await db.select({ id: attempts.id }).from(attempts).where(eq(attempts.practiceSetId, set.id));
  const completed = answered.length >= set.questionIds.length;
  if (completed && !set.completedAt) {
    await db.update(practiceSets).set({ completedAt: new Date() }).where(eq(practiceSets.id, set.id));
  }
  return { ok: true, correct, completed };
}
