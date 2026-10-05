"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { parseGoal, saveDailyGoal } from "@/lib/trainer/streak";

export async function updateDailyGoal(form: FormData) {
  const user = await requireUser("/dashboard");
  const goal = parseGoal(form.get("goal"));
  if (goal) await saveDailyGoal(await getDb(), user.id, goal);
  redirect("/dashboard");
}
