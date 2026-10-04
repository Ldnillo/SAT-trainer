import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "../db/client";
import { createSession, deleteSession, userForSession, type User } from "./accounts";

const COOKIE = "sat_session";

/** The raw token in the session cookie, if any. */
export async function currentSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE)?.value;
}

/** The signed-in student, or undefined. Usable in pages and server actions. */
export async function currentUser(): Promise<User | undefined> {
  const token = await currentSessionToken();
  if (!token) return undefined;
  return userForSession(await getDb(), token);
}

/** The signed-in student; sends anyone else to the sign-in page. */
export async function requireUser(next?: string): Promise<User> {
  const user = await currentUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}

/** Server actions only: sets the session cookie. */
export async function startSession(userId: string): Promise<void> {
  const { token, expiresAt } = await createSession(await getDb(), userId);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** Server actions only: ends the session and clears the cookie. */
export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await deleteSession(await getDb(), token);
  store.delete(COOKIE);
}
