import type { QuestionContent } from "../sat/question";

/** Normalizes a typed answer: no spaces, unicode minus to "-", no leading "+". */
export function normalizeAnswer(answer: string): string {
  return answer.replace(/\s+/g, "").replace(/[−–]/g, "-").replace(/^\+/, "").toLowerCase();
}

/** Parses "7/4", "-1.75", ".5" or "3" into a number; undefined if it isn't one. */
export function parseNumber(answer: string): number | undefined {
  const s = normalizeAnswer(answer);
  const frac = /^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(s);
  if (frac) {
    const d = Number(frac[2]);
    return d === 0 ? undefined : Number(frac[1]) / d;
  }
  return /^-?(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : undefined;
}

/**
 * Multiple choice: the choice label must match the key.
 * Student-produced response: the answer must match one of the accepted forms,
 * either exactly or as the same number written differently ("1.750" for "1.75").
 * Like the real grid-in, a rounded decimal that isn't listed (".66" for 2/3) is wrong.
 */
export function isCorrect(content: QuestionContent, answer: string): boolean {
  if (content.correctChoice) return answer.trim().toUpperCase() === content.correctChoice;
  const given = normalizeAnswer(answer);
  if (!given) return false;
  const value = parseNumber(given);
  return content.acceptedAnswers.some((accepted) => {
    if (normalizeAnswer(accepted) === given) return true;
    const a = parseNumber(accepted);
    return value !== undefined && a !== undefined && Math.abs(a - value) < 1e-9;
  });
}
