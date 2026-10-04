"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { testAccess } from "@/lib/billing/pass";
import { getDb } from "@/lib/db/client";
import { beginModule, saveTestAnswer, startTest, submitModule, unfinishedTest, type SaveResult } from "@/lib/test/tests";

export async function startPracticeTest() {
  const user = await requireUser("/test");
  const db = await getDb();
  // One test at a time: an unfinished test is resumed rather than replaced.
  const open = await unfinishedTest(db, user.id);
  if (open) redirect(`/test/${open.id}`);
  // The pass is enforced here, not just by hiding the button.
  if (!(await testAccess(db, user.id)).allowed) redirect("/pass?required=test");
  const test = await startTest(db, user.id);
  if (!test) redirect("/test?error=no-questions");
  redirect(`/test/${test.id}`);
}

export async function beginTestModule(testId: string, index: number) {
  const user = await requireUser(`/test/${testId}`);
  await beginModule(await getDb(), user.id, testId, index);
  redirect(`/test/${testId}`);
}

export async function saveTestResponse(testId: string, questionId: string, answer: string, flagged: boolean): Promise<SaveResult> {
  const user = await requireUser(`/test/${testId}`);
  return saveTestAnswer(await getDb(), user.id, String(testId), String(questionId), {
    answer: typeof answer === "string" ? answer : "",
    flagged: flagged === true,
  });
}

export async function submitTestModule(testId: string, index: number) {
  const user = await requireUser(`/test/${testId}`);
  await submitModule(await getDb(), user.id, testId, Number(index));
  redirect(`/test/${testId}`);
}
