import type { Metadata } from "next";
import Link from "next/link";
import { formatPrice, passConfig } from "@/lib/billing/config";
import { LEGAL_UPDATED, REFUND_DAYS, siteConfig } from "@/lib/site";
import styles from "../legal.module.css";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  const { supportEmail, operator, governingLaw } = siteConfig();
  const config = passConfig();
  const price = formatPrice(config.priceCents, config.currency);
  const mail = <a href={`mailto:${supportEmail}`}>{supportEmail}</a>;

  return (
    <main className={styles.page}>
      <h1>Terms of Service</h1>
      <p className={styles.updated}>Last updated {LEGAL_UPDATED}</p>

      <div className={styles.summary}>
        <p>
          <strong>The short version:</strong> NextScore is SAT practice, not the SAT. A season pass is one payment for{" "}
          {config.days} days of access, it never renews on its own, and you can get a full refund within {REFUND_DAYS}{" "}
          days of buying. Keep your account to yourself and don&apos;t copy our questions.
        </p>
      </div>

      <p>
        These terms are an agreement between you and {operator} (&quot;NextScore&quot;, &quot;we&quot;, &quot;us&quot;)
        for using the NextScore website. By creating an account or buying a season pass, you agree to them and to our{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>1. Who can use NextScore</h2>
      <p>
        You must be at least 13 years old to create an account. If you are under 18, you confirm that your parent or
        legal guardian has read and agreed to these terms for you, and a parent or guardian should make or approve any
        purchase. Parents and guardians who allow a student to use NextScore are responsible for that use.
      </p>

      <h2>2. Your account</h2>
      <p>
        Give accurate details when you sign up, and keep your password private. Each account is for one student; don&apos;t
        share it or let others practice on it, because your skill levels and score estimates are built from your own
        answers. Tell us at {mail} if you think someone else has used your account.
      </p>

      <h2>3. Free practice and season passes</h2>
      <ul>
        {config.freeSets > 0 && (
          <li>
            New accounts can try {config.freeSets} free practice {config.freeSets === 1 ? "set" : "sets"} without paying.
          </li>
        )}
        <li>
          A season pass costs {price} (plus any tax shown at checkout), paid once. It gives unlimited practice for{" "}
          {config.days} days from purchase. The price shown at checkout is the price you pay.
        </li>
        <li>
          <strong>No subscription:</strong> a pass never renews or charges you again. If you buy another pass while one
          is active, the new one starts when the current one ends.
        </li>
        <li>
          When a pass ends you can no longer start new practice sets, but your progress and past results stay in your
          account.
        </li>
        <li>Payments are processed by Stripe under its own terms. We don&apos;t receive or store your card details.</li>
        <li>We may change the price of future passes. A change never affects a pass you have already bought.</li>
      </ul>

      <h2 id="refunds">4. Refunds</h2>
      <p>
        If NextScore isn&apos;t right for you, write to {mail} within {REFUND_DAYS} days of buying a pass and we will
        refund it in full, no questions asked. After {REFUND_DAYS} days, passes are not refundable except where the law
        requires it, or where a problem on our side kept you from using NextScore. A refunded pass ends when the refund is
        made. Nothing in these terms limits any refund rights you have under the law where you live.
      </p>

      <h2>5. Not affiliated with the College Board</h2>
      <p>
        SAT® is a trademark registered by the College Board, which is not affiliated with, and does not endorse,
        NextScore. Our questions are original practice questions written in the style of the digital SAT; they are not
        real or past SAT questions.
      </p>

      <h2>6. Score estimates are a guide</h2>
      <p>
        Estimated scores and skill levels are our best estimate from your practice answers. They are meant to help you
        decide what to practice, and are not a prediction or guarantee of any official test score. How you do on the SAT
        depends on many things outside our control.
      </p>

      <h2>7. Our content</h2>
      <p>
        The questions, explanations, passages, software and design of NextScore belong to us (or are used with
        permission or from the public domain) and are protected by copyright. Your pass lets you use them for your own
        personal study. You may not copy, publish, sell or share our questions or explanations, or collect them with
        bots, scrapers or other automated tools, including to train AI models.
      </p>

      <h2>8. Acceptable use</h2>
      <p>
        Don&apos;t misuse NextScore: don&apos;t try to get into other people&apos;s accounts or parts of the site you
        aren&apos;t allowed to use, interfere with how it runs, get around the season pass, or use it to break the law.
      </p>

      <h2>9. Ending your account</h2>
      <p>
        You can delete your account at any time from your <Link href="/account">account page</Link>. We may suspend or
        close an account that breaks these terms; if we close an account without the user breaking these terms, we will
        refund the unused part of any active pass.
      </p>

      <h2>10. Changes to NextScore and these terms</h2>
      <p>
        We keep improving NextScore, so questions and features may change. We may update these terms; we will change the
        date at the top and, for changes that matter, tell you by email or on the site before they take effect. Using
        NextScore after that means you accept the new terms.
      </p>

      <h2>11. Disclaimers</h2>
      <p>
        We work hard to make our questions and explanations accurate, but NextScore is provided &quot;as is&quot;, and we
        can&apos;t promise it will always be available, error-free, or lead to a particular score. If you find a mistake in
        a question, please tell us at {mail}.
      </p>

      <h2>12. Limit on our liability</h2>
      <p>
        To the extent the law allows, we are not liable for indirect or consequential losses, and our total liability to
        you for any claim about NextScore is limited to the amount you paid us in the 12 months before the claim. Some
        places don&apos;t allow these limits, so they may not apply to you.
      </p>

      <h2>13. Governing law</h2>
      <p>
        These terms are governed by the laws of {governingLaw}, United States, except where the law where you live says
        otherwise. Before starting any legal claim, please write to {mail} so we can try to fix the problem.
      </p>

      <h2>14. Contact</h2>
      <p>Questions about these terms, refunds or your account: {mail}.</p>
    </main>
  );
}
