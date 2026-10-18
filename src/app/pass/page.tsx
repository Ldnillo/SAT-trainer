import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { BEST_VALUE_PLAN_ID, formatPriceShort, PASS_PLANS, passConfig } from "@/lib/billing/config";
import { practiceAccess } from "@/lib/billing/pass";
import { fulfillCheckout, getStripe, paymentsConfigured } from "@/lib/billing/stripe";
import { getDb } from "@/lib/db/client";
import { unfinishedPracticeSet } from "@/lib/trainer/practice";
import { buyPass } from "./actions";
import styles from "./pass.module.css";

const dateFormat: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" };

export const metadata: Metadata = { title: "Season pass" };

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

  const [access, unfinished] = await Promise.all([practiceAccess(db, user.id), unfinishedPracticeSet(db, user.id)]);

  return (
    <main className={styles.page}>
      <div className={styles.intro}>
        <p className="eyebrow">Season pass</p>
        <h1 className={styles.title}>Unlimited practice for the whole season</h1>
        {notice && (
          <div className="notice ok">
            <p>{notice}</p>
            <Link href="/dashboard" className="button small">
              Start practicing
            </Link>
          </div>
        )}
        {params.canceled && <p className="notice info">Checkout was canceled. You haven&apos;t been charged.</p>}
        {params.required === "test" && !access.pass.active ? (
          <p className="notice warn">Full-length practice tests come with the season pass.</p>
        ) : (
          params.required &&
          !access.allowed && (
            <p className="notice warn">You&apos;ve used your free practice. Get a season pass to keep practicing.</p>
          )
        )}
        {unfinished && !access.pass.active && (
          <div className="notice info">
            <p>
              You still have a practice set in progress. You can finish it any time, with or without a pass.
            </p>
            <Link href={`/practice/${unfinished.id}`} className="button small">
              Finish your set
            </Link>
          </div>
        )}
        {(params.error === "not-configured" || !paymentsConfigured()) && (
          <p className="notice bad">Payments aren&apos;t set up on this site yet, so passes can&apos;t be bought right now.</p>
        )}
        {params.error === "checkout" && <p className="notice bad">We couldn&apos;t start checkout. Please try again.</p>}

        <p className={styles.status}>
          {access.pass.active ? (
            <>
              <span className="badge ok">Active</span> Your pass runs until{" "}
              <strong>{access.pass.activeUntil!.toLocaleDateString("en-US", dateFormat)}</strong>.
            </>
          ) : access.freeSetsLeft > 0 ? (
            <>
              <span className="badge accent">Free</span> You have {access.freeSetsLeft} free practice{" "}
              {access.freeSetsLeft === 1 ? "set" : "sets"} left.
            </>
          ) : (
            <>
              <span className="badge">No pass</span> You don&apos;t have a season pass yet.
            </>
          )}
        </p>
        <ul className="check-list">
          <li>Unlimited tailored practice sets across all 30 SAT skills</li>
          <li>Full-length timed practice tests with adaptive second modules</li>
          <li>Skill mastery tracking and estimated section scores</li>
          <li>Explanations for every answer</li>
        </ul>
      </div>

      <div className={styles.plans}>
        {PASS_PLANS.map((plan) => (
          <form key={plan.id} action={buyPass} className={`${styles.card} ${plan.id === BEST_VALUE_PLAN_ID ? styles.best : ""} surface`}>
            <input type="hidden" name="plan" value={plan.id} />
            <div className={styles.planHead}>
              <span className={styles.days}>{plan.days} days</span>
              <span className="badge ok">Launch price</span>
              {plan.id === BEST_VALUE_PLAN_ID && <span className="badge accent">Best value</span>}
            </div>
            <div className={styles.priceRow}>
              <span className={styles.price}>{formatPriceShort(plan.priceCents, config.currency)}</span>
            </div>
            <div className={styles.terms}>One payment. No subscription. Prices go up after launch.</div>
            <button type="submit" className="button large" disabled={!paymentsConfigured()}>
              {access.pass.active ? `Add ${plan.days} more days` : `Get ${plan.days} days`}
            </button>
          </form>
        ))}
        <p className={styles.muted}>
          Payments are handled securely by Stripe. Buying while a pass is active adds the days on after it ends.
        </p>
        <p className={styles.muted}>
          By buying you agree to the <Link href="/terms">Terms of Service</Link>, including the{" "}
          <Link href="/terms#refunds">refund policy</Link>. If you&apos;re under 18, ask a parent or guardian before buying.
        </p>
      </div>
    </main>
  );
}
