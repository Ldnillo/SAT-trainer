export type TextPart = { kind: "text"; value: string } | { kind: "math"; value: string };

/**
 * Splits question text into plain text and LaTeX math written inside $...$.
 * A backslash-escaped dollar (\$) outside math is a literal dollar sign; inside
 * math it stays LaTeX (questions write money as $\$4$).
 */
export function splitMath(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let buf = "";
  let inMath = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\" && text[i + 1] === "$") {
      buf += inMath ? "\\$" : "$";
      i++;
    } else if (ch === "$") {
      if (buf) parts.push({ kind: inMath ? "math" : "text", value: buf });
      buf = "";
      inMath = !inMath;
    } else {
      buf += ch;
    }
  }
  // An unclosed $ is shown as written rather than swallowing the rest of the text.
  if (inMath) parts.push({ kind: "text", value: `$${buf}` });
  else if (buf) parts.push({ kind: "text", value: buf });
  return parts;
}
