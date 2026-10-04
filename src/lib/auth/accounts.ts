import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt, ne } from "drizzle-orm";
import type { Db } from "../db/client";
import { attempts, authSessions, practiceSets, seasonPasses, users } from "../db/schema";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "./password";

export interface User {
  id: string;
  email: string;
  name: string;
}

export const SESSION_DAYS = 30;

export type SignUpResult = { ok: true; user: User } | { ok: false; error: "invalid-email" | "short-password" | "missing-name" | "email-taken" };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function createUser(
  db: Db,
  input: { email: string; name: string; password: string; termsAcceptedAt?: Date },
): Promise<SignUpResult> {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "invalid-email" };
  if (!name) return { ok: false, error: "missing-name" };
  if (input.password.length < MIN_PASSWORD_LENGTH) return { ok: false, error: "short-password" };

  const passwordHash = await hashPassword(input.password);
  const [row] = await db
    .insert(users)
    .values({ email, name, passwordHash, termsAcceptedAt: input.termsAcceptedAt })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id, email: users.email, name: users.name });
  return row ? { ok: true, user: row } : { ok: false, error: "email-taken" };
}

/** Returns the user if the email and password match. */
export async function checkCredentials(db: Db, email: string, password: string): Promise<User | undefined> {
  const [row] = await db.select().from(users).where(eq(users.email, normalizeEmail(email)));
  if (!row || !(await verifyPassword(password, row.passwordHash))) return undefined;
  return { id: row.id, email: row.email, name: row.name };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Starts a session and returns the token to put in the cookie. Only its hash is stored. */
export async function createSession(db: Db, userId: string, now = new Date()): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.delete(authSessions).where(and(eq(authSessions.userId, userId), lt(authSessions.expiresAt, now)));
  await db.insert(authSessions).values({ tokenHash: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function userForSession(db: Db, token: string, now = new Date()): Promise<User | undefined> {
  const [row] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(and(eq(authSessions.tokenHash, hashToken(token)), gt(authSessions.expiresAt, now)));
  return row;
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.delete(authSessions).where(eq(authSessions.tokenHash, hashToken(token)));
}

/** Signs the student out everywhere, except the session whose token is given (the device they're using). */
export async function deleteOtherSessions(db: Db, userId: string, keepToken?: string): Promise<void> {
  await db
    .delete(authSessions)
    .where(
      keepToken
        ? and(eq(authSessions.userId, userId), ne(authSessions.tokenHash, hashToken(keepToken)))
        : eq(authSessions.userId, userId),
    );
}

export type ChangePasswordResult = { ok: true } | { ok: false; error: "wrong-password" | "short-password" };

/** Changes the password after checking the current one, and signs out every other device. */
export async function changePassword(
  db: Db,
  userId: string,
  input: { current: string; next: string; keepToken?: string },
): Promise<ChangePasswordResult> {
  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId));
  if (!row || !(await verifyPassword(input.current, row.passwordHash))) return { ok: false, error: "wrong-password" };
  if (input.next.length < MIN_PASSWORD_LENGTH) return { ok: false, error: "short-password" };
  await db.update(users).set({ passwordHash: await hashPassword(input.next) }).where(eq(users.id, userId));
  await deleteOtherSessions(db, userId, input.keepToken);
  return { ok: true };
}

/**
 * Deletes the account and everything stored with it (sessions, practice sets,
 * answers, season pass records), after checking the password. Payment records
 * kept by Stripe are not affected.
 */
export async function deleteAccount(db: Db, userId: string, password: string): Promise<boolean> {
  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId));
  if (!row || !(await verifyPassword(password, row.passwordHash))) return false;
  await db.delete(users).where(eq(users.id, userId));
  return true;
}

/** Everything stored about a student, for the "download my data" link. */
export async function exportUserData(db: Db, userId: string) {
  const [account] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
      termsAcceptedAt: users.termsAcceptedAt,
    })
    .from(users)
    .where(eq(users.id, userId));
  if (!account) return undefined;
  const [sets, answers, passes] = await Promise.all([
    db.select().from(practiceSets).where(eq(practiceSets.userId, userId)).orderBy(practiceSets.createdAt),
    db.select().from(attempts).where(eq(attempts.userId, userId)).orderBy(attempts.createdAt),
    db
      .select({
        startsAt: seasonPasses.startsAt,
        expiresAt: seasonPasses.expiresAt,
        amountCents: seasonPasses.amountCents,
        currency: seasonPasses.currency,
        revokedAt: seasonPasses.revokedAt,
        createdAt: seasonPasses.createdAt,
      })
      .from(seasonPasses)
      .where(eq(seasonPasses.userId, userId))
      .orderBy(seasonPasses.createdAt),
  ]);
  return {
    account,
    practiceSets: sets,
    answers,
    seasonPasses: passes,
  };
}
