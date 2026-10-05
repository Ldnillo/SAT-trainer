import type { ReportReason, ReportStatus } from "../db/schema";

/** The choices a student picks from, in the order the form shows them. */
export const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: "wrong-answer", label: "The answer marked correct is wrong" },
  { id: "unclear", label: "The question is unclear or has more than one right answer" },
  { id: "explanation", label: "The explanation is wrong or confusing" },
  { id: "typo", label: "There's a typo, or something doesn't display right" },
  { id: "other", label: "Something else" },
];

export const REPORT_STATUSES: ReportStatus[] = ["open", "fixed", "dismissed"];

export const MAX_DETAILS = 1000;

export function isReportReason(value: unknown): value is ReportReason {
  return REPORT_REASONS.some((r) => r.id === value);
}

export function isReportStatus(value: unknown): value is ReportStatus {
  return REPORT_STATUSES.includes(value as ReportStatus);
}

export function reasonLabel(reason: ReportReason): string {
  return REPORT_REASONS.find((r) => r.id === reason)?.label ?? reason;
}
