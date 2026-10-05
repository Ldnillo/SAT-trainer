import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createUser, exportUserData } from "../src/lib/auth/accounts";
import { openDb, type Db } from "../src/lib/db/client";
import { parseTimeZone } from "../src/lib/time-zone";
import { addDays, dailyProgress, dayKey, loadDailyGoal, parseGoal, saveDailyGoal } from "../src/lib/trainer/streak";

const at = (iso: string) => ({ createdAt: new Date(iso) });

describe("daily goal and streak", () => {
  const now = new Date("2026-03-10T15:00:00Z");

  it("counts today's answers toward the goal", () => {
    const p = dailyProgress([at("2026-03-10T09:00:00Z"), at("2026-03-10T10:00:00Z"), at("2026-03-09T10:00:00Z")], 5, now, "UTC");
    expect(p.today).toBe(2);
    expect(p.goalMet).toBe(false);
    expect(dailyProgress(Array.from({ length: 5 }, () => at("2026-03-10T09:00:00Z")), 5, now, "UTC").goalMet).toBe(true);
  });

  it("counts days in a row, ending today or yesterday", () => {
    const days = ["2026-03-07", "2026-03-08", "2026-03-09"].map((d) => at(`${d}T12:00:00Z`));
    const yesterday = dailyProgress(days, 10, now, "UTC");
    expect(yesterday.streak).toBe(3);
    expect(yesterday.streakAtRisk).toBe(true);

    const today = dailyProgress([...days, at("2026-03-10T08:00:00Z")], 10, now, "UTC");
    expect(today.streak).toBe(4);
    expect(today.streakAtRisk).toBe(false);
  });

  it("resets after a missed day but remembers the longest run", () => {
    const p = dailyProgress(
      ["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-08", "2026-03-10"].map((d) => at(`${d}T12:00:00Z`)),
      10,
      now,
      "UTC",
    );
    expect(p.streak).toBe(1);
    expect(p.longestStreak).toBe(4);
    expect(dailyProgress([], 10, now, "UTC")).toMatchObject({ streak: 0, longestStreak: 0, streakAtRisk: false });
  });

  it("uses the student's own midnight", () => {
    // 02:00 UTC on March 10 is still the evening of March 9 in New York.
    const late = at("2026-03-10T02:00:00Z");
    expect(dailyProgress([late], 10, now, "UTC").today).toBe(1);
    const ny = dailyProgress([late], 10, now, "America/New_York");
    expect(ny.today).toBe(0);
    expect(ny.streak).toBe(1);
    expect(dayKey(late.createdAt, "America/New_York")).toBe("2026-03-09");
  });

  it("shows the last seven days ending today", () => {
    const p = dailyProgress([at("2026-03-04T12:00:00Z"), ...Array.from({ length: 3 }, () => at("2026-03-08T12:00:00Z"))], 3, now, "UTC");
    expect(p.week.map((d) => d.day)).toEqual(["2026-03-04", "2026-03-05", "2026-03-06", "2026-03-07", "2026-03-08", "2026-03-09", "2026-03-10"]);
    expect(p.week[0]).toMatchObject({ answered: 1, goalMet: false });
    expect(p.week[4]).toMatchObject({ answered: 3, goalMet: true });
  });

  it("parses goals, days and time zones safely", () => {
    expect(parseGoal("20")).toBe(20);
    expect(parseGoal("7")).toBeUndefined();
    expect(parseGoal(null)).toBeUndefined();
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(parseTimeZone("Europe/London")).toBe("Europe/London");
    expect(parseTimeZone("Not/AZone")).toBe("UTC");
    expect(parseTimeZone(undefined)).toBe("UTC");
  });
});

describe("saved daily goal", () => {
  let db: Db;
  let close: () => Promise<void>;

  beforeEach(async () => {
    ({ db, close } = await openDb("memory://"));
  });
  afterEach(async () => close());

  it("defaults to 10 and can be changed", async () => {
    const created = await createUser(db, { email: "goal@example.com", name: "Goal", password: "correct horse battery" });
    if (!created.ok) throw new Error(created.error);
    expect(await loadDailyGoal(db, created.user.id)).toBe(10);
    await saveDailyGoal(db, created.user.id, 20);
    expect(await loadDailyGoal(db, created.user.id)).toBe(20);
    expect((await exportUserData(db, created.user.id))?.account.dailyGoal).toBe(20);
  });
});
