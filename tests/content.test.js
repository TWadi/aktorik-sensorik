// Content rules for every chapter that exists: both languages complete, same structure in both,
// formula markup balanced, quiz answers valid, short sentences.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadChapters, animsOf } from './helpers/chapters.js';
import { CHAPTERS } from '../js/manifest.js';
import { formula } from '../js/core/format.js';

const TYPES = ['h', 'p', 'anim', 'formula', 'try', 'note', 'steps', 'example', 'quiz', 'table'];
const MAX_WORDS = 26; // per sentence
const FORBIDDEN = /\bClaude\b|\bAnthropic\b|lorem ipsum|TODO|FIXME/i;

const isPair = (v) => v && typeof v === 'object' && !Array.isArray(v) && 'de' in v && 'en' in v;

/** Collect every { de, en } pair inside a block (also inside nested arrays). */
function pairs(node, path, out = []) {
  if (isPair(node)) { out.push([path, node]); return out; }
  if (Array.isArray(node)) node.forEach((v, k) => pairs(v, `${path}[${k}]`, out));
  else if (node && typeof node === 'object') {
    for (const [key, v] of Object.entries(node)) {
      if (key === 'def' || typeof v === 'function') continue;
      pairs(v, `${path}.${key}`, out);
    }
  }
  return out;
}

const flat = (v) => (Array.isArray(v) ? v.flat(3).join(' ') : String(v));
const plain = (s) => s.replace(/<[^>]*>/g, ' ').replace(/\$[^$]*\$/g, ' X ');

function checkText(where, text) {
  assert.ok(text.trim().length > 0, `${where}: empty text`);
  assert.ok(!FORBIDDEN.test(text), `${where}: forbidden word in "${text.slice(0, 60)}"`);
  assert.equal((text.match(/\$/g) || []).length % 2, 0, `${where}: unbalanced $ in "${text.slice(0, 60)}"`);
  assert.equal((text.match(/\[\[/g) || []).length, (text.match(/\]\]/g) || []).length, `${where}: unbalanced [[ ]]`);
  assert.ok(!/\$\{|`/.test(text), `${where}: stray template syntax`);
  formula(text); // must not throw
  for (const sentence of plain(text).split(/(?<=[.!?])\s+/)) {
    const words = sentence.trim().split(/\s+/).filter(Boolean).length;
    assert.ok(words <= MAX_WORDS, `${where}: sentence with ${words} words (max ${MAX_WORDS}): "${sentence.trim().slice(0, 80)}…"`);
  }
}

const chapters = await loadChapters();

test('manifest: ids are unique and well formed', () => {
  const ids = CHAPTERS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  CHAPTERS.forEach((c) => {
    assert.match(c.id, /^[as]\d\d$/);
    assert.ok(isPair(c.title) && isPair(c.lead), `${c.id}: title and lead need de and en`);
    assert.ok(c.minutes > 0);
  });
});

for (const { meta, chapter } of chapters) {
  test(`${meta.id}: structure`, () => {
    assert.equal(chapter.id, meta.id, 'default export id must match the file name');
    assert.ok(Array.isArray(chapter.blocks) && chapter.blocks.length >= 5, 'a chapter needs at least 5 blocks');
    chapter.blocks.forEach((b, k) => assert.ok(TYPES.includes(b.type), `block ${k}: unknown type ${b.type}`));
    assert.equal(chapter.blocks[0].type, 'h', 'a chapter starts with a heading');
    const anims = animsOf(chapter);
    assert.ok(anims.length >= 1, 'a chapter needs at least one animation');
    assert.ok(chapter.blocks.some((b) => b.type === 'try'), 'a chapter needs a "try it" block');
    assert.ok(chapter.blocks.some((b) => b.type === 'note'), 'a chapter needs a "remember" block');
    assert.ok(chapter.blocks.some((b) => b.type === 'quiz'), 'a chapter needs a quiz');
    const firstAnim = chapter.blocks.findIndex((b) => b.type === 'anim');
    assert.ok(firstAnim <= 6, "the first animation must come within the first seven blocks");
    anims.forEach((def) => {
      assert.match(def.id, new RegExp(`^${meta.id}-[a-z0-9-]+$`), `animation id "${def.id}" must start with "${meta.id}-"`);
      assert.ok(isPair(def.title), `${def.id}: title needs de and en`);
      assert.ok(isPair(def.hint), `${def.id}: hint needs de and en`);
      assert.equal(typeof def.build, 'function');
    });
    assert.equal(new Set(anims.map((d) => d.id)).size, anims.length, 'animation ids must be unique');
  });

  test(`${meta.id}: both languages complete and parallel`, () => {
    chapter.blocks.forEach((b, k) => {
      const found = pairs(b, `block ${k} (${b.type})`);
      if (b.type !== 'anim' && b.type !== 'formula') assert.ok(found.length > 0, `block ${k} (${b.type}) has no { de, en } text`);
      for (const [where, pair] of found) {
        assert.equal(Array.isArray(pair.de), Array.isArray(pair.en), `${where}: de and en differ in shape`);
        if (Array.isArray(pair.de)) assert.equal(pair.de.length, pair.en.length, `${where}: de and en lists differ in length`);
        checkText(`${meta.id} ${where}.de`, flat(pair.de));
        checkText(`${meta.id} ${where}.en`, flat(pair.en));
      }
    });
    animsOf(chapter).forEach((def) => {
      ['title', 'hint'].forEach((key) => { checkText(`${def.id}.${key}.de`, def[key].de); checkText(`${def.id}.${key}.en`, def[key].en); });
    });
  });

  test(`${meta.id}: quiz questions are valid`, () => {
    chapter.blocks.filter((b) => b.type === 'quiz').forEach((b) => {
      assert.ok(b.questions.length >= 2, 'a quiz needs at least two questions');
      b.questions.forEach((q, k) => {
        assert.ok(isPair(q.q) && isPair(q.why), `question ${k + 1} needs q and why in both languages`);
        if (q.options) {
          assert.ok(q.options.de.length >= 2 && q.options.de.length === q.options.en.length, `question ${k + 1}: options`);
          assert.ok(Number.isInteger(q.correct) && q.correct >= 0 && q.correct < q.options.de.length, `question ${k + 1}: correct index`);
        } else {
          assert.ok(Number.isFinite(q.answer), `question ${k + 1}: numeric answer`);
          assert.ok(typeof q.unit === 'string' || isPair(q.unit), `question ${k + 1}: unit (string, may be empty, or a { de, en } pair)`);
        }
      });
    });
  });
}
