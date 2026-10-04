import { requireUser } from "@/lib/auth/session";
import { formatPrice, passConfig } from "@/lib/billing/config";
import { practiceAccess } from "@/lib/billing/pass";
import { fulfillCheckout, getStripe, paymentsConfigured } from "@/lib/billing/stripe";
import { getDb } from "@/lib/db/client";
import { buyPass } from "./actions";
import styles from "./pass.module.css";

const dateFormat: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" };

export default async function PassPage({ searchParams }: PageProps<"/pass">) {
  const params = await searchParams;
  const user = await requireUser("/pass");
  const db = await getDb();
  const config = passConfig();

  // Back from Stripe Checkout: record the pass now rather than waiting for the webhook.
  let notice: string | undefined;
  const sessionId = typeof params.session_id === "string" ? params.session_id : undefined;
  if (sessionId && paymentsConfigured() && /^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    try {
      const result = await fulfillCheckout(db, await getStripe().checkout.sessions.retrieve(sessionId), user.id);
      notice = result.ok
        ? "Payment received. Your season pass is active."
        : result.reason === "unpaid"
          ? "Your payment is still processing. Your pass will turn on as soon as it clears."
          : undefined;
    } catch {
      notice = "We couldn't confirm that payment yet. If you were charged, your pass will turn on shortly.";
    }
  }

  const access = await practiceAccess(db, user.id);
  const price = formatPrice(config.priceCents, config.currency);

  return (
    <main>
      <h1>Season pass</h1>
      {notice && <p className={styles.notice}>{notice}</p>}
      {params.canceled && <p className={styles.muted}>Checkout was canceled. You haven&apos;t been charged.</p>}
      {params.required && !access.allowed && (
        <p className={styles.notice}>You&apos;ve used your free practice. Get a season pass to keep practicing.</p>
      )}
      {params.error === "not-configured" && <p className={styles.error}>Payments aren&apos;t set up on this site yet.</p>}
      {params.error === "checkout" && <p className={styles.error}>We couldn&apos;t start checkout. Please try again.</p>}

      {access.pass.active ? (
        <p>
          Your pass is active until <strong>{access.pass.activeUntil!.toLocaleDateString("en-US", dateFormat)}</strong>.
        </p>
      ) : (
        <p>
          {access.freeSetsLeft > 0
            ? `You have ${access.freeSetsLeft} free practice ${access.freeSetsLeft === 1 ? "set" : "sets"} left.`
            : "You don't have a season pass."}
        </p>
      )}

      <div className={styles.card}>
        <div className={styles.price}>{price}</div>
        <div className={styles.muted}>one payment, {config.days} days of access, no subscription</div>
        <ul>
          <li>Unlimited tailored practice sets across all 30 SAT skills</li>
          <li>Skill mastery tracking and estimated section scores</li>
          <li>Explanations for every answer</li>
        </ul>
        <form action={buyPass}>
          <button type="submit" className="button" disabled={!paymentsConfigured()}>
            {access.pass.active ? `Add ${config.days} more days for ${price}` : `Buy season pass for ${price}`}
          </button>
        </form>
        <p className={styles.muted}>Payments are handled securely by Stripe. Buying while a pass is active adds the days on after it ends.</p>
      </div>
    </main>
  );
}
