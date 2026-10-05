/**
 * Season pass terms. The plans are fixed in code; the currency and free practice
 * come from environment variables (see .env.example). Passes already bought keep
 * the length they were sold with.
 */
export interface PassPlan {
  id: string;
  /** How long this pass lasts. */
  days: number;
  /** What the student pays, in the smallest currency unit (cents). */
  priceCents: number;
  /** The "was" price shown crossed out next to the real one. */
  listPriceCents: number;
}

/** Every pass is 40% off its list price. Shorter passes cost a little more per day. */
export const PASS_PLANS: readonly PassPlan[] = [
  { id: "30d", days: 30, priceCents: 1200, listPriceCents: 2000 },
  { id: "60d", days: 60, priceCents: 2100, listPriceCents: 3500 },
  { id: "90d", days: 90, priceCents: 3000, listPriceCents: 5000 },
];

export const BEST_VALUE_PLAN_ID = "90d";

export function findPlan(id: string | undefined): PassPlan | undefined {
  return PASS_PLANS.find((p) => p.id === id);
}

export function percentOff(plan: PassPlan): number {
  return Math.round((1 - plan.priceCents / plan.listPriceCents) * 100);
}

export interface PassConfig {
  currency: string;
  /** Practice sets a student can start before buying a pass. */
  freeSets: number;
  /** Full-length practice tests a student can take before buying a pass. */
  freeTests: number;
}

export const DEFAULT_PASS_CONFIG: PassConfig = { currency: "usd", freeSets: 1, freeTests: 0 };

function intFrom(value: string | undefined, fallback: number, min: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min) throw new Error(`Invalid season pass setting: ${value}`);
  return n;
}

export function passConfig(env: Record<string, string | undefined> = process.env): PassConfig {
  const currency = (env.SEASON_PASS_CURRENCY || DEFAULT_PASS_CONFIG.currency).toLowerCase();
  if (!/^[a-z]{3}$/.test(currency)) throw new Error(`Invalid SEASON_PASS_CURRENCY: ${currency}`);
  return {
    currency,
    freeSets: intFrom(env.FREE_PRACTICE_SETS, DEFAULT_PASS_CONFIG.freeSets, 0),
    freeTests: intFrom(env.FREE_PRACTICE_TESTS, DEFAULT_PASS_CONFIG.freeTests, 0),
  };
}

/** "$30.00" */
export function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

/** "$30" for whole-dollar prices, "$12.50" otherwise. */
export function formatPriceShort(cents: number, currency: string): string {
  return formatPrice(cents, currency).replace(/\.00$/, "");
}
