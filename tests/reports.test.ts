import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createUser, deleteAccount, exportUserData } from "../src/lib/auth/accounts";
import { isAdminEmail } from "../src/lib/auth/admin";
import { openDb, type Db } from "../src/lib/db/client";
import { insertQuestions, type NewQuestion } from "../src/lib/db/questions";
import { questionReports } from "../src/lib/db/schema";
import type { QuestionContent } from "../src/lib/sat/question";
import { getSkill } from "../src/lib/sat/taxonomy";
import { loadReports, MAX_DETAILS, reportCounts, setReportsStatus, submitReport } from "../src/lib/trainer/reports";
import { rwQuestion, sprQuestion } from "./fixtures";

describe("staff access", () => {
  it("allows only the listed emails, ignoring case and spaces", () => {
    const env = { ADMIN_EMAILS: " Justine@Example.com, help@nextscore.test ", NODE_ENV: "production" };
    expect(isAdminEmail("justine@example.com", env)).toBe(true);
    expect(isAdminEmail("HELP@nextscore.test", env)).toBe(true);
    expect(isAdminEmail("student@example.com", env)).toBe(false);
    expect(isAdminEmail("student@example.com", { ...env, NODE_ENV: "development" })).toBe(false);
  });

  it("without a list, lets anyone in during development and no one in production", () => {
    expect(isAdminEmail("a@b.co", { NODE_ENV: "development" })).toBe(true);
    expect(isAdminEmail("a@b.co", { ADMIN_EMAILS: " , ", NODE_ENV: "development" })).toBe(true);
    expect(isAdminEmail("a@b.co", { NODE_ENV: "production" })).toBe(false);
  });
});

describe("problem reports (database)", () => {
  let db: Db;
  let close: () => Promise<void>;
  beforeEach(async () => ({ db, close } = await openDb("memory://")));
  afterEach(async () => close());

  function row(skill: string, content: QuestionContent, sourceId: string): NewQuestion {
    const ref = getSkill(skill);
    return {
      sourceId,
      section: ref.section,
      domain: ref.domain.id,
      skill,
      difficulty: "medium",
      format: content.choices.length ? "multiple-choice" : "student-produced-response",
      status: "verified",
      content,
      validationIssues: [],
      verification: null,
      provenance: { generator: "authored", promptVersion: "test", createdAt: "2026-01-01", authorship: { writer: { name: "test", date: "2026-01-01" }, inputs: { instructions: "test", examples: [] }, passageSource: "original", reviews: [{ reviewer: "test", date: "2026-01-01", edits: "none" }] } },
    };
  }

  async function student(email: string, name: string) {
    const r = await createUser(db, { email, name, password: "password1" });
    if (!r.ok) throw new Error(r.error);
    return r.user.id;
  }

  it("saves reports, groups them by question and moves them between statuses", async () => {
    const [rw, math] = await insertQuestions(db, [row("transitions", rwQuestion(), "transitions-001"), row("linear-equations-one-variable", sprQuestion(), "linear-equations-one-variable-001")]);
    const sam = await student("sam@example.com", "Sam");
    const ana = await student("ana@example.com", "Ana");

    expect(await submitReport(db, sam, { questionId: rw.id, reason: "wrong-answer", details: "  I think it's B.  " })).toEqual({ ok: true });
    expect(await submitReport(db, ana, { questionId: rw.id, reason: "typo", details: "" })).toEqual({ ok: true });
    expect(await submitReport(db, ana, { questionId: math.id, reason: "explanation", details: "x".repeat(MAX_DETAILS + 50) })).toEqual({ ok: true });

    expect(await submitReport(db, sam, { questionId: rw.id, reason: "other", details: "   " })).toEqual({ ok: false, error: "needs-details" });
    expect(await submitReport(db, sam, { questionId: rw.id, reason: "made-up", details: "" })).toEqual({ ok: false, error: "invalid" });
    expect(await submitReport(db, sam, { questionId: "not-a-question", reason: "typo", details: "" })).toEqual({ ok: false, error: "invalid" });
    expect(await submitReport(db, sam, { questionId: "00000000-0000-4000-8000-000000000000", reason: "typo", details: "" })).toEqual({ ok: false, error: "not-found" });

    const open = await loadReports(db, "open");
    expect(open.map((g) => g.question.sourceId).sort()).toEqual(["linear-equations-one-variable-001", "transitions-001"]);
    const rwGroup = open.find((g) => g.question.id === rw.id)!;
    expect(rwGroup.reports).toHaveLength(2);
    expect(rwGroup.reports.find((r) => r.reason === "wrong-answer")).toMatchObject({ details: "I think it's B.", reporter: { name: "Sam", email: "sam@example.com" } });
    expect(open.find((g) => g.question.id === math.id)!.reports[0].details).toHaveLength(MAX_DETAILS);
    expect(await reportCounts(db)).toEqual({ open: 3, fixed: 0, dismissed: 0 });

    const now = new Date("2026-10-05T12:00:00Z");
    expect(await setReportsStatus(db, rw.id, "open", "fixed", now)).toBe(2);
    expect(await setReportsStatus(db, math.id, "open", "dismissed", now)).toBe(1);
    expect(await reportCounts(db)).toEqual({ open: 0, fixed: 2, dismissed: 1 });
    const fixed = await loadReports(db, "fixed");
    expect(fixed).toHaveLength(1);
    expect(fixed[0].reports.every((r) => r.resolvedAt?.getTime() === now.getTime())).toBe(true);

    expect(await setReportsStatus(db, math.id, "dismissed", "open")).toBe(1);
    expect((await loadReports(db, "open"))[0].reports[0].resolvedAt).toBeNull();
    expect(await setReportsStatus(db, "bad-id", "open", "fixed")).toBe(0);
  });

  it("includes a student's reports in their data download and deletes them with the account", async () => {
    const [q] = await insertQuestions(db, [row("transitions", rwQuestion(), "transitions-001")]);
    const sam = await student("sam@example.com", "Sam");
    await submitReport(db, sam, { questionId: q.id, reason: "unclear", details: "Two choices work." });

    const data = await exportUserData(db, sam);
    expect(data?.problemReports).toEqual([expect.objectContaining({ questionId: q.id, reason: "unclear", details: "Two choices work.", status: "open" })]);

    expect(await deleteAccount(db, sam, "password1")).toBe(true);
    expect(await db.select().from(questionReports)).toHaveLength(0);
  });
});
