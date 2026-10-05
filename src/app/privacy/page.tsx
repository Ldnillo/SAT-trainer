import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_UPDATED, siteConfig } from "@/lib/site";
import styles from "../legal.module.css";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  const { supportEmail, operator } = siteConfig();
  const mail = <a href={`mailto:${supportEmail}`}>{supportEmail}</a>;

  return (
    <main className={styles.page}>
      <h1>Privacy Policy</h1>
      <p className={styles.updated}>Last updated {LEGAL_UPDATED}</p>

      <div className={styles.summary}>
        <p>
          <strong>The short version:</strong> we collect only what we need to run your practice: your name, email,
          password (stored scrambled) and your answers. We don&apos;t sell your data, show ads or use tracking cookies.
          Payments go through Stripe, so we never see your card number. You can download or delete your data at any time
          from your <Link href="/settings/account">account settings</Link>.
        </p>
      </div>

      <h2>Who we are</h2>
      <p>
        NextScore is a digital SAT practice website run by {operator} (&quot;we&quot;, &quot;us&quot;). This policy
        explains what information we collect when you use NextScore, how we use it, and the choices you have. Questions
        about it can be sent to {mail}.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> your name, email address and password. Passwords are stored only as a
          one-way scrambled form (a hash), so nobody at NextScore can read them.
        </li>
        <li>
          <strong>Practice activity:</strong> the practice sets and practice tests you take, each answer you give, whether it was right,
          and when. We use these to work out your skill levels and estimated scores.
        </li>
        <li>
          <strong>Season pass purchases:</strong> the date, length, amount and Stripe reference of each pass. Card and
          billing details are entered on Stripe&apos;s own checkout page and are handled by Stripe, not stored by us.
        </li>
        <li>
          <strong>Sign-in and security records:</strong> a sign-in cookie that keeps you signed in, password reset
          requests, and short-lived records of sign-in attempts by email and network (IP) address, which we use to block
          password guessing. Attempt records are deleted within a day.
        </li>
        <li>
          <strong>Your consent:</strong> the time you agreed to our terms and confirmed you are 13 or older.
        </li>
        <li>
          <strong>Messages you send us,</strong> for example support or refund requests, and problems you report on a question.
        </li>
      </ul>
      <p>
        We don&apos;t ask for your school, grade, address, phone number, test scores from other sources, or date of
        birth.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To run your account and sign you in.</li>
        <li>To choose your practice questions, track your skills and show your progress.</li>
        <li>To process season pass purchases and refunds.</li>
        <li>To send emails you need, such as password reset links and notices that your password changed.</li>
        <li>To keep NextScore secure and to fix problems.</li>
        <li>To improve our questions, for example by finding questions that are too hard or unclear, using combined answer statistics.</li>
      </ul>
      <p>
        We don&apos;t sell or rent your personal information, share it for advertising, or send marketing emails. We
        don&apos;t use your information to train AI models.
      </p>

      <h2>Cookies</h2>
      <p>
        NextScore uses one cookie, which keeps you signed in. It is needed for the site to work. We don&apos;t use
        advertising, analytics or other tracking cookies. Stripe sets its own cookies on its checkout page to prevent
        fraud; see Stripe&apos;s privacy policy.
      </p>

      <h2>Who we share it with</h2>
      <p>We share information only with service providers that help us run NextScore, and only what each one needs:</p>
      <ul>
        <li>
          <strong>Stripe</strong>, which processes payments. It receives your email address and the payment details you
          enter on its checkout page.
        </li>
        <li>
          <strong>Our email provider</strong>, which delivers account emails. It receives your name and email address.
        </li>
        <li>
          <strong>Our hosting and database providers</strong>, which store the site and its data on our behalf.
        </li>
      </ul>
      <p>
        We may also disclose information if the law requires it, to protect the safety or rights of our users or others,
        or as part of a sale or transfer of NextScore, in which case this policy continues to apply to your information.
      </p>

      <h2>Students under 18</h2>
      <p>
        NextScore is for students preparing for the SAT, many of whom are under 18. You must be 13 or older to create an
        account. We don&apos;t knowingly collect personal information from children under 13. If you believe a child
        under 13 has created an account, write to {mail} and we will delete it. Parents and guardians of students under
        18 may ask us to show, download or delete their child&apos;s information at the same address.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your account and practice history for as long as your account exists, so your progress is there when you
        come back. When you delete your account, your account details, practice history and pass records are deleted
        from our database straight away; copies in backups are overwritten in the normal course of operation. Stripe keeps
        payment records as financial law requires.
      </p>

      <h2>Your choices and rights</h2>
      <ul>
        <li>
          <strong>See and download your data:</strong> use &quot;Download my data&quot; on your{" "}
          <Link href="/settings/account">account settings</Link>.
        </li>
        <li>
          <strong>Delete your account:</strong> use &quot;Delete account&quot; on your account page, or write to us.
        </li>
        <li>
          <strong>Correct your details:</strong> write to {mail}.
        </li>
      </ul>
      <p>
        Depending on where you live (for example California or the European Union), you may have further rights, such as
        to object to or restrict how we use your information, or to complain to a data protection authority. Write to{" "}
        {mail} to use any of them. We will not treat you differently for doing so.
      </p>

      <h2>Security</h2>
      <p>
        We protect your information with encrypted connections (HTTPS), hashed passwords, sign-in cookies that scripts
        can&apos;t read, one-time password reset links that expire after an hour, and limits on repeated sign-in
        attempts. No system is perfectly secure, so please use a password you don&apos;t use anywhere else.
      </p>

      <h2>Where your data is stored</h2>
      <p>NextScore and its service providers store data in the United States.</p>

      <h2>Changes to this policy</h2>
      <p>
        If we change this policy, we will update the date at the top. If a change materially affects how we use your
        information, we will tell you by email or on the site before it takes effect.
      </p>

      <h2>Contact</h2>
      <p>Questions or requests about your privacy: {mail}.</p>
    </main>
  );
}
