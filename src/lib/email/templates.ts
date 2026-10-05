import { siteConfig } from "../site";

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

export function emailChangeConfirmEmail(input: { name: string; link: string; minutes: number }) {
  const { supportEmail } = siteConfig();
  return {
    subject: "Confirm your new NextScore email",
    text: `Hi ${input.name},

You asked to use this address for your NextScore account. To confirm, open this link:

${input.link}

The link works once and expires in ${input.minutes} minutes. If you didn't ask for this, ignore this email; nothing will change.

Questions? Write to ${supportEmail}.

NextScore`,
  };
}

export function emailChangedEmail(input: { name: string; newEmail: string }) {
  const { supportEmail } = siteConfig();
  return {
    subject: "Your NextScore email was changed",
    text: `Hi ${input.name},

The email for your NextScore account was just changed to ${input.newEmail}. You'll sign in with the new address from now on.

If this wasn't you, reset your password right away and write to ${supportEmail}.

NextScore`,
  };
}
