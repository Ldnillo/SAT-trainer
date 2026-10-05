import { REFUND_DAYS, siteConfig } from "../site";

export function passwordResetEmail(input: { name: string; link: string; minutes: number }) {
  const { supportEmail } = siteConfig();
  return {
    subject: "Reset your NextScore password",
    text: `Hi ${input.name},

Someone (hopefully you) asked to reset the password for your NextScore account. To choose a new password, open this link:

${input.link}

The link works once and expires in ${input.minutes} minutes. If you didn't ask for this, you can ignore this email; your password won't change.

Questions? Write to ${supportEmail}.

NextScore`,
  };
}

export function passwordChangedEmail(input: { name: string }) {
  const { supportEmail } = siteConfig();
  return {
    subject: "Your NextScore password was changed",
    text: `Hi ${input.name},

The password for your NextScore account was just changed, and you were signed out on your other devices.

If this wasn't you, reset your password right away from the sign-in page ("Forgot your password?") and write to ${supportEmail}.

NextScore`,
  };
}

const DATE = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" });

export function receiptEmail(input: { name: string; amount: string; days: number; startsAt: Date; expiresAt: Date; passUrl: string }) {
  const { supportEmail } = siteConfig();
  const later = input.startsAt.getTime() > Date.now();
  return {
    subject: "Your NextScore receipt",
    text: `Hi ${input.name},

Thanks for buying a NextScore season pass. Here is your receipt:

Season pass, ${input.days} days: ${input.amount}
Access ${later ? "starts" : "started"}: ${DATE.format(input.startsAt)}
Access ends: ${DATE.format(input.expiresAt)}

It is a one-time payment, so it won't renew on its own. We'll send you a reminder before it ends.

If you haven't answered any practice questions, you can ask for a full refund within ${REFUND_DAYS} days of buying. Write to ${supportEmail}.

Your pass: ${input.passUrl}

NextScore`,
  };
}

export function passEndingEmail(input: { name: string; expiresAt: Date; passUrl: string }) {
  const { supportEmail } = siteConfig();
  return {
    subject: "Your NextScore season pass ends soon",
    text: `Hi ${input.name},

Your NextScore season pass ends on ${DATE.format(input.expiresAt)}. After that, your progress and scores stay in your account, but new practice needs a pass.

To keep practicing without a gap, you can buy another pass now. It starts when this one ends, so you don't lose any days:

${input.passUrl}

Questions? Write to ${supportEmail}.

NextScore`,
  };
}
