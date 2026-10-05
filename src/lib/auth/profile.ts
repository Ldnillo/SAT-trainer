import { randomBytes } from "node:crypto";
import { and, eq, gt, isNull, ne } from "drizzle-orm";
import type { Db } from "../db/client";
import { emailChanges, users } from "../db/schema";
import { hashToken, normalizeEmail, type User } from "./accounts";
import { verifyPassword } from "./password";

/** How long an email-change link works. */
export const EMAIL_CHANGE_MINUTES = 60;

export const MAX_NAME_LENGTH = 100;

export type UpdateNameResult = { ok: true } | { ok: false; error: "missing-name" | "long-name" };

export async function updateName(db: Db, userId: string, name: string): Promise<UpdateNameResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "missing-name" };
  if (trimmed.length > MAX_NAME_LENGTH) return { ok: false, error: "long-name" };
  await db.update(users).set({ name: trimmed }).where(eq(users.id, userId));
  return { ok: true };
}

export type RequestEmailChangeResult =
  | { ok: true; token: string; newEmail: string }
  | { ok: false; error: "wrong-password" | "invalid-email" | "same-email" | "email-taken" };

/** Checks the password and starts an email change; the new address is only used once confirmed. */
export async function requestEmailChange(
  db: Db,
  userId: string,
  input: { newEmail: string; password: string },
  now = new Date(),
): Promise<RequestEmailChangeResult> {
  const [row] = await db.select({ email: users.email, passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId));
  if (!row || !(await verifyPassword(input.password, row.passwordHash))) return { ok: false, error: "wrong-password" };
  const newEmail = normalizeEmail(input.newEmail);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return { ok: false, error: "invalid-email" };
  if (newEmail === row.email) return { ok: false, error: "same-email" };
  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, newEmail));
  if (taken) return { ok: false, error: "email-taken" };
  // A new request replaces any earlier pending one.
  await db.update(emailChanges).set({ usedAt: now }).where(and(eq(emailChanges.userId, userId), isNull(emailChanges.usedAt)));
  const token = randomBytes(32).toString("base64url");
  await db.insert(emailChanges).values({
    tokenHash: hashToken(token),
    userId,
    newEmail,
    expiresAt: new Date(now.getTime() + EMAIL_CHANGE_MINUTES * 60 * 1000),
    createdAt: now,
  });
  return { ok: true, token, newEmail };
}

export type ConfirmEmailChangeResult =
  | { ok: true; user: User; oldEmail: string }
  | { ok: false; error: "invalid-token" | "email-taken" };

/** Applies a pending email change. The link works once. */
export async function confirmEmailChange(db: Db, token: string, now = new Date()): Promise<ConfirmEmailChangeResult> {
  const tokenHash = hashToken(token);
  const [pending] = await db
    .select()
    .from(emailChanges)
    .where(and(eq(emailChanges.tokenHash, tokenHash), isNull(emailChanges.usedAt), gt(emailChanges.expiresAt, now)));
  if (!pending) return { ok: false, error: "invalid-token" };
  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, pending.newEmail), ne(users.id, pending.userId)));
  if (taken) return { ok: false, error: "email-taken" };
  const claimed = await db
    .update(emailChanges)
    .set({ usedAt: now })
    .where(and(eq(emailChanges.tokenHash, tokenHash), isNull(emailChanges.usedAt)))
    .returning({ id: emailChanges.tokenHash });
  if (claimed.length === 0) return { ok: false, error: "invalid-token" };
  const [before] = await db.select({ email: users.email }).from(users).where(eq(users.id, pending.userId));
  try {
    const [user] = await db
      .update(users)
      .set({ email: pending.newEmail })
      .where(eq(users.id, pending.userId))
      .returning({ id: users.id, email: users.email, name: users.name });
    if (!user || !before) return { ok: false, error: "invalid-token" };
    return { ok: true, user, oldEmail: before.email };
  } catch {
    // Someone registered the address between the check and the update.
    return { ok: false, error: "email-taken" };
  }
}
