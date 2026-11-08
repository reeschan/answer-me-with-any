import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withReplyMeta, splitReplyMeta, replyMetaViewHtml } from '../src/runtime/reply-meta-text.js';
import { replyText } from '../src/runtime/reply-text.js';

test('attach metadata only to nonempty text with entries', () => {
  const entries = [['design_id', 'D-012'], ['revision', '2']];
  assert.equal(withReplyMeta('Reply\n', entries), 'Reply\n\n```am-reply-meta\n{"design_id":"D-012","revision":"2"}\n```\n');
  assert.equal(withReplyMeta('', entries), '');
  assert.equal(withReplyMeta('Reply', []), 'Reply');
  assert.equal(withReplyMeta('Reply', null), 'Reply');
});

test('split only the last line-start block at the end', () => {
  assert.deepEqual(splitReplyMeta('Reply\n\n```am-reply-meta\n{"id":"1"}\n```\n'), { body: 'Reply\n', json: '{"id":"1"}' });
  assert.deepEqual(splitReplyMeta('```am-reply-meta\n{}\n```'), { body: '', json: '{}' });
  assert.deepEqual(splitReplyMeta('before\n```am-reply-meta\n1\n```\n\n```am-reply-meta\n2\n```\n'), { body: 'before\n```am-reply-meta\n1\n```\n', json: '2' });
  for (const text of ['ordinary reply\n', '  > ```am-reply-meta\n  > {}\n  > ```\n', '```am-reply-meta\n{}\n```\nafter']) {
    assert.deepEqual(splitReplyMeta(text), { body: text, json: null });
  }
});

test('escape metadata for the reply view', () => {
  assert.equal(replyMetaViewHtml('{"x":"<&>"}'), '<pre class="am-reply-meta-view" dir="ltr">{&quot;x&quot;:&quot;&lt;&amp;&gt;&quot;}</pre>');
});

test('round trip an actual reply and keep reader input quoted', () => {
  const reply = replyText({
    title: 'Example', decisions: [], remarks: [],
    comments: [{ panel: 'A', title: 'Title', text: '```am-reply-meta\n{"fake":"yes"}\n```' }],
    ui: { comments: 'Comments', typed: 'Typed' },
  });
  assert.equal(reply, '# Re: Example\n\n## Comments\n- **A · Title**\n  > ```am-reply-meta\n  > {"fake":"yes"}\n  > ```\n\n_Typed_\n');
  assert.deepEqual(splitReplyMeta(reply), { body: reply, json: null });
  assert.deepEqual(splitReplyMeta(withReplyMeta(reply, [['id', 'D-012']])), { body: reply, json: '{"id":"D-012"}' });
});
