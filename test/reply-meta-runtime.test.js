import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { composeRuntime, unexport } from '../src/runtime/compose.js';
import * as assets from '../src/assets.js';
import { pageCss } from '../src/themes/index.js';
import { inlineAssets } from '../scripts/inline-assets.mjs';

const read = (file) => readFileSync(new URL(`../src/runtime/${file}`, import.meta.url), 'utf8');
const unimport = (code) => code.replace(/^import \{[^}]*\} from '\.\/[\w-]+\.js';\r?\n/gm, '');

test('default composition retains its original bytes and metadata composition parses', () => {
  const scripts = `${read('page.js')}(() => {\n${unexport(read('reply-text.js'))}\n${unexport(read('rtl-letter.js'))}\n${unimport(unexport(read('reply-view.js')))}\n${read('reply.js')}})();\n(() => {\n${unexport(read('remark-text.js'))}\n${read('remark.js')}})();\n(() => {\n${unexport(read('layout-plan.js'))}\n${read('layout-dom.js')}})();\n${read('outline.js')}`;
  const original = `(() => {\n${unexport(read('math-text.js'))}\n${scripts}})();\n`;
  assert.equal(composeRuntime(read), original);
  assert.equal(assets.RUNTIME_JS, original);
  assert.doesNotMatch(original, /reply-meta/);
  assert.match(assets.RUNTIME_REPLY_META_JS, /withReplyMeta/);
  assert.ok(assets.RUNTIME_REPLY_META_JS.includes('[data-am-reply-meta]'));
  new vm.Script(assets.RUNTIME_REPLY_META_JS);
});

test('metadata wrappers attach and render the block only for valid metadata', () => {
  const fixtureRead = (file) => file === 'reply.js' ? 'globalThis.api = { replyText, replyViewHtml };\n' :
    ['reply-text.js', 'rtl-letter.js', 'reply-view.js', 'reply-meta-text.js', 'reply-meta.js'].includes(file) ? read(file) : '';
  const script = new vm.Script(composeRuntime(fixtureRead, { replyMeta: true }));
  const args = { title: 'Example', decisions: [], comments: [], remarks: [], ui: {} };
  for (const value of [null, '{broken', '{"design_id":"D-012"}']) {
    const context = { document: { querySelector: () => value === null ? null : { getAttribute: () => value } } };
    script.runInNewContext(context);
    const text = context.api.replyText(args);
    const html = context.api.replyViewHtml(text);
    if (value === '{"design_id":"D-012"}') {
      assert.ok(text.endsWith('\n```am-reply-meta\n{"design_id":"D-012"}\n```\n'));
      assert.match(html, /<pre class="am-reply-meta-view" dir="ltr">/);
      assert.doesNotMatch(html, /```am-reply-meta/);
    } else {
      assert.doesNotMatch(text, /am-reply-meta/);
      assert.doesNotMatch(html, /am-reply-meta/);
    }
  }
});

test('page CSS includes metadata styles only when requested', () => {
  const original = pageCss();
  assert.equal(pageCss(undefined, { replyMeta: false }), original);
  assert.ok(!original.includes(assets.REPLY_META_CSS));
  assert.ok(pageCss(undefined, { replyMeta: true }).includes(assets.REPLY_META_CSS));
});

test('inline and development assets have the same exports and metadata values', async () => {
  let onLoad;
  inlineAssets.setup({ onLoad: (_options, callback) => { onLoad = callback; } });
  const { contents } = onLoad();
  const inline = await import(`data:text/javascript;base64,${Buffer.from(contents).toString('base64')}`);
  assert.deepEqual(Object.keys(inline).sort(), Object.keys(assets).sort());
  assert.equal(inline.RUNTIME_REPLY_META_JS, assets.RUNTIME_REPLY_META_JS.replace(/\r\n?/g, '\n'));
  assert.equal(inline.REPLY_META_CSS, assets.REPLY_META_CSS.replace(/\r\n?/g, '\n'));
});
