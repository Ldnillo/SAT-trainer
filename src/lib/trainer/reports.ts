import { and, count, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { questionReports, questions, users, type ReportReason, type ReportStatus } from "../db/schema";
import type { QuestionRecord } from "../sat/question";
import { isReportReason, MAX_DETAILS } from "./report-reasons";

export { isReportReason, isReportStatus, MAX_DETAILS, reasonLabel, REPORT_REASONS, REPORT_STATUSES } from "./report-reasons";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SubmitReportResult = { ok: true } | { ok: false; error: "invalid" | "needs-details" | "not-found" };

/** Saves a student's report on a question. "Something else" needs a few words saying what. */
export async function submitReport(
  db: Db,
  userId: string,
  input: { questionId: string; reason: unknown; details: unknown },
): Promise<SubmitReportResult> {
  if (!UUID.test(input.questionId) || !isReportReason(input.reason)) return { ok: false, error: "invalid" };
  const details = typeof input.details === "string" ? input.details.trim().slice(0, MAX_DETAILS) : "";
  if (input.reason === "other" && !details) return { ok: false, error: "needs-details" };
  const [question] = await db.select({ id: questions.id }).from(questions).where(eq(questions.id, input.questionId));
  if (!question) return { ok: false, error: "not-found" };
  await db.insert(questionReports).values({ userId, questionId: question.id, reason: input.reason, details });
  return { ok: true };
}

export interface ReportEntry {
  id: string;
  reason: ReportReason;
  details: string;
  createdAt: Date;
  resolvedAt: Date | null;
  reporter: { name: string; email: string };
}

/** One question with the reports on it in one status, newest report first. */
export interface ReportedQuestion {
  question: QuestionRecord;
  reports: ReportEntry[];
}

/**
 * Reports in one status, grouped by question. Questions with the most recent
 * report come first, so a new problem shows at the top.
 */
export async function loadReports(db: Db, status: ReportStatus): Promise<ReportedQuestion[]> {
  const rows = await db
    .select({
      report: questionReports,
      question: questions,
      reporter: { name: users.name, email: users.email },
    })
    .from(questionReports)
    .innerJoin(questions, eq(questions.id, questionReports.questionId))
    .innerJoin(users, eq(users.id, questionReports.userId))
    .where(eq(questionReports.status, status))
    .orderBy(desc(questionReports.createdAt));
  const groups = new Map<string, ReportedQuestion>();
  for (const { report, question, reporter } of rows) {
    let group = groups.get(question.id);
    if (!group) groups.set(question.id, (group = { question, reports: [] }));
    group.reports.push({
      id: report.id,
      reason: report.reason,
      details: report.details,
      createdAt: report.createdAt,
      resolvedAt: report.resolvedAt,
      reporter,
    });
  }
  return [...groups.values()];
}

/** How many reports are in each status. */
export async function reportCounts(db: Db): Promise<Record<ReportStatus, number>> {
  const rows = await db.select({ status: questionReports.status, n: count() }).from(questionReports).groupBy(questionReports.status);
  const counts: Record<ReportStatus, number> = { open: 0, fixed: 0, dismissed: 0 };
  for (const r of rows) counts[r.status] = r.n;
  return counts;
}

/** Moves every report on a question from one status to another, e.g. all open reports to fixed. */
export async function setReportsStatus(
  db: Db,
  questionId: string,
  from: ReportStatus,
  to: ReportStatus,
  now = new Date(),
): Promise<number> {
  if (!UUID.test(questionId)) return 0;
  const updated = await db
    .update(questionReports)
    .set({ status: to, resolvedAt: to === "open" ? null : now })
    .where(and(eq(questionReports.questionId, questionId), eq(questionReports.status, from)))
    .returning({ id: questionReports.id });
  return updated.length;
}
