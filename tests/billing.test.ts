import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createUser } from "../src/lib/auth/accounts";
import { DEFAULT_PASS_CONFIG, formatPrice, passConfig } from "../src/lib/billing/config";
import { grantPass, passStatus, practiceAccess, revokePassForPayment } from "../src/lib/billing/pass";
import { checkoutParams, fulfillCheckout, handleStripeEvent } from "../src/lib/billing/stripe";
import { openDb, type Db } from "../src/lib/db/client";
import { practiceSets } from "../src/lib/db/schema";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-04T12:00:00Z");

describe("pass config", () => {
  it("uses the defaults and reads overrides from the environment", () => {
    expect(passConfig({})).toEqual(DEFAULT_PASS_CONFIG);
    expect(passConfig({ SEASON_PASS_PRICE_CENTS: "2500", SEASON_PASS_DAYS: "120", FREE_PRACTICE_SETS: "0", SEASON_PASS_CURRENCY: "EUR" })).toEqual({
      priceCents: 2500,
      days: 120,
      freeSets: 0,
      currency: "eur",
    });
    expect(() => passConfig({ SEASON_PASS_PRICE_CENTS: "39.99" })).toThrow();
    expect(() => passConfig({ SEASON_PASS_DAYS: "0" })).toThrow();
    expect(formatPrice(3900, "usd")).toBe("$39.00");
  });

  it("builds a one-time Checkout session that carries the user and pass length", () => {
    const p = checkoutParams({ id: "u1", email: "a@b.co" }, "https://example.com", { ...DEFAULT_PASS_CONFIG, days: 60 });
    expect(p.mode).toBe("payment");
    expect(p.client_reference_id).toBe("u1");
    expect(p.metadata).toEqual({ purpose: "season-pass", userId: "u1", days: "60" });
    expect(p.line_items![0].price_data!.unit_amount).toBe(3900);
    expect(p.success_url).toBe("https://example.com/pass?session_id={CHECKOUT_SESSION_ID}");
  });
});

describe("season passes (database)", () => {
  let db: Db;
  let close: () => Promise<void>;
  let userId: string;
  beforeEach(async () => {
    ({ db, close } = await openDb("memory://"));
    const r = await createUser(db, { email: "a@b.co", name: "A", password: "password1" });
    if (!r.ok) throw new Error("setup");
    userId = r.user.id;
  });
  afterEach(async () => close());

  const grant = (id: string, at = NOW, days = 90) =>
    grantPass(db, { userId, checkoutSessionId: id, paymentIntentId: `pi_${id}`, amountCents: 3900, currency: "usd", days }, at);

  function session(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
    return {
      id: "cs_test_1",
      object: "checkout.session",
      client_reference_id: userId,
      metadata: { purpose: "season-pass", userId, days: "90" },
      payment_status: "paid",
      payment_intent: "pi_1",
      amount_total: 3900,
      currency: "usd",
      ...overrides,
    } as Stripe.Checkout.Session;
  }

  it("allows free sets, then requires a pass", async () => {
    expect(await practiceAccess(db, userId, NOW, 1)).toMatchObject({ allowed: true, freeSetsLeft: 1, pass: { active: false } });
    await db.insert(practiceSets).values({ userId, focus: { kind: "tailored" }, questionIds: [] });
    expect(await practiceAccess(db, userId, NOW, 1)).toMatchObject({ allowed: false, freeSetsLeft: 0 });
    await grant("cs_a");
    expect(await practiceAccess(db, userId, NOW, 1)).toMatchObject({ allowed: true, pass: { active: true } });
  });

  it("lasts the paid number of days, stacks a second purchase, and is idempotent", async () => {
    const first = await grant("cs_a");
    expect(first.created).toBe(true);
    expect(first.pass.expiresAt.getTime()).toBe(NOW.getTime() + 90 * DAY);
    expect((await grant("cs_a")).created).toBe(false);

    const second = await grant("cs_b", new Date(NOW.getTime() + 10 * DAY), 30);
    expect(second.pass.startsAt).toEqual(first.pass.expiresAt);
    expect((await passStatus(db, userId, NOW)).activeUntil).toEqual(new Date(NOW.getTime() + 120 * DAY));
    expect((await passStatus(db, userId, new Date(NOW.getTime() + 100 * DAY))).active).toBe(true);
    expect((await passStatus(db, userId, new Date(NOW.getTime() + 121 * DAY))).active).toBe(false);
  });

  it("is revoked by a full refund", async () => {
    await grant("cs_a");
    expect(await revokePassForPayment(db, "pi_cs_a")).toBe(1);
    expect((await passStatus(db, userId, NOW)).active).toBe(false);
  });

  it("grants only for paid season pass sessions belonging to the student", async () => {
    expect(await fulfillCheckout(db, session({ payment_status: "unpaid" }))).toEqual({ ok: false, reason: "unpaid" });
    expect(await fulfillCheckout(db, session({ metadata: {} }))).toEqual({ ok: false, reason: "not-a-pass" });
    expect(await fulfillCheckout(db, session({ client_reference_id: "someone-else" }))).toEqual({ ok: false, reason: "not-a-pass" });
    expect(await fulfillCheckout(db, session(), "00000000-0000-0000-0000-000000000000")).toEqual({ ok: false, reason: "wrong-user" });
    expect((await passStatus(db, userId)).active).toBe(false);

    const ok = await fulfillCheckout(db, session(), userId);
    expect(ok).toMatchObject({ ok: true, created: true });
    expect((await passStatus(db, userId)).active).toBe(true);
  });

  it("handles signed webhook events end to end", async () => {
    const stripe = new Stripe("sk_test_dummy");
    const secret = "whsec_test";
    const payload = JSON.stringify({ id: "evt_1", object: "event", type: "checkout.session.completed", data: { object: session() } });
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    const event = stripe.webhooks.constructEvent(payload, header, secret);
    await handleStripeEvent(db, event);
    await handleStripeEvent(db, event); // Stripe may deliver an event more than once.
    expect((await passStatus(db, userId)).active).toBe(true);

    expect(() => stripe.webhooks.constructEvent(payload, header, "whsec_other")).toThrow();

    const partial = { id: "evt_2", object: "event", type: "charge.refunded", data: { object: { object: "charge", payment_intent: "pi_1", refunded: false } } };
    await handleStripeEvent(db, partial as unknown as Stripe.Event);
    expect((await passStatus(db, userId)).active).toBe(true);
    const full = { ...partial, data: { object: { ...partial.data.object, refunded: true } } };
    await handleStripeEvent(db, full as unknown as Stripe.Event);
    expect((await passStatus(db, userId)).active).toBe(false);
  });
});
