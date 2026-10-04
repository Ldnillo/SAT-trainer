"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { checkoutParams, getStripe, paymentsConfigured } from "@/lib/billing/stripe";

/** The site's own address, for Stripe to send students back to. APP_URL wins when set. */
async function baseUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function buyPass() {
  const user = await requireUser("/pass");
  if (!paymentsConfigured()) redirect("/pass?error=not-configured");
  const session = await getStripe().checkout.sessions.create(checkoutParams(user, await baseUrl()));
  if (!session.url) redirect("/pass?error=checkout");
  redirect(session.url);
}
