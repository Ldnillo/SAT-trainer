"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { checkoutParams, getStripe, paymentsConfigured } from "@/lib/billing/stripe";
import { baseUrl } from "@/lib/request";

export async function buyPass() {
  const user = await requireUser("/pass");
  if (!paymentsConfigured()) redirect("/pass?error=not-configured");
  const session = await getStripe().checkout.sessions.create(checkoutParams(user, await baseUrl()));
  if (!session.url) redirect("/pass?error=checkout");
  redirect(session.url);
}
