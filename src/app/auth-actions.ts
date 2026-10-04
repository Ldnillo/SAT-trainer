"use server";

import { redirect } from "next/navigation";
import { checkCredentials, createUser } from "@/lib/auth/accounts";
import { endSession, startSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

/** Only same-site paths, so a crafted ?next= can't send students elsewhere. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/dashboard";
}

function field(form: FormData, name: string): string {
  const v = form.get(name);
  return typeof v === "string" ? v : "";
}

export async function signUp(form: FormData) {
  const result = await createUser(await getDb(), {
    email: field(form, "email"),
    name: field(form, "name"),
    password: field(form, "password"),
  });
  if (!result.ok) redirect(`/signup?error=${result.error}`);
  await startSession(result.user.id);
  redirect("/dashboard");
}

export async function signIn(form: FormData) {
  const next = safeNext(form.get("next"));
  const user = await checkCredentials(await getDb(), field(form, "email"), field(form, "password"));
  if (!user) redirect(`/login?error=invalid&next=${encodeURIComponent(next)}`);
  await startSession(user.id);
  redirect(next);
}

export async function signOut() {
  await endSession();
  redirect("/");
}
