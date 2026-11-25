// Smoke test for every animation of every chapter that exists: build it, run frames, move every
// control to its extremes, press every button, and make sure nothing throws and no NaN reaches
// the canvas or the readout. Run one chapter only with: CHAPTERS=a04 node --test tests/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadChapters, animsOf } from './helpers/chapters.js';
import { mountMock } from './helpers/mock-stage.js';
import { applyTheme } from '../js/core/theme.js';

const DT = 1 / 60;
const BAD_TEXT = /NaN|undefined|Infinity|\[object/;

function run(m, frames, t0 = 0) {
  let t = t0;
  for (let k = 0; k < frames; k++) { t += DT; m.frame(DT, t); }
  return t;
}

function exercise(def, lang) {
  const m = mountMock(def, lang);
  assert.equal(typeof m.frame, 'function', 'build() must call st.loop(fn)');
  m.frame(0, 0); // paused first frame
  let t = run(m, 180);
  for (const s of m.sliders) {
    const start = s.value;
    for (const v of [s.min, s.max, start]) { s.drive(v); t = run(m, 40, t); }
  }
  for (const s of m.selects) {
    const start = s.value;
    for (const v of [...s.options, start]) { s.drive(v); t = run(m, 40, t); }
  }
  for (const g of m.toggles) {
    const start = g.value;
    for (const v of [!start, start]) { g.drive(v); t = run(m, 40, t); }
  }
  for (const b of m.buttons) { b.click(); t = run(m, 60, t); b.click(); t = run(m, 30, t); }
  if (m.pointer) {
    const pts = [[80, 80], [380, 200], [700, 300], [-20, 500]];
    for (const [x, y] of pts) {
      if (m.pointer.down) m.pointer.down(x, y);
      if (m.pointer.move) m.pointer.move(x + 30, y + 10, true);
      t = run(m, 10, t);
      if (m.pointer.up) m.pointer.up(x + 30, y + 10);
    }
    if (m.pointer.move) m.pointer.move(300, 150, false);
    t = run(m, 20, t);
  }
  // all sliders at min, then all at max: combinations the single sweeps do not reach
  m.sliders.forEach((s) => s.drive(s.min)); t = run(m, 60, t);
  m.sliders.forEach((s) => s.drive(s.max)); t = run(m, 60, t);
  m.frame(0, t); // paused frame after running
  run(m, 600, t); // ten more seconds
  return m;
}

const chapters = await loadChapters();

test('at least one chapter with an animation exists', () => {
  assert.ok(chapters.some(({ chapter }) => animsOf(chapter).length > 0));
});

for (const { meta, chapter } of chapters) {
  for (const def of animsOf(chapter)) {
    for (const lang of ['de', 'en']) {
      for (const theme of lang === 'de' ? ['light', 'dark'] : ['light']) {
        test(`${meta.id} · ${def.id} · ${lang} · ${theme}`, () => {
          applyTheme(theme);
          const m = exercise(def, lang);
          assert.deepEqual(m.problems.slice(0, 5), [], 'non-finite numbers reached the canvas or a control is misconfigured');
          assert.ok(m.ctx.calls > 50, 'the animation should draw something');
          const bad = m.readouts.find((r) => BAD_TEXT.test(r.replace(/<[^>]*>/g, '')));
          assert.equal(bad, undefined, `readout contains a broken value: ${bad}`);
          assert.ok(def.height >= 240 && def.height <= 560, 'height should be between 240 and 560');
        });
      }
    }
  }
}
