import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from '../src/cli.js';

let dir;
before(() => { dir = mkdtempSync(join(tmpdir(), 'am-chat-')); });
after(() => rmSync(dir, { recursive: true, force: true }));

function sink() {
  let text = '';
  const stream = new Writable({ write(chunk, _enc, cb) { text += chunk; cb(); } });
  return { stream, get text() { return text; } };
}

async function run(args, { stdin = '', env = {} } = {}) {
  const out = sink();
  const err = sink();
  const code = await main(args, {
    stdout: out.stream, stderr: err.stream, stdin: Readable.from([stdin]),
    env: { AM_NO_OPEN: '1', AM_HOME: dir, AM_NO_UPDATE_CHECK: '1', ...env }, cwd: dir,
  });
  return { code, out: out.text, err: err.text };
}

const DRAFT = [
  '---',
  'title: Cache choice',
  'subtitle: Pick one before we build',
  'source: notes',
  'reply-meta-run_id: abc123',
  '---',
  'Lead line.',
  '',
  '## A Options {span=2}',
  '| name | state |',
  '|---|---|',
  '| Redis | ok |',
  '{table sort}',
  '',
  '```ask',
  'Which cache do we use?',
  '* Redis | keeps data after a restart',
  '- Memcached | simpler',
  '```',
  '',
  '## B Flow',
  '```flow',
  'A -> B: call',
  '```',
  '',
  '```svg',
  '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
  '```',
  '',
].join('\n');

const pages = () => (existsSync(join(dir, 'pages')) ? readdirSync(join(dir, 'pages')) : []);

test('render --format md: prints the chat Markdown on stdout and writes no page', async () => {
  const before = pages().length;
  const r = await run(['render', '-', '--format', 'md'], { stdin: DRAFT });
  assert.equal(r.code, 0, r.err);
  assert.equal(pages().length, before);
  assert.equal(r.out, [
    '# Cache choice',
    '',
    'Pick one before we build',
    '',
    'Lead line.',
    '',
    '## Options',
    '',
    '| name | state |',
    '|---|---|',
    '| Redis | ok |',
    '',
    '**Which cache do we use?**',
    '1. Redis (suggested) — keeps data after a restart',
    '2. Memcached — simpler',
    '',
    '## Flow',
    '',
    '```flow',
    'A -> B: call',
    '```',
    '',
    '_(This figure is in the HTML page only)_',
    '',
  ].join('\n'));
  assert.doesNotMatch(r.out, /reply-meta|am-reply-meta|abc123|source: notes/);
  assert.match(r.err, /STE ✓ 0 warnings/);
  assert.doesNotMatch(r.out, /✓/);
});

test('render --format md: a multi ask says the reader may pick several; labels follow the draft language', async () => {
  const draft = '---\ntitle: キャッシュの選択\n---\n## A 選択肢\n```ask multi\nどれを使いますか？\n* Redis | 再起動後も残る\n* Memcached\n```\n\n```html\n<b>x</b>\n```\n';
  const r = await run(['render', '-', '--format', 'md'], { stdin: draft });
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /\*\*どれを使いますか？\*\* \(複数選べます\)\n1\. Redis \(推奨\) — 再起動後も残る\n2\. Memcached \(推奨\)/);
  assert.match(r.out, /_\(この図は HTML 版のみ\)_/);
});

test('render --format md: a block with backticks inside gets a longer fence', async () => {
  const draft = '---\ntitle: Code\n---\n## A Code\n````js\nconst s = "```";\n````\n';
  const r = await run(['render', '-', '--format', 'md'], { stdin: draft });
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /````js\nconst s = "```";\n````/);
});

test('render --format md: -o and --replace are refused; an unknown format is refused', async () => {
  for (const args of [['-o', 'page.html'], ['--replace', 'x.html']]) {
    const r = await run(['render', '-', '--format', 'md', ...args], { stdin: DRAFT });
    assert.equal(r.code, 2);
    assert.match(r.err, /--format md writes no page/);
  }
  const bad = await run(['render', '-', '--format', 'pdf'], { stdin: DRAFT });
  assert.equal(bad.code, 2);
  assert.match(bad.err, /Invalid format value "pdf"\. Choose one of: html \| md/);
});

test('render --format md: a draft error is reported on stderr with the same exit code as a page render', async () => {
  const broken = '---\ntitle: Broken\n---\n## A Ask\n```ask\nWhich?\n- one\n- two\n```\n';
  const page = await run(['render', '-'], { stdin: broken });
  const chat = await run(['render', '-', '--format', 'md'], { stdin: broken });
  assert.notEqual(page.code, 0);
  assert.equal(chat.code, page.code);
  assert.equal(chat.out, '');
  assert.match(chat.err, /✗ L\d+ \[ask\] ask: mark exactly one option/);
});

test('render: config format md is the default for render; --format html overrides it', async () => {
  assert.equal((await run(['config', 'set', 'format', 'md'])).code, 0);
  try {
    const chat = await run(['render', '-'], { stdin: DRAFT });
    assert.equal(chat.code, 0, chat.err);
    assert.match(chat.out, /^# Cache choice\n/);
    const page = await run(['render', '-', '--format', 'html'], { stdin: DRAFT });
    assert.equal(page.code, 0, page.err);
    assert.match(page.out, /✓ .+\.html/);
  } finally {
    await run(['config', 'reset', 'format']);
  }
});
