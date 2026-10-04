import { and, count, desc, eq, gt, isNull } from "drizzle-orm";
import type { Db } from "../db/client";
import { practiceSets, practiceTests, seasonPasses } from "../db/schema";
import { passConfig } from "./config";

export type SeasonPass = typeof seasonPasses.$inferSelect;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The non-revoked passes that haven't ended yet, latest ending first. */
async function currentPasses(db: Db, userId: string, now: Date): Promise<SeasonPass[]> {
  return db
    .select()
    .from(seasonPasses)
    .where(and(eq(seasonPasses.userId, userId), isNull(seasonPasses.revokedAt), gt(seasonPasses.expiresAt, now)))
    .orderBy(desc(seasonPasses.expiresAt));
}

export interface PassStatus {
  /** True while a pass covers `now`. */
  active: boolean;
  /** When access ends, counting passes queued after the current one. Null without an active pass. */
  activeUntil: Date | null;
}

export async function passStatus(db: Db, userId: string, now = new Date()): Promise<PassStatus> {
  const passes = await currentPasses(db, userId, now);
  const active = passes.some((p) => p.startsAt <= now);
  return { active, activeUntil: active ? passes[0].expiresAt : null };
}

export interface PracticeAccess {
  allowed: boolean;
  pass: PassStatus;
  /** Free sets the student can still start without a pass. */
  freeSetsLeft: number;
}

/** Whether the student may start a new practice set: an active pass, or free sets left. */
export async function practiceAccess(db: Db, userId: string, now = new Date(), freeSets = passConfig().freeSets): Promise<PracticeAccess> {
  const pass = await passStatus(db, userId, now);
  const [{ n }] = await db.select({ n: count() }).from(practiceSets).where(eq(practiceSets.userId, userId));
  const freeSetsLeft = Math.max(0, freeSets - n);
  return { allowed: pass.active || freeSetsLeft > 0, pass, freeSetsLeft };
}

export interface TestAccess {
  allowed: boolean;
  pass: PassStatus;
  /** Free full-length tests the student can still start without a pass. */
  freeTestsLeft: number;
}

/** Whether the student may start a full-length practice test: an active pass, or free tests left. */
export async function testAccess(db: Db, userId: string, now = new Date(), freeTests = passConfig().freeTests): Promise<TestAccess> {
  const pass = await passStatus(db, userId, now);
  const [{ n }] = await db.select({ n: count() }).from(practiceTests).where(eq(practiceTests.userId, userId));
  const freeTestsLeft = Math.max(0, freeTests - n);
  return { allowed: pass.active || freeTestsLeft > 0, pass, freeTestsLeft };
}

export interface GrantInput {
  userId: string;
  checkoutSessionId: string;
  paymentIntentId: string | null;
  amountCents: number;
  currency: string;
  days: number;
}

/**
 * Records a paid pass. Safe to call more than once for the same checkout
 * session: only the first call creates a pass. A pass bought while another is
 * active starts when that one ends, so buying early never loses days.
 */
export async function grantPass(db: Db, input: GrantInput, now = new Date()): Promise<{ pass: SeasonPass; created: boolean }> {
  const [existing] = await db.select().from(seasonPasses).where(eq(seasonPasses.stripeCheckoutSessionId, input.checkoutSessionId));
  if (existing) return { pass: existing, created: false };

  const [latest] = await currentPasses(db, input.userId, now);
  const startsAt = latest ? latest.expiresAt : now;
  const expiresAt = new Date(startsAt.getTime() + input.days * DAY_MS);
  const [row] = await db
    .insert(seasonPasses)
    .values({
      userId: input.userId,
      startsAt,
      expiresAt,
      stripeCheckoutSessionId: input.checkoutSessionId,
      stripePaymentIntentId: input.paymentIntentId,
      amountCents: input.amountCents,
      currency: input.currency,
    })
    .onConflictDoNothing({ target: seasonPasses.stripeCheckoutSessionId })
    .returning();
  if (row) return { pass: row, created: true };
  // Another request recorded the same payment between the check and the insert.
  const [raced] = await db.select().from(seasonPasses).where(eq(seasonPasses.stripeCheckoutSessionId, input.checkoutSessionId));
  return { pass: raced, created: false };
}

/** Ends the pass bought with this payment (after a full refund). Returns how many passes were revoked. */
export async function revokePassForPayment(db: Db, paymentIntentId: string, now = new Date()): Promise<number> {
  const rows = await db
    .update(seasonPasses)
    .set({ revokedAt: now })
    .where(and(eq(seasonPasses.stripePaymentIntentId, paymentIntentId), isNull(seasonPasses.revokedAt)))
    .returning({ id: seasonPasses.id });
  return rows.length;
}

/** Passes still to come or in force, for showing on the pass page. */
export async function upcomingPasses(db: Db, userId: string, now = new Date()): Promise<SeasonPass[]> {
  return (await currentPasses(db, userId, now)).reverse();
}
