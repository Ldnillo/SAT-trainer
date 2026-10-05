import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { users } from "../db/schema";

/** Daily goal choices, in questions answered per day. */
export const GOAL_CHOICES = [5, 10, 20, 30] as const;
export const DEFAULT_DAILY_GOAL = 10;

export function parseGoal(value: unknown): number | undefined {
  const n = Number(value);
  return (GOAL_CHOICES as readonly number[]).includes(n) ? n : undefined;
}

/** The calendar day (YYYY-MM-DD) a moment falls on in a time zone. */
export function dayKey(at: Date, timeZone: string): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** The day `n` days after (or before, for negative n) a YYYY-MM-DD day. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export interface DayProgress {
  day: string;
  answered: number;
  goalMet: boolean;
}

export interface DailyProgress {
  goal: number;
  /** Questions answered today. */
  today: number;
  goalMet: boolean;
  /** Days in a row with at least one answer, ending today, or yesterday if nothing is answered yet today. */
  streak: number;
  /** True when the streak ends yesterday: one answer today keeps it going. */
  streakAtRisk: boolean;
  longestStreak: number;
  /** The last 7 days, oldest first, ending today. */
  week: DayProgress[];
}

/**
 * Today's progress toward the daily goal and the practice streak, from the
 * student's answers (practice sets and practice tests both count).
 */
export function dailyProgress(answers: { createdAt: Date }[], goal: number, now: Date, timeZone: string): DailyProgress {
  const counts = new Map<string, number>();
  for (const a of answers) {
    const day = dayKey(a.createdAt, timeZone);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  const today = dayKey(now, timeZone);
  const answeredToday = counts.get(today) ?? 0;

  let streak = 0;
  let day = answeredToday > 0 ? today : addDays(today, -1);
  while (counts.has(day)) {
    streak++;
    day = addDays(day, -1);
  }

  let longestStreak = 0;
  for (const d of counts.keys()) {
    if (counts.has(addDays(d, -1))) continue; // not the first day of a run
    let length = 0;
    while (counts.has(addDays(d, length))) length++;
    longestStreak = Math.max(longestStreak, length);
  }

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i - 6);
    const answered = counts.get(d) ?? 0;
    return { day: d, answered, goalMet: answered >= goal };
  });

  return {
    goal,
    today: answeredToday,
    goalMet: answeredToday >= goal,
    streak,
    streakAtRisk: streak > 0 && answeredToday === 0,
    longestStreak,
    week,
  };
}

export async function loadDailyGoal(db: Db, userId: string): Promise<number> {
  const [row] = await db.select({ dailyGoal: users.dailyGoal }).from(users).where(eq(users.id, userId));
  return row?.dailyGoal ?? DEFAULT_DAILY_GOAL;
}

export async function saveDailyGoal(db: Db, userId: string, goal: number): Promise<void> {
  await db.update(users).set({ dailyGoal: goal }).where(eq(users.id, userId));
}
