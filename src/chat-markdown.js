// The chat form of a page draft (am render --format md): the same content as plain Markdown that a chat shows as it is.
// It keeps what a reader needs in a chat and drops what only the page uses: panel IDs and attributes, {table …} lines, the
// front matter other than the title and subtitle, and the reply metadata (a chat reply never carries it back).

import { parseDocLoose } from './parse.js';
import { contentLines, fields } from './components/error.js';

// The output formats of am render: html writes a page; md prints the chat form to stdout and writes nothing.
export const RENDER_FORMAT = Object.freeze({ HTML: 'html', MD: 'md' });
export const FORMATS = Object.freeze(Object.values(RENDER_FORMAT));

const RAW_LANGS = new Set(['html', 'svg']);
const TABLE_ATTR_LINE = /^\s*\{table\s+[^{}]*\}\s*$/;
const ASK_OPTION = /^([*-])\s+(.+)$/;

// source: the draft; language: the resolved language of the draft (its ui labels name the suggested option and the
// placeholder of a raw block). The draft is assumed to have rendered already, so a block that does not parse is kept as it is.
export function toChatMarkdown(source, language) {
  const { doc } = parseDocLoose(source);
  const ui = language.ui;
  const out = [];
  if (doc.meta.title) out.push(`# ${doc.meta.title}`);
  if (doc.meta.subtitle) out.push(String(doc.meta.subtitle));
  out.push(...blocksText(doc.intro, ui));
  for (const panel of doc.panels) {
    out.push(`## ${panel.title}`);
    out.push(...blocksText(panel.blocks, ui));
  }
  return `${out.filter((part) => part.trim()).join('\n\n')}\n`;
}

function blocksText(blocks, ui) {
  return blocks.map((b) => {
    if (b.type === 'md') return mdText(b.text);
    if (b.lang === 'ask') return askText(b.text, b.args, ui);
    if (RAW_LANGS.has(b.lang)) return `_(${ui.chat.htmlOnly})_`;
    return fenced(b);
  });
}

const mdText = (text) => text.split('\n').filter((line) => !TABLE_ATTR_LINE.test(line)).join('\n').trim();

// A fence long enough that no backtick run inside the block closes it.
function fenced({ lang, args, text }) {
  const longest = Math.max(2, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const mark = '`'.repeat(longest + 1);
  const info = [lang, args].filter(Boolean).join(' ');
  return `${mark}${info}\n${text}\n${mark}`;
}

// The question in bold, then the options as a numbered list; a suggested option gets the language's "suggested" label.
function askText(text, args, ui) {
  const [question, ...rest] = contentLines(text);
  const multi = /(^|\s)multi(\s|$)/.test(args);
  const options = rest.map(({ text: line }, i) => {
    const m = line.match(ASK_OPTION);
    if (!m) return `${i + 1}. ${line}`;
    const [label, note = ''] = fields(m[2]);
    const tag = m[1] === '*' ? ` (${ui.reply.suggested})` : '';
    return `${i + 1}. ${label}${tag}${note ? ` — ${note}` : ''}`;
  });
  const head = `**${question?.text ?? ''}**${multi ? ` (${ui.chat.multi})` : ''}`;
  return [head, ...options].join('\n');
}
