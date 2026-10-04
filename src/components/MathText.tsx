import katex from "katex";
import { splitMath } from "@/lib/sat/math-text";

/** Question text with $...$ math rendered by KaTeX on the server. */
export function MathText({ text }: { text: string }) {
  return (
    <>
      {splitMath(text).map((part, i) =>
        part.kind === "text" ? (
          <span key={i}>{part.value}</span>
        ) : (
          <span key={i} dangerouslySetInnerHTML={{ __html: katex.renderToString(part.value, { throwOnError: false }) }} />
        ),
      )}
    </>
  );
}
