import { notFound } from "next/navigation";
import { normalizeEmail, type User } from "./accounts";
import { currentUser } from "./session";

/**
 * Whether an email may open the staff pages (/admin/reports). Staff are the
 * addresses listed in ADMIN_EMAILS, comma-separated. When ADMIN_EMAILS isn't
 * set, any signed-in account counts in development and none in production.
 */
export function isAdminEmail(email: string, env: { ADMIN_EMAILS?: string; NODE_ENV?: string } = process.env): boolean {
  const list = (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);
  if (!list.length) return env.NODE_ENV !== "production";
  return list.includes(normalizeEmail(email));
}

/** The signed-in staff member; anyone else gets a 404, so the page doesn't reveal it exists. */
export async function requireAdmin(): Promise<User> {
  const user = await currentUser();
  if (!user || !isAdminEmail(user.email)) notFound();
  return user;
}
