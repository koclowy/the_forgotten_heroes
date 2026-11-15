/**
 * Simple formatting inside dialog "text" (story.json, equipment scripts, greetings):
 *   <i>…</i> italic · <b>…</b> bold · <small>…</small> smaller ·
 *   <chorus>…</chorus> the other connected equipment speaking (own line, italic, smaller, muted)
 * A tiny whitelist parser: it builds a tree of plain strings + those four tags, nothing else.
 * Unknown tags and stray "<" stay plain text. The result is rendered as React elements
 * (never as HTML), see DialogBubble.tsx.
 */
export const RICH_TAGS = ["i", "b", "small", "chorus"] as const;
export type RichTag = (typeof RICH_TAGS)[number];
export type RichNode = string | { tag: RichTag; children: RichNode[] };

export type RichText = {
  nodes: RichNode[];
  /** the visible characters only (what gets typed, counted and voiced) */
  visible: string;
  /** per visible character: is it inside a <chorus>? */
  chorus: boolean[];
  /** problems for the content check: unclosed / mismatched / stray closing tags */
  errors: string[];
};

const TAG_RE = /<(\/?)([a-z]+)>/gi;
const isTag = (s: string): s is RichTag => (RICH_TAGS as readonly string[]).includes(s);

export function parseRich(text: string): RichText {
  type Open = { tag: RichTag; children: RichNode[] };
  const root: RichNode[] = [];
  const stack: Open[] = [];
  const errors: string[] = [];
  const here = () => (stack.length ? stack[stack.length - 1].children : root);
  const pushText = (s: string) => {
    if (!s) return;
    const list = here();
    const last = list[list.length - 1];
    if (typeof last === "string") list[list.length - 1] = last + s;
    else list.push(s);
  };

  let at = 0;
  for (const m of text.matchAll(TAG_RE)) {
    const [whole, slash, rawName] = m;
    const name = rawName.toLowerCase();
    if (!isTag(name)) continue; // unknown tag → stays in the text as typed
    pushText(text.slice(at, m.index));
    at = m.index! + whole.length;
    if (!slash) {
      const el: Open = { tag: name, children: [] };
      here().push(el);
      stack.push(el);
      continue;
    }
    const k = stack.map((s) => s.tag).lastIndexOf(name);
    if (k < 0) {
      errors.push(`"</${name}>" has no matching "<${name}>" before it`);
      pushText(whole); // show it as typed
      continue;
    }
    if (k !== stack.length - 1)
      errors.push(`"</${name}>" closes "<${name}>" while "<${stack[stack.length - 1].tag}>" inside it is still open`);
    stack.length = k; // close it (and anything still open inside it)
  }
  pushText(text.slice(at));
  for (const s of stack) errors.push(`"<${s.tag}>" is never closed (add "</${s.tag}>")`);

  let visible = "";
  const chorus: boolean[] = [];
  const walk = (nodes: RichNode[], inChorus: boolean) => {
    for (const n of nodes) {
      if (typeof n === "string") {
        visible += n;
        for (let i = 0; i < n.length; i++) chorus.push(inChorus);
      } else walk(n.children, inChorus || n.tag === "chorus");
    }
  };
  walk(root, false);
  return { nodes: root, visible, chorus, errors };
}
