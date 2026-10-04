"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { practiceAccess } from "@/lib/billing/pass";
import { getDb } from "@/lib/db/client";
import type { PracticeFocus } from "@/lib/db/schema";
import { getSkill, SECTIONS, type SectionId } from "@/lib/sat/taxonomy";
import { startPracticeSet, submitAnswer } from "@/lib/trainer/practice";

function parseFocus(form: FormData): PracticeFocus | undefined {
  const kind = form.get("focus");
  const value = form.get("value");
  if (kind === "tailored") return { kind };
  if (kind === "section" && SECTIONS.includes(value as SectionId)) return { kind, section: value as SectionId };
  if (kind === "skill" && typeof value === "string") {
    try {
      return { kind, skill: getSkill(value).skill.id };
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export async function startPractice(form: FormData) {
  const user = await requireUser("/dashboard");
  const focus = parseFocus(form);
  if (!focus) redirect("/dashboard");
  const db = await getDb();
  // The pass is enforced here, not just by hiding buttons: a new set needs a pass or a free set left.
  if (!(await practiceAccess(db, user.id)).allowed) redirect("/pass?required=1");
  const set = await startPracticeSet(db, user.id, focus);
  if (!set) redirect("/dashboard?error=no-questions");
  redirect(`/practice/${set.id}`);
}

export async function answerQuestion(setId: string, questionId: string, form: FormData) {
  const user = await requireUser(`/practice/${setId}`);
  const answer = form.get("answer");
  const result = await submitAnswer(await getDb(), user.id, setId, questionId, typeof answer === "string" ? answer : "");
  if (!result.ok && result.error === "not-found") redirect("/dashboard");
  if (!result.ok) redirect(`/practice/${setId}`);
  redirect(`/practice/${setId}?reviewed=${questionId}`);
}
