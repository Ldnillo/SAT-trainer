import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  changePassword,
  checkCredentials,
  createSession,
  createUser,
  deleteAccount,
  exportUserData,
  userForSession,
} from "../src/lib/auth/accounts";
import { clearHits, consume, isLimited, recordHit } from "../src/lib/auth/rate-limit";
import { createPasswordReset, RESET_MINUTES, resetPassword, userForResetToken } from "../src/lib/auth/reset";
import { confirmEmailChange, EMAIL_CHANGE_MINUTES, requestEmailChange, updateName } from "../src/lib/auth/profile";
import { grantPass } from "../src/lib/billing/pass";
import { openDb, type Db } from "../src/lib/db/client";
import { seasonPasses, users } from "../src/lib/db/schema";
import { sendEmail } from "../src/lib/email/send";
import { passwordResetEmail } from "../src/lib/email/templates";
import { siteConfig } from "../src/lib/site";

const NOW = new Date("2026-10-04T12:00:00Z");
const MINUTE = 60 * 1000;

describe("accounts (database)", () => {
  let db: Db;
  let close: () => Promise<void>;
  let userId: string;
  beforeEach(async () => {
    ({ db, close } = await openDb("memory://"));
    const r = await createUser(db, { email: "Sam@Example.com", name: "Sam", password: "password1", termsAcceptedAt: NOW });
    if (!r.ok) throw new Error("setup");
    userId = r.user.id;
  });
  afterEach(async () => close());

  it("records when the terms were accepted", async () => {
    const [row] = await db.select().from(users);
    expect(row.termsAcceptedAt).toEqual(NOW);
  });

  describe("password reset", () => {
    it("resets with a valid token, once, and signs out every device", async () => {
      const { token: session } = await createSession(db, userId, NOW);
      const reset = await createPasswordReset(db, "  sam@example.COM ", NOW);
      expect(reset?.user.id).toBe(userId);
      expect(await userForResetToken(db, reset!.token, NOW)).toMatchObject({ id: userId });

      expect(await resetPassword(db, reset!.token, "short", NOW)).toEqual({ ok: false, error: "short-password" });
      const result = await resetPassword(db, reset!.token, "new-password", NOW);
      expect(result.ok).toBe(true);

      expect(await checkCredentials(db, "sam@example.com", "password1")).toBeUndefined();
      expect(await checkCredentials(db, "sam@example.com", "new-password")).toMatchObject({ id: userId });
      expect(await userForSession(db, session, NOW)).toBeUndefined();
      // The link works only once.
      expect(await resetPassword(db, reset!.token, "another-password", NOW)).toEqual({ ok: false, error: "invalid-token" });
      expect(await userForResetToken(db, reset!.token, NOW)).toBeUndefined();
    });

    it("returns nothing for an unknown email", async () => {
      expect(await createPasswordReset(db, "nobody@example.com", NOW)).toBeUndefined();
    });

    it("rejects expired and made-up tokens", async () => {
      const reset = await createPasswordReset(db, "sam@example.com", NOW);
      const later = new Date(NOW.getTime() + (RESET_MINUTES + 1) * MINUTE);
      expect(await resetPassword(db, reset!.token, "new-password", later)).toEqual({ ok: false, error: "invalid-token" });
      expect(await resetPassword(db, "not-a-token", "new-password", NOW)).toEqual({ ok: false, error: "invalid-token" });
      expect(await checkCredentials(db, "sam@example.com", "password1")).toBeDefined();
    });

    it("using one link cancels the account's other links", async () => {
      const first = await createPasswordReset(db, "sam@example.com", NOW);
      const second = await createPasswordReset(db, "sam@example.com", NOW);
      expect((await resetPassword(db, second!.token, "new-password", NOW)).ok).toBe(true);
      expect(await resetPassword(db, first!.token, "other-password", NOW)).toEqual({ ok: false, error: "invalid-token" });
    });
  });

  it("changes the password after checking the current one, keeping only this device signed in", async () => {
    const { token: here } = await createSession(db, userId, NOW);
    const { token: elsewhere } = await createSession(db, userId, NOW);
    expect(await changePassword(db, userId, { current: "wrong", next: "new-password", keepToken: here })).toEqual({
      ok: false,
      error: "wrong-password",
    });
    expect(await changePassword(db, userId, { current: "password1", next: "short", keepToken: here })).toEqual({
      ok: false,
      error: "short-password",
    });
    expect(await changePassword(db, userId, { current: "password1", next: "new-password", keepToken: here })).toEqual({ ok: true });
    expect(await userForSession(db, here, NOW)).toBeDefined();
    expect(await userForSession(db, elsewhere, NOW)).toBeUndefined();
    expect(await checkCredentials(db, "sam@example.com", "new-password")).toBeDefined();
  });

  it("exports the student's data and deletes the account with everything in it", async () => {
    await grantPass(db, { userId, checkoutSessionId: "cs_1", paymentIntentId: "pi_1", amountCents: 3900, currency: "usd", days: 90 }, NOW);
    const data = await exportUserData(db, userId);
    expect(data?.account).toMatchObject({ email: "sam@example.com", name: "Sam" });
    expect(data?.seasonPasses).toHaveLength(1);
    expect(JSON.stringify(data)).not.toContain("scrypt$");

    expect(await deleteAccount(db, userId, "wrong")).toBe(false);
    expect(await deleteAccount(db, userId, "password1")).toBe(true);
    expect(await db.select().from(users)).toHaveLength(0);
    expect(await db.select().from(seasonPasses)).toHaveLength(0);
    expect(await exportUserData(db, userId)).toBeUndefined();
  });

  describe("rate limits", () => {
    const limit = { max: 3, windowMs: 15 * MINUTE };

    it("blocks after the limit and frees up after the window", async () => {
      for (let i = 0; i < 3; i++) {
        expect(await isLimited(db, "k", limit, NOW)).toBe(false);
        await recordHit(db, "k", NOW);
      }
      expect(await isLimited(db, "k", limit, NOW)).toBe(true);
      expect(await isLimited(db, "other", limit, NOW)).toBe(false);
      expect(await isLimited(db, "k", limit, new Date(NOW.getTime() + 16 * MINUTE))).toBe(false);
      await clearHits(db, "k");
      expect(await isLimited(db, "k", limit, NOW)).toBe(false);
    });

    it("consume counts against every key, and nothing when any is full", async () => {
      const small = { max: 1, windowMs: 15 * MINUTE };
      expect(await consume(db, [{ key: "a", limit: small }, { key: "b", limit }], NOW)).toBe(true);
      expect(await consume(db, [{ key: "a", limit: small }, { key: "c", limit }], NOW)).toBe(false);
      expect(await isLimited(db, "c", { max: 1, windowMs: limit.windowMs }, NOW)).toBe(false);
    });
  });
});

describe("email", () => {
  const email = { to: "sam@example.com", subject: "Hi", text: "Body" };

  it("prints the email in development when no provider is set", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchImpl = vi.fn();
    expect(await sendEmail(email, { NODE_ENV: "development" }, fetchImpl)).toEqual({ sent: false, reason: "not-configured" });
    expect(log.mock.calls[0][0]).toContain("Body");
    expect(fetchImpl).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("never prints emails in production", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sendEmail(email, { NODE_ENV: "production" })).toEqual({ sent: false, reason: "not-configured" });
    expect(info).not.toHaveBeenCalled();
    expect(error.mock.calls[0][0]).not.toContain("Body");
    info.mockRestore();
    error.mockRestore();
  });

  it("sends through Resend when configured", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const env = { RESEND_API_KEY: "re_test", EMAIL_FROM: "NextScore <hi@example.com>" };
    expect(await sendEmail(email, env, fetchImpl)).toEqual({ sent: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    expect(JSON.parse(init.body as string)).toEqual({ from: env.EMAIL_FROM, to: ["sam@example.com"], subject: "Hi", text: "Body" });

    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = vi.fn(async () => new Response("bad", { status: 422 }));
    expect(await sendEmail(email, env, failing)).toEqual({ sent: false, reason: "failed" });
    error.mockRestore();
  });

  it("puts the link and expiry in the reset email", () => {
    const e = passwordResetEmail({ name: "Sam", link: "https://x.example/reset-password?token=abc", minutes: 60 });
    expect(e.text).toContain("https://x.example/reset-password?token=abc");
    expect(e.text).toContain("60 minutes");
  });
});

describe("site config", () => {
  it("shows placeholders until the business details are set", () => {
    expect(siteConfig({})).toEqual({ supportEmail: "[support email]", operator: "[business name]", governingLaw: "[state]" });
    expect(siteConfig({ SUPPORT_EMAIL: "help@x.com", LEGAL_OPERATOR_NAME: "X LLC", LEGAL_GOVERNING_STATE: "Texas" })).toEqual({
      supportEmail: "help@x.com",
      operator: "X LLC",
      governingLaw: "Texas",
    });
  });
});

describe("name and email changes", () => {
  let db: Db;
  let close: () => Promise<void>;
  let userId: string;
  beforeEach(async () => {
    ({ db, close } = await openDb("memory://"));
    const r = await createUser(db, { email: "sam@example.com", name: "Sam", password: "password1" });
    if (!r.ok) throw new Error("setup");
    userId = r.user.id;
    await createUser(db, { email: "taken@example.com", name: "Other", password: "password1" });
  });
  afterEach(async () => close());

  it("changes and validates the name", async () => {
    expect(await updateName(db, userId, "  ")).toEqual({ ok: false, error: "missing-name" });
    expect(await updateName(db, userId, "x".repeat(101))).toEqual({ ok: false, error: "long-name" });
    expect(await updateName(db, userId, "  Samantha ")).toEqual({ ok: true });
    expect((await db.select().from(users).where(eq(users.id, userId)))[0].name).toBe("Samantha");
  });

  it("refuses bad email requests", async () => {
    const ask = (newEmail: string, password = "password1") => requestEmailChange(db, userId, { newEmail, password }, NOW);
    expect(await ask("new@example.com", "nope")).toEqual({ ok: false, error: "wrong-password" });
    expect(await ask("not-an-email")).toEqual({ ok: false, error: "invalid-email" });
    expect(await ask(" SAM@example.com ")).toEqual({ ok: false, error: "same-email" });
    expect(await ask("Taken@example.com")).toEqual({ ok: false, error: "email-taken" });
  });

  it("changes the email only after the link is used, once", async () => {
    const req = await requestEmailChange(db, userId, { newEmail: " New@Example.com ", password: "password1" }, NOW);
    if (!req.ok) throw new Error("request");
    expect((await db.select().from(users).where(eq(users.id, userId)))[0].email).toBe("sam@example.com");

    const done = await confirmEmailChange(db, req.token, NOW);
    expect(done).toMatchObject({ ok: true, oldEmail: "sam@example.com", user: { email: "new@example.com" } });
    expect(await checkCredentials(db, "new@example.com", "password1")).toMatchObject({ id: userId });
    expect(await confirmEmailChange(db, req.token, NOW)).toEqual({ ok: false, error: "invalid-token" });
  });

  it("rejects expired links and replaced requests", async () => {
    const first = await requestEmailChange(db, userId, { newEmail: "a@example.com", password: "password1" }, NOW);
    const second = await requestEmailChange(db, userId, { newEmail: "b@example.com", password: "password1" }, NOW);
    if (!first.ok || !second.ok) throw new Error("request");
    expect(await confirmEmailChange(db, first.token, NOW)).toEqual({ ok: false, error: "invalid-token" });
    const late = new Date(NOW.getTime() + (EMAIL_CHANGE_MINUTES + 1) * MINUTE);
    expect(await confirmEmailChange(db, second.token, late)).toEqual({ ok: false, error: "invalid-token" });
  });

  it("won't take an address registered after the request", async () => {
    const req = await requestEmailChange(db, userId, { newEmail: "late@example.com", password: "password1" }, NOW);
    if (!req.ok) throw new Error("request");
    await createUser(db, { email: "late@example.com", name: "Late", password: "password1" });
    expect(await confirmEmailChange(db, req.token, NOW)).toEqual({ ok: false, error: "email-taken" });
  });
});
