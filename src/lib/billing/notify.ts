import { and, eq, gt, isNull, lte } from "drizzle-orm";
import type { Db } from "../db/client";
import { seasonPasses, users } from "../db/schema";
import { passEndingEmail, receiptEmail } from "../email/templates";
import { sendEmail } from "../email/send";
import { formatPrice } from "./config";
import type { SeasonPass } from "./pass";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days before a pass ends when the reminder email goes out. */
export const REMINDER_DAYS = 7;

function passUrl(): string {
  return `${process.env.APP_URL?.replace(/\/$/, "") ?? ""}/pass`;
}

/** Emails the receipt for a newly granted pass and records that it went out. Never throws. */
export async function sendReceipt(db: Db, pass: SeasonPass, send: typeof sendEmail = sendEmail): Promise<boolean> {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, pass.userId));
    if (!user) return false;
    const days = Math.round((pass.expiresAt.getTime() - pass.startsAt.getTime()) / DAY_MS);
    const email = receiptEmail({
      name: user.name,
      amount: formatPrice(pass.amountCents, pass.currency),
      days,
      startsAt: pass.startsAt,
      expiresAt: pass.expiresAt,
      passUrl: passUrl(),
    });
    const result = await send({ to: user.email, ...email });
    if (!result.sent) return false;
    await db.update(seasonPasses).set({ receiptSentAt: new Date() }).where(eq(seasonPasses.id, pass.id));
    return true;
  } catch (err) {
    console.error("Receipt email failed:", err);
    return false;
  }
}

/**
 * Emails students whose access ends within REMINDER_DAYS, once per pass. A student
 * who already bought a following pass isn't reminded. Run daily (see /api/cron/pass-reminders).
 */
export async function sendPassReminders(db: Db, now = new Date(), send: typeof sendEmail = sendEmail): Promise<{ checked: number; sent: number }> {
  const due = await db
    .select({ pass: seasonPasses, email: users.email, name: users.name })
    .from(seasonPasses)
    .innerJoin(users, eq(users.id, seasonPasses.userId))
    .where(
      and(
        isNull(seasonPasses.revokedAt),
        isNull(seasonPasses.reminderSentAt),
        gt(seasonPasses.expiresAt, now),
        lte(seasonPasses.expiresAt, new Date(now.getTime() + REMINDER_DAYS * DAY_MS)),
      ),
    );
  let sent = 0;
  for (const { pass, email, name } of due) {
    // A pass queued behind this one means access continues, so there's nothing to warn about.
    const [next] = await db
      .select({ id: seasonPasses.id })
      .from(seasonPasses)
      .where(and(eq(seasonPasses.userId, pass.userId), isNull(seasonPasses.revokedAt), gt(seasonPasses.expiresAt, pass.expiresAt)))
      .limit(1);
    if (next) continue;
    const result = await send({ to: email, ...passEndingEmail({ name, expiresAt: pass.expiresAt, passUrl: passUrl() }) });
    if (!result.sent) continue;
    await db.update(seasonPasses).set({ reminderSentAt: now }).where(eq(seasonPasses.id, pass.id));
    sent++;
  }
  return { checked: due.length, sent };
}
