"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { findPlan } from "@/lib/billing/config";
import { checkoutParams, getStripe, paymentsConfigured } from "@/lib/billing/stripe";
import { baseUrl } from "@/lib/request";

export async function buyPass(formData: FormData) {
  const plan = findPlan(String(formData.get("plan") ?? ""));
  const user = await requireUser("/pass");
  if (!plan) redirect("/pass?error=checkout");
  if (!paymentsConfigured()) redirect("/pass?error=not-configured");
  const session = await getStripe().checkout.sessions.create(checkoutParams(user, await baseUrl(), plan));
  if (!session.url) redirect("/pass?error=checkout");
  redirect(session.url);
}
