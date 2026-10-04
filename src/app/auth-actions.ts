"use server";

import { redirect } from "next/navigation";
import { changePassword, checkCredentials, createUser, deleteAccount, normalizeEmail } from "@/lib/auth/accounts";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { clearHits, consume, isLimited, LIMITS, recordHit } from "@/lib/auth/rate-limit";
import { createPasswordReset, RESET_MINUTES, resetPassword } from "@/lib/auth/reset";
import { currentSessionToken, endSession, requireUser, startSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/send";
import { passwordChangedEmail, passwordResetEmail } from "@/lib/email/templates";
import { baseUrl, clientIp } from "@/lib/request";

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
  if (form.get("agree") !== "on") redirect("/signup?error=must-agree");
  const db = await getDb();
  if (!(await consume(db, [{ key: `signup:ip:${await clientIp()}`, limit: LIMITS.signUpsPerIp }]))) {
    redirect("/signup?error=too-many");
  }
  const result = await createUser(db, {
    email: field(form, "email"),
    name: field(form, "name"),
    password: field(form, "password"),
    termsAcceptedAt: new Date(),
  });
  if (!result.ok) redirect(`/signup?error=${result.error}`);
  await startSession(result.user.id);
  redirect("/dashboard");
}

export async function signIn(form: FormData) {
  const next = safeNext(form.get("next"));
  const db = await getDb();
  const emailKey = `signin:email:${normalizeEmail(field(form, "email"))}`;
  const ipKey = `signin:ip:${await clientIp()}`;
  if (
    (await isLimited(db, emailKey, LIMITS.signInFailuresPerEmail)) ||
    (await isLimited(db, ipKey, LIMITS.signInFailuresPerIp))
  ) {
    redirect(`/login?error=too-many&next=${encodeURIComponent(next)}`);
  }
  const user = await checkCredentials(db, field(form, "email"), field(form, "password"));
  if (!user) {
    await recordHit(db, emailKey);
    await recordHit(db, ipKey);
    redirect(`/login?error=invalid&next=${encodeURIComponent(next)}`);
  }
  await clearHits(db, emailKey);
  await startSession(user.id);
  redirect(next);
}

export async function signOut() {
  await endSession();
  redirect("/");
}

/** Emails a reset link. Answers the same whether or not the account exists. */
export async function requestPasswordReset(form: FormData) {
  const email = normalizeEmail(field(form, "email"));
  if (!email) redirect("/forgot-password");
  const db = await getDb();
  const allowed = await consume(db, [
    { key: `reset:email:${email}`, limit: LIMITS.resetEmailsPerEmail },
    { key: `reset:ip:${await clientIp()}`, limit: LIMITS.resetRequestsPerIp },
  ]);
  if (!allowed) redirect("/forgot-password?error=too-many");
  const reset = await createPasswordReset(db, email);
  if (reset) {
    const link = `${await baseUrl()}/reset-password?token=${encodeURIComponent(reset.token)}`;
    await sendEmail({ to: reset.user.email, ...passwordResetEmail({ name: reset.user.name, link, minutes: RESET_MINUTES }) });
  }
  redirect("/forgot-password?sent=1");
}

export async function completePasswordReset(form: FormData) {
  const token = field(form, "token");
  const password = field(form, "password");
  const back = `/reset-password?token=${encodeURIComponent(token)}`;
  if (password !== field(form, "confirm")) redirect(`${back}&error=mismatch`);
  const db = await getDb();
  const result = await resetPassword(db, token, password);
  if (!result.ok) redirect(result.error === "short-password" ? `${back}&error=short-password` : "/reset-password?error=invalid");
  await clearHits(db, `signin:email:${result.user.email}`);
  await sendEmail({ to: result.user.email, ...passwordChangedEmail({ name: result.user.name }) });
  await startSession(result.user.id);
  redirect("/dashboard?notice=password-reset");
}

export async function updatePassword(form: FormData) {
  const user = await requireUser("/account");
  const next = field(form, "next");
  if (next !== field(form, "confirm")) redirect("/account?error=mismatch");
  if (next.length < MIN_PASSWORD_LENGTH) redirect("/account?error=short-password");
  const result = await changePassword(await getDb(), user.id, {
    current: field(form, "current"),
    next,
    keepToken: await currentSessionToken(),
  });
  if (!result.ok) redirect(`/account?error=${result.error}`);
  await sendEmail({ to: user.email, ...passwordChangedEmail({ name: user.name }) });
  redirect("/account?notice=password-changed");
}

export async function removeAccount(form: FormData) {
  const user = await requireUser("/account");
  if (normalizeEmail(field(form, "confirm-email")) !== user.email) redirect("/account?error=delete-confirm");
  if (!(await deleteAccount(await getDb(), user.id, field(form, "password")))) redirect("/account?error=delete-password");
  await endSession();
  redirect("/?deleted=1");
}
