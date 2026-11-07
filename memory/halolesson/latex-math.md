---
name: latex-math
description: Exercise text renders LaTeX with KaTeX, sandboxed (trust off), $...$ / $$...$$ delimiters
type: decision
---

*(as of 2026-11-07)* User asked for "latex support rendering without arbitrary code execution for the questions".
Built: `web/src/components/MathText.tsx` splits text on `$$…$$`, `\[…\]`, `\(…\)`, `$…$` (`\$` = literal; inline `$` can't be empty or span lines, so prices stay text) and renders math with KaTeX 0.16.22, `trust:false`, `throwOnError:false`, capped maxExpand/maxSize. Plain text stays React text nodes; only KaTeX output is injected as HTML. Verified `\href{javascript:…}` renders as red error text, no link.
Used in PracticePage for prompt, options, correct answer and explanation. Agents told via prompt.ts, the spec and the MCP exercise schema. Free-text answers are still compared as plain text.
