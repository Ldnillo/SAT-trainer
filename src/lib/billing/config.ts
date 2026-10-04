/**
 * Season pass terms. Change them with environment variables (see .env.example);
 * passes already bought keep the length they were sold with.
 */
export interface PassConfig {
  /** Price in the smallest currency unit (cents). */
  priceCents: number;
  currency: string;
  /** How long one pass lasts. */
  days: number;
  /** Practice sets a student can start before buying a pass. */
  freeSets: number;
  /** Full-length practice tests a student can take before buying a pass. */
  freeTests: number;
}

export const DEFAULT_PASS_CONFIG: PassConfig = { priceCents: 3900, currency: "usd", days: 90, freeSets: 1, freeTests: 0 };

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
    // Stripe's minimum charge is about 50 cents.
    priceCents: intFrom(env.SEASON_PASS_PRICE_CENTS, DEFAULT_PASS_CONFIG.priceCents, 50),
    currency,
    days: intFrom(env.SEASON_PASS_DAYS, DEFAULT_PASS_CONFIG.days, 1),
    freeSets: intFrom(env.FREE_PRACTICE_SETS, DEFAULT_PASS_CONFIG.freeSets, 0),
    freeTests: intFrom(env.FREE_PRACTICE_TESTS, DEFAULT_PASS_CONFIG.freeTests, 0),
  };
}

/** "$39.00" */
export function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}
