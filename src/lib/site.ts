/**
 * Business details shown in the privacy policy, terms and footer. Set them with
 * environment variables before launch (see .env.example); until then the pages
 * show bracketed placeholders so nothing goes live with made-up details.
 */
export interface SiteConfig {
  /** Where students and parents write for help, refunds and privacy requests. */
  supportEmail: string;
  /** The person or company that runs NextScore, as it should appear in the terms. */
  operator: string;
  /** The U.S. state whose law governs the terms. */
  governingLaw: string;
}

/** When the privacy policy and terms last changed. Update it whenever their wording changes. */
export const LEGAL_UPDATED = "October 4, 2026";

/** Days after purchase in which a season pass is refunded in full on request (see the terms). */
export const REFUND_DAYS = 7;

export function siteConfig(env: Record<string, string | undefined> = process.env): SiteConfig {
  return {
    supportEmail: env.SUPPORT_EMAIL?.trim() || "[support email]",
    operator: env.LEGAL_OPERATOR_NAME?.trim() || "[business name]",
    governingLaw: env.LEGAL_GOVERNING_STATE?.trim() || "[state]",
  };
}
