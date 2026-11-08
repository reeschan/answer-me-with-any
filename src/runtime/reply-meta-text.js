// Attach reply metadata as a fenced JSON block, separate it for display, and render its contents safely.
// A plain ES module for tests; the page gets it with its `export` keyword dropped.
export function withReplyMeta(text, entries) {
  if (!text || !entries?.length) return text;
  return `${text}\n\`\`\`am-reply-meta\n${JSON.stringify(Object.fromEntries(entries))}\n\`\`\`\n`;
}

export function splitReplyMeta(text) {
  const marker = /(^|\n)\`\`\`am-reply-meta\n/g;
  let last = null;
  for (const match of text.matchAll(marker)) last = match;
  if (!last) return { body: text, json: null };
  const block = text.slice(last.index + last[1].length).match(/^\`\`\`am-reply-meta\n([\s\S]*?)\n\`\`\`\n?$/);
  return block ? { body: text.slice(0, last.index), json: block[1] } : { body: text, json: null };
}

export function replyMetaViewHtml(json) {
  const escaped = json.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  return `<pre class="am-reply-meta-view" dir="ltr">${escaped}</pre>`;
}
