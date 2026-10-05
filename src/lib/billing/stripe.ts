import Stripe from "stripe";
import type { Db } from "../db/client";
import { passConfig, type PassConfig } from "./config";
import { sendReceipt } from "./notify";
import { grantPass, revokePassForPayment, type SeasonPass } from "./pass";

/** Marks checkout sessions this app created for a season pass. */
const PURPOSE = "season-pass";

let client: Stripe | undefined;

/** True when STRIPE_SECRET_KEY is set. Without it the pass page says payments aren't set up. */
export function paymentsConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  client ??= new Stripe(key);
  return client;
}

/** Parameters for a Checkout session that sells one season pass to this student. */
export function checkoutParams(
  user: { id: string; email: string },
  baseUrl: string,
  config: PassConfig = passConfig(),
): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "payment",
    client_reference_id: user.id,
    customer_email: user.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: config.currency,
          unit_amount: config.priceCents,
          product_data: {
            name: `NextScore season pass (${config.days} days)`,
            description: "Unlimited tailored SAT practice sets and score tracking.",
          },
        },
      },
    ],
    // Stored on the session so a pass keeps the length it was sold with if the setting changes later.
    metadata: { purpose: PURPOSE, userId: user.id, days: String(config.days) },
    success_url: `${baseUrl}/pass?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/pass?canceled=1`,
  };
}

export type FulfillResult =
  | { ok: true; pass: SeasonPass; created: boolean }
  | { ok: false; reason: "not-a-pass" | "unpaid" | "wrong-user" };

/**
 * Grants the pass for a completed Checkout session. Called from the webhook
 * and from the page Stripe returns the student to, whichever comes first;
 * the second call finds the pass already recorded.
 */
export async function fulfillCheckout(db: Db, session: Stripe.Checkout.Session, expectedUserId?: string): Promise<FulfillResult> {
  const meta = session.metadata ?? {};
  const days = Number(meta.days);
  if (meta.purpose !== PURPOSE || !meta.userId || !Number.isInteger(days) || days < 1) return { ok: false, reason: "not-a-pass" };
  if (session.client_reference_id !== meta.userId) return { ok: false, reason: "not-a-pass" };
  if (expectedUserId && meta.userId !== expectedUserId) return { ok: false, reason: "wrong-user" };
  if (session.payment_status !== "paid") return { ok: false, reason: "unpaid" };

  const paymentIntent = session.payment_intent;
  const result = await grantPass(db, {
    userId: meta.userId,
    checkoutSessionId: session.id,
    paymentIntentId: typeof paymentIntent === "string" ? paymentIntent : (paymentIntent?.id ?? null),
    amountCents: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
    days,
  });
  // Only the call that created the pass sends the receipt, so the webhook and return page don't both email.
  if (result.created) await sendReceipt(db, result.pass);
  return { ok: true, ...result };
}

/** Applies a verified webhook event. Unrelated events are ignored. */
export async function handleStripeEvent(db: Db, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await fulfillCheckout(db, event.data.object);
      break;
    case "charge.refunded": {
      const charge = event.data.object;
      const intent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      // Partial refunds (a goodwill discount, say) leave the pass in place.
      if (intent && charge.refunded) await revokePassForPayment(db, intent);
      break;
    }
  }
}
