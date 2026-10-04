/**
 * Sends the site's emails (password resets and notices).
 *
 * - RESEND_API_KEY and EMAIL_FROM set: sent through Resend (resend.com).
 * - Otherwise, outside production, the email is printed to the server console
 *   so password reset works in local development with no email account.
 * - Otherwise (production with no key) nothing is sent and an error is logged.
 */
export interface Email {
  to: string;
  subject: string;
  text: string;
}

export type SendResult = { sent: true } | { sent: false; reason: "not-configured" | "failed" };

export function emailConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

export async function sendEmail(
  email: Email,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  if (!emailConfigured(env)) {
    if (env.NODE_ENV === "production") {
      console.error(`Email not sent ("${email.subject}"): set RESEND_API_KEY and EMAIL_FROM to send emails.`);
    } else {
      console.info(`\n--- Email (not sent: no RESEND_API_KEY) ---\nTo: ${email.to}\nSubject: ${email.subject}\n\n${email.text}\n---\n`);
    }
    return { sent: false, reason: "not-configured" };
  }
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [email.to], subject: email.subject, text: email.text }),
    });
    if (!res.ok) {
      console.error(`Email not sent ("${email.subject}"): Resend answered ${res.status} ${await res.text()}`);
      return { sent: false, reason: "failed" };
    }
    return { sent: true };
  } catch (err) {
    console.error(`Email not sent ("${email.subject}"):`, err);
    return { sent: false, reason: "failed" };
  }
}
