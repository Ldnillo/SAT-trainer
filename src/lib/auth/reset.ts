import { randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { Db } from "../db/client";
import { passwordResets, users } from "../db/schema";
import { deleteOtherSessions, hashToken, normalizeEmail, type User } from "./accounts";
import { hashPassword, MIN_PASSWORD_LENGTH } from "./password";

/** How long a reset link works. */
export const RESET_MINUTES = 60;

/**
 * Creates a one-time reset token for the account with this email, or returns
 * undefined when there is no such account. Callers must respond the same way
 * in both cases, so the form can't be used to find out who has an account.
 */
export async function createPasswordReset(
  db: Db,
  email: string,
  now = new Date(),
): Promise<{ user: User; token: string; expiresAt: Date } | undefined> {
  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.email, normalizeEmail(email)));
  if (!user) return undefined;
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + RESET_MINUTES * 60 * 1000);
  await db.insert(passwordResets).values({ tokenHash: hashToken(token), userId: user.id, expiresAt, createdAt: now });
  return { user, token, expiresAt };
}

/** The account a reset token belongs to, if the token is unused and unexpired. */
export async function userForResetToken(db: Db, token: string, now = new Date()): Promise<User | undefined> {
  const [row] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(passwordResets)
    .innerJoin(users, eq(users.id, passwordResets.userId))
    .where(
      and(eq(passwordResets.tokenHash, hashToken(token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, now)),
    );
  return row;
}

export type ResetResult = { ok: true; user: User } | { ok: false; error: "invalid-token" | "short-password" };

/**
 * Sets a new password with a reset token. The token, and every other reset
 * link for the account, stops working, and every device is signed out.
 */
export async function resetPassword(db: Db, token: string, password: string, now = new Date()): Promise<ResetResult> {
  const user = await userForResetToken(db, token, now);
  if (!user) return { ok: false, error: "invalid-token" };
  if (password.length < MIN_PASSWORD_LENGTH) return { ok: false, error: "short-password" };
  // Claim the token first so two submissions can't both use it.
  const claimed = await db
    .update(passwordResets)
    .set({ usedAt: now })
    .where(and(eq(passwordResets.tokenHash, hashToken(token)), isNull(passwordResets.usedAt)))
    .returning({ userId: passwordResets.userId });
  if (claimed.length === 0) return { ok: false, error: "invalid-token" };
  await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, user.id));
  await db
    .update(passwordResets)
    .set({ usedAt: now })
    .where(and(eq(passwordResets.userId, user.id), isNull(passwordResets.usedAt)));
  await deleteOtherSessions(db, user.id);
  return { ok: true, user };
}
