export type TextPart =
  | { kind: "text"; value: string }
  | { kind: "math"; value: string; display?: boolean };

/**
 * Splits question text into plain text and LaTeX math written inside $...$.
 * $$...$$ is a displayed equation on its own line (systems of equations use it).
 * A backslash-escaped dollar (\$) outside math is a literal dollar sign; inside
 * math it stays LaTeX (questions write money as $\$4$).
 */
export function splitMath(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let buf = "";
  let inMath = false;
  let display = false;
  const flush = () => {
    if (buf) parts.push(inMath ? (display ? { kind: "math", value: buf, display } : { kind: "math", value: buf }) : { kind: "text", value: buf });
    buf = "";
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\" && text[i + 1] === "$") {
      buf += inMath ? "\\$" : "$";
      i++;
    } else if (ch === "$") {
      const double: boolean = text[i + 1] === "$" && (!inMath || display);
      flush();
      if (!inMath) display = double;
      if (double) i++;
      inMath = !inMath;
    } else {
      buf += ch;
    }
  }
  // An unclosed $ is shown as written rather than swallowing the rest of the text.
  if (inMath) parts.push({ kind: "text", value: `${display ? "$$" : "$"}${buf}` });
  else flush();
  // Spaces next to a displayed equation would only add a stray gap.
  const isDisplay = (p?: TextPart) => p?.kind === "math" && p.display === true;
  return parts.filter((p, i) => !(p.kind === "text" && !p.value.trim() && (isDisplay(parts[i - 1]) || isDisplay(parts[i + 1]))));
}
