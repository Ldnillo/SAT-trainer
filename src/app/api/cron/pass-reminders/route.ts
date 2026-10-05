import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db/client";
import { sendPassReminders } from "@/lib/billing/notify";

/**
 * Sends the "your pass ends soon" emails. Run it once a day: vercel.json schedules it
 * on Vercel (which sends CRON_SECRET as a bearer token); elsewhere call it from any
 * scheduler with the header "Authorization: Bearer <CRON_SECRET>".
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("CRON_SECRET is not set", { status: 503 });
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const wanted = Buffer.from(`Bearer ${secret}`);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return new Response("Unauthorized", { status: 401 });
  return Response.json(await sendPassReminders(await getDb()));
}
