// The YAML header of skill and command files must parse with a strict YAML parser: npx skills and every agent load the skill with one.
// Our own draft parser splits by line and is more lenient, so it cannot catch these problems (see PR #2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { parseDoc, parseDocLoose, ParseError } from '../src/parse.js';
import { renderDoc } from '../src/render.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// skills/ is also the plugin root, so it holds commands/ and .claude-plugin/ beside the skill directories.
const skillDirs = () => readdirSync(join(ROOT, 'skills')).filter((d) => existsSync(join(ROOT, 'skills', d, 'SKILL.md')));

function frontmatterFiles() {
  const skills = skillDirs().map((d) => join('skills', d, 'SKILL.md'));
  const commands = readdirSync(join(ROOT, 'skills/commands')).filter((f) => f.endsWith('.md')).map((f) => join('skills/commands', f));
  return [...skills, ...commands];
}

function frontmatter(file) {
  const m = readFileSync(join(ROOT, file), 'utf8').match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, `${file} has no YAML header`);
  return parse(m[1], { strict: true, uniqueKeys: true });
}

test('frontmatter: the YAML header of every SKILL.md and command file parses strictly', () => {
  const files = frontmatterFiles();
  assert.ok(files.length >= 2);
  for (const file of files) {
    let data;
    assert.doesNotThrow(() => { data = frontmatter(file); }, `${file} has an invalid YAML header`);
    assert.equal(typeof data.description, 'string', `${file} needs a string description`);
    assert.ok(data.description.trim().length > 0, `${file} has an empty description`);
  }
});

test('frontmatter: the SKILL.md description stays within the Claude Code limit of 1536 characters', () => {
  for (const dir of skillDirs()) {
    const fm = frontmatter(join('skills', dir, 'SKILL.md'));
    const len = `${fm.description}${fm.when_to_use ?? ''}`.length;
    assert.ok(len <= 1536, `${dir}: description has ${len} characters; the excess is cut off in the skill list`);
  }
});

test('frontmatter: the SKILL.md description stays within the Agent Skills spec limit of 1024 characters', () => {
  // Over the limit, strict hosts (such as zcode) drop the whole skill with no visible error (see issue #23).
  for (const dir of skillDirs()) {
    const len = [...frontmatter(join('skills', dir, 'SKILL.md')).description].length;
    assert.ok(len <= 1024, `${dir}: description has ${len} characters; the spec limit is 1024`);
  }
});

test('frontmatter: the SKILL.md name matches its directory name', () => {
  for (const dir of skillDirs()) {
    assert.equal(frontmatter(join('skills', dir, 'SKILL.md')).name, dir);
  }
});

test('reply metadata preserves order and string values and stays out of the meta row', () => {
  const source = '---\ntitle: Example\nreply-meta-z: "001"\nowner: Alice\nreply-meta-a_1: true\n---\n';
  const { doc, errors } = parseDocLoose(source);
  assert.deepEqual(errors, []);
  assert.deepEqual(doc.replyMeta, [['z', '001'], ['a_1', 'true']]);
  assert.equal(doc.meta.owner, 'Alice');
  assert.equal(Object.keys(doc.meta).some((key) => key.startsWith('reply-meta-')), false);
  // The meta row only: the folded reply metadata block in the same header does show the values.
  const metaRow = renderDoc(source).html.match(/<div class="am-head-meta">[\s\S]*?<\/div>/)[0];
  assert.match(metaRow, /Alice/);
  assert.doesNotMatch(metaRow, /reply-meta-|001/);
});

test('reply metadata absent leaves ordinary meta and duplicate behavior intact', () => {
  const doc = parseDoc('---\nowner: first\nReply-Meta-X: visible\nowner: last\n---\n');
  assert.equal(doc.replyMeta, null);
  assert.equal(doc.meta.owner, 'last');
  assert.equal(doc.meta['Reply-Meta-X'], 'visible');
  assert.equal(parseDoc('text').replyMeta, null);
});

test('reply metadata validates names, values, count and duplicates at their source lines', () => {
  const invalid = [
    ['reply-meta-: ok', 2], ['reply-meta-A: ok', 2], [`reply-meta-${'a'.repeat(33)}: ok`, 2],
    ['reply-meta-a: ""', 2], ['reply-meta-a: "bad value"', 2], [`reply-meta-a: ${'x'.repeat(129)}`, 2],
    ['reply-meta-a: one\nreply-meta-a: two', 3],
    [Array.from({ length: 17 }, (_, i) => `reply-meta-n${i}: x`).join('\n'), 18],
  ];
  for (const [lines, line] of invalid) {
    assert.throws(() => parseDoc(`---\n${lines}\n---\n`), (error) => error instanceof ParseError && error.line === line);
  }
  const valid = Array.from({ length: 16 }, (_, i) => `reply-meta-n${i}: ${'x'.repeat(128)}`).join('\n');
  assert.equal(parseDoc(`---\n${valid}\n---\n`).replyMeta.length, 16);
  assert.throws(() => parseDoc('---\ntemplate: video\nreply-meta-a: bad value\n---\n'), (error) => error instanceof ParseError && error.line === 3);
});

test('reply metadata requires the key at column 1 with no space before the colon', () => {
  for (const line of ['  reply-meta-draft_hash: sha256:ab', 'reply-meta-draft_hash : "sha256:ab"']) {
    assert.throws(() => parseDoc(`---\n${line}\n---\n`), (error) => error instanceof ParseError && error.line === 2);
  }
  assert.deepEqual(parseDoc('---\nreply-meta-draft_hash: "sha256:ab" # comment\n---\n').replyMeta, [['draft_hash', 'sha256:ab']]);
});

test('reply metadata validation errors describe the invalid name or value and allowed form', () => {
  assert.throws(() => parseDoc('---\nreply-meta-A: ok\n---\n'), (error) =>
    error instanceof ParseError && error.line === 2 && error.message === 'Invalid reply metadata name "A"; use a lowercase letter, then up to 31 of a-z 0-9 _');
  assert.throws(() => parseDoc('---\nreply-meta-design_id: D 012\n---\n'), (error) =>
    error instanceof ParseError && error.line === 2 && error.message === 'Invalid reply metadata value "D 012" for "design_id"; use 1-128 of A-Z a-z 0-9 . _ : + / = -');
});
