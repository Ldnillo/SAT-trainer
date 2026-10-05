"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/client";
import { isReportStatus, setReportsStatus } from "@/lib/trainer/reports";

/** Moves every report on a question in one status to another, e.g. all open ones to fixed. */
export async function updateReports(form: FormData) {
  await requireAdmin();
  const questionId = form.get("question");
  const from = form.get("from");
  const to = form.get("to");
  if (typeof questionId !== "string" || !isReportStatus(from) || !isReportStatus(to)) return;
  await setReportsStatus(await getDb(), questionId, from, to);
  revalidatePath("/admin/reports");
}
