import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createUser } from "../src/lib/auth/accounts";
import { sendPassReminders, sendReceipt } from "../src/lib/billing/notify";
import { grantPass } from "../src/lib/billing/pass";
import { openDb, type Db } from "../src/lib/db/client";
import type { Email, SendResult } from "../src/lib/email/send";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-04T12:00:00Z");

describe("season pass emails", () => {
  let db: Db;
  let close: () => Promise<void>;
  let userId: string;
  let outbox: Email[];
  let result: SendResult;
  const send = async (e: Email) => {
    if (result.sent) outbox.push(e);
    return result;
  };
  beforeEach(async () => {
    ({ db, close } = await openDb("memory://"));
    const r = await createUser(db, { email: "a@b.co", name: "Ann", password: "password1" });
    if (!r.ok) throw new Error("setup");
    userId = r.user.id;
    outbox = [];
    result = { sent: true };
  });
  afterEach(async () => close());

  const grant = (id: string, at: Date, days = 30) =>
    grantPass(db, { userId, checkoutSessionId: id, paymentIntentId: `pi_${id}`, amountCents: 3000, currency: "usd", days }, at);

  it("sends a receipt with price, length and end date, once marked as sent", async () => {
    const { pass } = await grant("cs_1", NOW, 90);
    expect(await sendReceipt(db, pass, send)).toBe(true);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe("a@b.co");
    expect(outbox[0].text).toContain("90 days: $30.00");
    expect(outbox[0].text).toContain("January 2, 2027");
  });

  it("leaves the receipt unmarked when sending fails, without throwing", async () => {
    const { pass } = await grant("cs_1", NOW);
    result = { sent: false, reason: "failed" };
    expect(await sendReceipt(db, pass, send)).toBe(false);
  });

  it("reminds once, only inside the last 7 days of a pass", async () => {
    await grant("cs_1", NOW, 30); // ends Nov 3
    expect(await sendPassReminders(db, new Date(NOW.getTime() + 10 * DAY), send)).toEqual({ checked: 0, sent: 0 });
    const late = new Date(NOW.getTime() + 24 * DAY);
    expect(await sendPassReminders(db, late, send)).toEqual({ checked: 1, sent: 1 });
    expect(outbox[0].subject).toMatch(/ends soon/);
    expect(await sendPassReminders(db, new Date(late.getTime() + DAY), send)).toEqual({ checked: 0, sent: 0 });
  });

  it("skips students who already queued another pass, and retries after a failed send", async () => {
    await grant("cs_1", NOW, 30);
    await grant("cs_2", NOW, 30); // queued behind the first
    const late = new Date(NOW.getTime() + 27 * DAY);
    expect(await sendPassReminders(db, late, send)).toEqual({ checked: 1, sent: 0 });

    const later = new Date(NOW.getTime() + 55 * DAY);
    result = { sent: false, reason: "failed" };
    expect(await sendPassReminders(db, later, send)).toEqual({ checked: 1, sent: 0 });
    result = { sent: true };
    expect(await sendPassReminders(db, later, send)).toEqual({ checked: 1, sent: 1 });
  });
});
