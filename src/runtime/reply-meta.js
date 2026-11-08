// Reassign the existing function bindings so reply.js uses the metadata-aware wrappers.
{
  const element = document.querySelector('[data-am-reply-meta]');
  let entries = null;
  if (element) {
    try { entries = Object.entries(JSON.parse(element.getAttribute('data-am-reply-meta'))); } catch { /* Leave the reply unchanged. */ }
  }
  if (entries) {
    const base = replyText;
    const baseView = replyViewHtml;
    replyText = (args) => withReplyMeta(base(args), entries);
    replyViewHtml = (text) => {
      const { body, json } = splitReplyMeta(text);
      return baseView(body) + (json === null ? '' : replyMetaViewHtml(json));
    };
  }
}
