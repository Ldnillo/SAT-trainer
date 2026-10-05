/** Cookie holding the browser's time zone, so "today" starts at the student's own midnight. */
export const TIME_ZONE_COOKIE = "tz";

/** A valid IANA time zone name from the cookie, or UTC. */
export function parseTimeZone(value: string | undefined): string {
  if (!value) return "UTC";
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}
