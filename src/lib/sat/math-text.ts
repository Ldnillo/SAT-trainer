export type TextPart =
  | { kind: "text"; value: string }
  | { kind: "math"; value: string }
  | { kind: "display"; value: string };

/**
 * Splits question text into plain text, LaTeX math written inside $...$, and
 * display math (an equation on its own line) written inside $$...$$.
 * A backslash-escaped dollar (\$) outside math is a literal dollar sign; inside
 * math it stays LaTeX (questions write money as $\$4$).
 */
export function splitMath(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let buf = "";
  let inMath = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (!inMath && ch === "$" && text[i + 1] === "$") {
      const end = text.indexOf("$$", i + 2);
      if (end > i + 2) {
        if (buf) parts.push({ kind: "text", value: buf });
        buf = "";
        parts.push({ kind: "display", value: text.slice(i + 2, end) });
        i = end + 1;
        continue;
      }
    }
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
