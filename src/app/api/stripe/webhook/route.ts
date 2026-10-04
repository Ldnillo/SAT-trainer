import type Stripe from "stripe";
import { getDb } from "@/lib/db/client";
import { getStripe, handleStripeEvent } from "@/lib/billing/stripe";

/**
 * Stripe webhook. Point a Stripe webhook endpoint at /api/stripe/webhook with
 * the events checkout.session.completed, checkout.session.async_payment_succeeded
 * and charge.refunded, and put its signing secret in STRIPE_WEBHOOK_SECRET.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !process.env.STRIPE_SECRET_KEY) return new Response("Payments are not configured", { status: 503 });
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  await handleStripeEvent(await getDb(), event);
  return Response.json({ received: true });
}
