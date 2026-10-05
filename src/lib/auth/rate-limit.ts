import { and, count, eq, gt, lt } from "drizzle-orm";
import type { Db } from "../db/client";
import { rateLimitHits } from "../db/schema";

export interface Limit {
  /** How many hits are allowed inside the window. */
  max: number;
  windowMs: number;
}

const MINUTE = 60 * 1000;

/** Limits for the account pages (keys per email address and per IP address) and for question reports (per student). */
export const LIMITS = {
  /** Wrong passwords for one account. */
  signInFailuresPerEmail: { max: 10, windowMs: 15 * MINUTE },
  /** Wrong passwords from one network address, across accounts. */
  signInFailuresPerIp: { max: 50, windowMs: 15 * MINUTE },
  /** Reset emails sent to one address. */
  resetEmailsPerEmail: { max: 3, windowMs: 60 * MINUTE },
  resetRequestsPerIp: { max: 20, windowMs: 60 * MINUTE },
  /** Email-change confirmations requested by one student. */
  emailChangesPerUser: { max: 5, windowMs: 60 * MINUTE },
  signUpsPerIp: { max: 20, windowMs: 60 * MINUTE },
  /** "Report a problem" forms sent by one student. */
  reportsPerUser: { max: 20, windowMs: 60 * MINUTE },
} satisfies Record<string, Limit>;

/** True when `key` already has `max` hits inside the window. */
export async function isLimited(db: Db, key: string, limit: Limit, now = new Date()): Promise<boolean> {
  const since = new Date(now.getTime() - limit.windowMs);
  const [row] = await db
    .select({ n: count() })
    .from(rateLimitHits)
    .where(and(eq(rateLimitHits.key, key), gt(rateLimitHits.createdAt, since)));
  return (row?.n ?? 0) >= limit.max;
}

/** Hits older than this are deleted for every key; no limit's window is longer. */
const KEEP_MS = 24 * 60 * MINUTE;

/** Counts one hit against `key`, and deletes hits too old to matter (the privacy policy promises within a day). */
export async function recordHit(db: Db, key: string, now = new Date()): Promise<void> {
  await db.delete(rateLimitHits).where(lt(rateLimitHits.createdAt, new Date(now.getTime() - KEEP_MS)));
  await db.insert(rateLimitHits).values({ key, createdAt: now });
}

/** Checks every limit and, if none is reached, counts a hit against each. Returns false when limited. */
export async function consume(db: Db, checks: { key: string; limit: Limit }[], now = new Date()): Promise<boolean> {
  for (const c of checks) if (await isLimited(db, c.key, c.limit, now)) return false;
  for (const c of checks) await recordHit(db, c.key, now);
  return true;
}

/** Clears the hits for a key, e.g. failed sign-ins after a successful one or a password reset. */
export async function clearHits(db: Db, key: string): Promise<void> {
  await db.delete(rateLimitHits).where(eq(rateLimitHits.key, key));
}
