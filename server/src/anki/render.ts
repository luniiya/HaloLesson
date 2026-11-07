// Renders Anki card templates to HTML (rslib/src/template.rs, simplified).
// Supported: {{Field}}, {{FrontSide}}, {{Tags}}, {{Deck}}, {{Subdeck}},
// {{Card}}, {{Type}}, #/^ sections, the cloze, text, hint, type, furigana,
// kana and kanji filters. Not supported: media files (no media sync) and
// template scripts (cards show in a sandboxed frame without scripts).
import type { NotetypeInfo } from "./collection";

export interface RenderInput {
  notetype: NotetypeInfo;
  ord: number;
  fields: string[]; // note fields in order
  tags: string;
  deckName: string;
}

export interface RenderedCard {
  question: string;
  answer: string;
  css: string;
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot", "'": "#39" }[c]};`);

export function stripHtml(html: string) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

const stripSounds = (html: string) => html.replace(/\[sound:[^\]]*\]/g, "").replace(/\[anki:tts[^\]]*\][\s\S]*?\[\/anki:tts\]/g, "");

// Replaces innermost clozes first so nested ones work.
function renderCloze(text: string, ord: number, question: boolean): string {
  const pattern = /\{\{c(\d+)::((?:(?!\{\{c\d+::)[\s\S])*?)(?:::((?:(?!\{\{c\d+::)[\s\S])*?))?\}\}/;
  let out = text;
  for (let guard = 0; guard < 500 && pattern.test(out); guard++) {
    out = out.replace(pattern, (_, number: string, content: string, hint: string | undefined) => {
      const active = Number(number) === ord + 1;
      if (!active) return `<span class="cloze-inactive" data-ordinal="${number}">${content}</span>`;
      if (question) return `<span class="cloze" data-ordinal="${number}">[${hint ? escapeHtml(stripHtml(hint)) : "..."}]</span>`;
      return `<span class="cloze" data-ordinal="${number}">${content}</span>`;
    });
  }
  return out;
}

export function clozeNumbers(text: string): number[] {
  return [...new Set([...text.matchAll(/\{\{c(\d+)::/g)].map((match) => Number(match[1])))].sort((a, b) => a - b);
}

function furigana(text: string, mode: "furigana" | "kana" | "kanji") {
  return text.replace(/ ?([^ >]+?)\[(.+?)\]/g, (_, base: string, reading: string) => {
    if (mode === "kana") return reading;
    if (mode === "kanji") return base;
    return `<ruby><rb>${base}</rb><rt>${reading}</rt></ruby>`;
  });
}

interface Context {
  fields: Map<string, string>;
  ord: number;
  question: boolean;
  frontSide: string;
}

function fieldValue(name: string, ctx: Context): string | undefined {
  if (name === "FrontSide") return ctx.question ? "" : ctx.frontSide;
  return ctx.fields.get(name);
}

function nonEmpty(name: string, ctx: Context) {
  const cloze = /^c(\d+)$/.exec(name);
  if (cloze && !ctx.fields.has(name)) return Number(cloze[1]) === ctx.ord + 1;
  const value = fieldValue(name, ctx);
  return value !== undefined && stripHtml(value).trim() !== "";
}

function applyFilters(filters: string[], name: string, ctx: Context): string {
  let value = fieldValue(name, ctx);
  if (value === undefined) return `<span class="anki-missing">{{${escapeHtml(name)}}}</span>`;
  // Filters run right to left, as in Anki.
  for (const filter of [...filters].reverse()) {
    switch (filter) {
      case "text":
        value = escapeHtml(stripHtml(value));
        break;
      case "cloze":
        value = renderCloze(value, ctx.ord, ctx.question);
        break;
      case "cloze-only":
        value = clozeNumbers(value).includes(ctx.ord + 1) ? renderCloze(value, ctx.ord, false) : "";
        break;
      case "hint":
        value = stripHtml(value) ? `<details class="hint"><summary>Show ${escapeHtml(name)}</summary>${value}</details>` : "";
        break;
      case "type":
        // Typing the answer isn't supported; the answer side shows the field.
        value = ctx.question ? "" : `<div class="typed-answer">${value}</div>`;
        break;
      case "furigana":
      case "kana":
      case "kanji":
        value = furigana(value, filter);
        break;
      default:
        // tts, edit and unknown filters leave the text as is.
        break;
    }
  }
  return value;
}

type Node = { text: string } | { field: string; filters: string[] } | { section: string; negated: boolean; children: Node[] };

function parse(template: string): Node[] {
  const root: Node[] = [];
  const stack: Array<{ name: string; children: Node[] }> = [{ name: "", children: root }];
  const tag = /\{\{([\s\S]*?)\}\}/g;
  let last = 0;
  for (const match of template.matchAll(tag)) {
    const top = stack.at(-1)!;
    if (match.index! > last) top.children.push({ text: template.slice(last, match.index) });
    last = match.index! + match[0].length;
    const inner = match[1]!.trim();
    if (inner.startsWith("#") || inner.startsWith("^")) {
      const node: Node = { section: inner.slice(1).trim(), negated: inner.startsWith("^"), children: [] };
      top.children.push(node);
      stack.push({ name: node.section, children: node.children });
    } else if (inner.startsWith("/")) {
      // Close the matching section; ignore stray closers.
      const name = inner.slice(1).trim();
      let index = stack.length - 1;
      while (index > 0 && stack[index]!.name !== name) index--;
      if (index > 0) stack.length = index;
    } else if (inner.startsWith("!")) {
      continue;
    } else {
      const parts = inner.split(":");
      const field = parts.pop()!.trim();
      top.children.push({ field, filters: parts.map((part) => part.trim().split(" ")[0]!) });
    }
  }
  if (last < template.length) stack.at(-1)!.children.push({ text: template.slice(last) });
  return root;
}

function renderNodes(nodes: Node[], ctx: Context): string {
  let out = "";
  for (const node of nodes) {
    if ("text" in node) out += node.text;
    else if ("field" in node) out += applyFilters(node.filters, node.field, ctx);
    else if (nonEmpty(node.section, ctx) !== node.negated) out += renderNodes(node.children, ctx);
  }
  return out;
}

export function renderCard(input: RenderInput): RenderedCard {
  const { notetype } = input;
  const template = notetype.cloze ? notetype.templates[0] : notetype.templates.find((entry) => entry.ord === input.ord);
  if (!template) throw new Error("This card's template is missing from the note type");
  const fields = new Map<string, string>();
  notetype.fields.forEach((name, index) => fields.set(name, stripSounds(input.fields[index] ?? "")));
  const subdeck = input.deckName.split("::").at(-1) ?? input.deckName;
  fields.set("Tags", escapeHtml(input.tags.trim()));
  fields.set("Type", escapeHtml(notetype.name));
  fields.set("Deck", escapeHtml(input.deckName));
  fields.set("Subdeck", escapeHtml(subdeck));
  fields.set("Card", escapeHtml(template.name));
  fields.set("CardFlag", "");
  const base = { fields, ord: input.ord };
  const question = renderNodes(parse(template.qfmt), { ...base, question: true, frontSide: "" });
  const answer = renderNodes(parse(template.afmt), { ...base, question: false, frontSide: question });
  return { question, answer, css: notetype.css };
}

// A self-contained document for a sandboxed iframe (no scripts, no requests
// except https/data images).
export function cardDocument(body: string, css: string, ord: number, dark: boolean) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; font-src https: data:"><style>${css.replace(/<\/style/gi, "<\\/style")}
html,body{margin:0;padding:0}body{padding:16px;overflow-wrap:anywhere}img{max-width:100%;height:auto}.cloze{font-weight:bold;color:#2563eb}.night_mode .cloze{color:#60a5fa}.hint summary{cursor:pointer;color:#6b7280}.anki-missing{color:#dc2626}</style></head><body class="card card${ord + 1}${dark ? " night_mode nightMode" : ""}">${body}</body></html>`;
}
