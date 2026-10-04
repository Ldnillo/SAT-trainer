import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { Db } from "../db/client";
import { findQuestions } from "../db/questions";
import { attempts, practiceTests, questions, testAnswers, type ModuleTier, type TestModule, type TestScores } from "../db/schema";
import type { QuestionRecord } from "../sat/question";
import type { SectionId } from "../sat/taxonomy";
import { isCorrect } from "../trainer/answers";
import type { SeenQuestion } from "../trainer/plan";
import { loadAttempts } from "../trainer/practice";
import { assembleModule } from "./assemble";
import { GRACE_SECONDS, MODULE_ORDER, sectionFormat } from "./format";
import { routeFor, sectionScore, type ScoredResponse } from "./scoring";

export type PracticeTest = typeof practiceTests.$inferSelect;
export type TestAnswer = typeof testAnswers.$inferSelect;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function seenQuestions(db: Db, userId: string): Promise<Map<string, SeenQuestion>> {
  const seen = new Map<string, SeenQuestion>();
  for (const a of await loadAttempts(db, userId)) seen.set(a.questionId, { correct: a.correct, at: a.createdAt });
  return seen;
}

async function buildModule(
  db: Db,
  userId: string,
  section: SectionId,
  stage: 1 | 2,
  tier: ModuleTier,
  exclude: ReadonlySet<string>,
  random: () => number,
): Promise<TestModule> {
  const [candidates, seen] = await Promise.all([findQuestions(db, { section, limit: 5000 }), seenQuestions(db, userId)]);
  const picked = assembleModule({ section, tier, candidates, seen, exclude, random });
  return { section, stage, tier, questionIds: picked.map((q) => q.id), startedAt: null, submittedAt: null };
}

/**
 * Starts a full-length test with its first module (Reading and Writing,
 * module 1). Later modules are assembled as the student reaches them.
 * Returns undefined when the bank can't fill a module.
 */
export async function startTest(db: Db, userId: string, random: () => number = Math.random): Promise<PracticeTest | undefined> {
  const [section] = MODULE_ORDER;
  const first = await buildModule(db, userId, section.section, 1, "standard", new Set(), random);
  if (first.questionIds.length < sectionFormat(section.section).questionsPerModule) return undefined;
  const [test] = await db.insert(practiceTests).values({ userId, modules: [first] }).returning();
  return test;
}

export async function getTest(db: Db, userId: string, testId: string): Promise<PracticeTest | undefined> {
  if (!UUID.test(testId)) return undefined;
  const [test] = await db
    .select()
    .from(practiceTests)
    .where(and(eq(practiceTests.id, testId), eq(practiceTests.userId, userId)));
  return test;
}

/** The student's unfinished test, if any. */
export async function unfinishedTest(db: Db, userId: string): Promise<PracticeTest | undefined> {
  const [test] = await db
    .select()
    .from(practiceTests)
    .where(and(eq(practiceTests.userId, userId), isNull(practiceTests.completedAt)))
    .orderBy(desc(practiceTests.createdAt))
    .limit(1);
  return test;
}

export async function recentTests(db: Db, userId: string, limit = 10): Promise<PracticeTest[]> {
  return db.select().from(practiceTests).where(eq(practiceTests.userId, userId)).orderBy(desc(practiceTests.createdAt)).limit(limit);
}

/** Index of the module the student is on, or -1 once the test is finished. */
export function currentModuleIndex(test: Pick<PracticeTest, "modules" | "completedAt">): number {
  if (test.completedAt) return -1;
  return test.modules.findIndex((m) => !m.submittedAt);
}

/** When the module's clock runs out, or null before it starts. */
export function moduleDeadline(m: TestModule): Date | null {
  if (!m.startedAt) return null;
  return new Date(new Date(m.startedAt).getTime() + sectionFormat(m.section).minutesPerModule * 60_000);
}

/** Milliseconds left on a started module's clock. */
export function timeLeft(m: TestModule, now = new Date()): number {
  const deadline = moduleDeadline(m);
  return deadline ? Math.max(0, deadline.getTime() - now.getTime()) : 0;
}

function pastGrace(m: TestModule, now: Date): boolean {
  const deadline = moduleDeadline(m);
  return deadline !== null && now.getTime() > deadline.getTime() + GRACE_SECONDS * 1000;
}

/** Starts the clock on the current module. Starting it again changes nothing. */
export async function beginModule(db: Db, userId: string, testId: string, index: number, now = new Date()): Promise<boolean> {
  const test = await getTest(db, userId, testId);
  if (!test || currentModuleIndex(test) !== index) return false;
  if (test.modules[index].startedAt) return true;
  const modules = test.modules.map((m, i) => (i === index ? { ...m, startedAt: now.toISOString() } : m));
  await db.update(practiceTests).set({ modules }).where(eq(practiceTests.id, test.id));
  return true;
}

export type SaveResult = { ok: true } | { ok: false; error: "not-found" | "not-current" | "time-up" };

/** Saves (or changes) an answer or flag on the current module while its clock is running. */
export async function saveTestAnswer(
  db: Db,
  userId: string,
  testId: string,
  questionId: string,
  input: { answer: string; flagged: boolean },
  now = new Date(),
): Promise<SaveResult> {
  const test = await getTest(db, userId, testId);
  if (!test) return { ok: false, error: "not-found" };
  const index = currentModuleIndex(test);
  const m = test.modules[index];
  if (!m?.startedAt || !m.questionIds.includes(questionId)) return { ok: false, error: "not-current" };
  if (pastGrace(m, now)) return { ok: false, error: "time-up" };
  const answer = input.answer.trim().slice(0, 50);
  await db
    .insert(testAnswers)
    .values({ practiceTestId: test.id, questionId, answer, flagged: input.flagged, updatedAt: now })
    .onConflictDoUpdate({
      target: [testAnswers.practiceTestId, testAnswers.questionId],
      set: { answer, flagged: input.flagged, updatedAt: now },
    });
  return { ok: true };
}

export async function loadTestAnswers(db: Db, testId: string): Promise<Map<string, TestAnswer>> {
  const rows = await db.select().from(testAnswers).where(eq(testAnswers.practiceTestId, testId));
  return new Map(rows.map((r) => [r.questionId, r]));
}

async function loadQuestions(db: Db, ids: readonly string[]): Promise<Map<string, QuestionRecord>> {
  if (ids.length === 0) return new Map();
  const rows = await db.select().from(questions).where(inArray(questions.id, [...ids]));
  return new Map(rows.map((q) => [q.id, q]));
}

/** Every response in a module, unanswered ones counted as wrong. */
function moduleResponses(m: TestModule, qs: Map<string, QuestionRecord>, answers: Map<string, TestAnswer>): ScoredResponse[] {
  return m.questionIds.flatMap((id) => {
    const q = qs.get(id);
    return q ? [{ difficulty: q.difficulty, correct: answers.get(id)?.correct ?? false }] : [];
  });
}

/**
 * Ends the current module: grades it, counts its answers toward skill mastery,
 * and sets up what comes next (module 2 at the right difficulty, the next
 * section, or the final scores). Submitting a module twice changes nothing.
 */
export async function submitModule(
  db: Db,
  userId: string,
  testId: string,
  index: number,
  now = new Date(),
  random: () => number = Math.random,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [test] = await tx
      .select()
      .from(practiceTests)
      .where(and(eq(practiceTests.id, testId), eq(practiceTests.userId, userId)))
      .for("update");
    if (!test || currentModuleIndex(test) !== index) return false;
    const m = test.modules[index];
    if (!m.startedAt) return false;

    const qs = await loadQuestions(tx, m.questionIds);
    const answers = await loadTestAnswers(tx, test.id);
    for (const id of m.questionIds) {
      const a = answers.get(id);
      const q = qs.get(id);
      if (!a || !q) continue;
      a.correct = a.answer !== "" && isCorrect(q.content, a.answer);
      await tx
        .update(testAnswers)
        .set({ correct: a.correct })
        .where(and(eq(testAnswers.practiceTestId, test.id), eq(testAnswers.questionId, id)));
      if (a.answer !== "") {
        await tx
          .insert(attempts)
          .values({
            userId,
            practiceTestId: test.id,
            questionId: id,
            skill: q.skill,
            difficulty: q.difficulty,
            answer: a.answer,
            correct: a.correct,
            createdAt: now,
          })
          .onConflictDoNothing();
      }
    }

    const modules = test.modules.map((x, i) => (i === index ? { ...x, submittedAt: now.toISOString() } : x));
    const next = MODULE_ORDER[index + 1];
    let scores: TestScores | null = null;
    if (next) {
      const tier = next.stage === 2 ? routeFor(moduleResponses(m, qs, answers)) : "standard";
      const used = new Set(modules.flatMap((x) => x.questionIds));
      modules.push(await buildModule(tx, userId, next.section, next.stage, tier, used, random));
    } else {
      const allQs = await loadQuestions(tx, modules.flatMap((x) => x.questionIds));
      const bySection = (section: SectionId) =>
        sectionScore(modules.filter((x) => x.section === section).flatMap((x) => moduleResponses(x, allQs, answers)));
      const readingWriting = bySection("reading-writing");
      const math = bySection("math");
      scores = { readingWriting, math, total: readingWriting + math };
    }
    await tx
      .update(practiceTests)
      .set({ modules, ...(scores ? { scores, completedAt: now } : {}) })
      .where(eq(practiceTests.id, test.id));
    return true;
  });
}

/** Submits the current module if its time ran out while the student was away. Returns the test as it now stands. */
export async function closeExpiredModule(db: Db, userId: string, test: PracticeTest, now = new Date()): Promise<PracticeTest> {
  const index = currentModuleIndex(test);
  if (index < 0 || !pastGrace(test.modules[index], now)) return test;
  await submitModule(db, userId, test.id, index, now);
  return (await getTest(db, userId, test.id)) ?? test;
}

export interface ReviewItem {
  question: QuestionRecord;
  answer: TestAnswer | undefined;
}

/** A module's questions in order with the student's answers. */
export async function loadModuleItems(db: Db, test: PracticeTest, index: number): Promise<ReviewItem[]> {
  const m = test.modules[index];
  const [qs, answers] = await Promise.all([loadQuestions(db, m.questionIds), loadTestAnswers(db, test.id)]);
  return m.questionIds.flatMap((id) => {
    const question = qs.get(id);
    return question ? [{ question, answer: answers.get(id) }] : [];
  });
}
