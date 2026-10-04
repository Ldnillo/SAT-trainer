import type { QuestionContent } from "./question";

/** Word shingles of a question's passage, stem and choices, for near-duplicate detection. */
export function fingerprint(q: QuestionContent, size = 3): Set<string> {
  const text = [...q.passages.map((p) => p.text), q.stem, ...q.choices.map((c) => c.text)]
    .join(" ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ");
  const words = text.split(/\s+/).filter(Boolean);
  const shingles = new Set<string>();
  for (let i = 0; i + size <= words.length; i++) shingles.add(words.slice(i, i + size).join(" "));
  if (shingles.size === 0 && words.length) shingles.add(words.join(" "));
  return shingles;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let shared = 0;
  for (const s of a) if (b.has(s)) shared++;
  return shared / (a.size + b.size - shared);
}

/** Above this overlap, a new question is treated as a near-copy of one already in the bank. */
export const DUPLICATE_THRESHOLD = 0.6;

export function findNearDuplicate(
  q: QuestionContent,
  existing: { id: string; content: QuestionContent }[],
): { id: string; score: number } | null {
  const fp = fingerprint(q);
  let best: { id: string; score: number } | null = null;
  for (const e of existing) {
    const score = jaccard(fp, fingerprint(e.content));
    if (score >= DUPLICATE_THRESHOLD && (!best || score > best.score)) best = { id: e.id, score };
  }
  return best;
}
