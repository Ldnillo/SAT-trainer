"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { addScoreReport, deleteScoreReport, parseScoreReportForm } from "@/lib/trainer/score-report";

export interface ScoreFormState {
  errors: string[];
  /** What was typed, so a form with a mistake comes back filled in. */
  values: Record<string, string>;
  /** Bumped on every submit so the form remounts with `values`. */
  attempt: number;
}

export async function saveScoreReport(prev: ScoreFormState, form: FormData): Promise<ScoreFormState> {
  const user = await requireUser("/scores");
  const parsed = parseScoreReportForm(form);
  if (!parsed.ok) {
    const values: Record<string, string> = {};
    form.forEach((v, k) => {
      if (typeof v === "string" && !k.startsWith("$")) values[k] = v;
    });
    return { errors: parsed.errors, values, attempt: prev.attempt + 1 };
  }
  await addScoreReport(await getDb(), user.id, parsed.report);
  revalidatePath("/dashboard");
  redirect("/scores?notice=saved");
}

export async function removeScoreReport(id: string) {
  const user = await requireUser("/scores");
  await deleteScoreReport(await getDb(), user.id, id);
  revalidatePath("/dashboard");
  redirect("/scores?notice=deleted");
}
