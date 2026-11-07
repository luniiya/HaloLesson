import { Fragment, useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

// Exercise text with LaTeX math: $...$ or \(...\) inline, $$...$$ or \[...\]
// on its own line. \$ is a literal dollar sign. KaTeX only ever builds math
// markup from it: trust is off (no \href, \url, \includegraphics, \html...),
// macro expansion and sizes are capped, and anything it can't parse shows as
// the raw source in red instead of throwing.

type Part = { math: false; text: string } | { math: true; text: string; display: boolean };

const DELIMITERS: Array<[string, string, boolean]> = [["$$", "$$", true], ["\\[", "\\]", true], ["\\(", "\\)", false], ["$", "$", false]];

export function splitMath(source: string): Part[] {
  const parts: Part[] = [];
  let text = "";
  let index = 0;
  outer: while (index < source.length) {
    if (source.startsWith("\\$", index)) {
      text += "$";
      index += 2;
      continue;
    }
    for (const [open, close, display] of DELIMITERS) {
      if (!source.startsWith(open, index)) continue;
      const end = source.indexOf(close, index + open.length);
      // Inline $ math can't be empty or span lines, so prices like "$5 and $6" stay text.
      const body = end === -1 ? "" : source.slice(index + open.length, end);
      if (end === -1 || !body.trim() || (open === "$" && body.includes("\n"))) continue;
      if (text) parts.push({ math: false, text });
      text = "";
      parts.push({ math: true, text: body, display });
      index = end + close.length;
      continue outer;
    }
    text += source[index];
    index += 1;
  }
  if (text) parts.push({ math: false, text });
  return parts;
}

const OPTIONS: katex.KatexOptions = {
  throwOnError: false,
  trust: false,
  strict: "ignore",
  maxSize: 20,
  maxExpand: 500,
  output: "htmlAndMathml",
};

export default function MathText({ text }: { text: string }) {
  const parts = useMemo(() => splitMath(text).map((part) => (part.math ? { ...part, html: katex.renderToString(part.text, { ...OPTIONS, displayMode: part.display }) } : part)), [text]);
  return (
    <>
      {parts.map((part, index) => part.math
        ? <span key={index} className={part.display ? "math-display" : "math-inline"} dangerouslySetInnerHTML={{ __html: (part as { html: string }).html }} />
        : <Fragment key={index}>{part.text}</Fragment>)}
    </>
  );
}
