import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import type { Db } from "../db/client";
import { authSessions, users } from "../db/schema";
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

export async function createUser(db: Db, input: { email: string; name: string; password: string }): Promise<SignUpResult> {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "invalid-email" };
  if (!name) return { ok: false, error: "missing-name" };
  if (input.password.length < MIN_PASSWORD_LENGTH) return { ok: false, error: "short-password" };

  const passwordHash = await hashPassword(input.password);
  const [row] = await db
    .insert(users)
    .values({ email, name, passwordHash })
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

function hashToken(token: string): string {
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
