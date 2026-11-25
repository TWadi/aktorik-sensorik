// The animation stage: one canvas with a play/pause bar, controls (sliders, selects, buttons),
// a text readout and a hint. An animation is a plain object:
//   { id, title: {de, en}, hint: {de, en}, height, build(st) { ... } }
// See docs/CHAPTER-SPEC.md for the full contract.

import { C, onTheme } from './theme.js';
import { tr, UI } from './i18n.js';
import { makeDraw } from './draw.js';
import { num, fix, si, formula } from './format.js';

export const STAGE_W = 760;

const el = (tag, cls, html) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (html != null) node.innerHTML = html;
  return node;
};

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Mount an animation into `host`.
 * @param {{id: string, title: object, hint?: object, height?: number, build: Function}} def
 * @param {HTMLElement} host
 * @param {{lang: string}} ctxInfo
 * @returns {{destroy: () => void}}
 */
export function mountAnim(def, host, { lang }) {
  const t = (v) => tr(v, lang);
  const H = def.height || 400;
  const W = STAGE_W;
  const fig = el('figure', 'anim');
  fig.innerHTML = `
    <figcaption class="anim-head">
      <span class="anim-tag">${t(UI.animation)}</span>
      <strong class="anim-title">${formula(t(def.title))}</strong>
      <span class="anim-tools">
        <button type="button" class="tool" data-act="play"></button>
        <button type="button" class="tool" data-act="reset" aria-label="${t(UI.reset)}" title="${t(UI.reset)}">↺</button>
      </span>
    </figcaption>
    <div class="anim-scroll" tabindex="0" aria-label="${t(UI.scrollHint)}"><canvas role="img" aria-label="${String(t(def.title)).replace(/[$"]/g, '')}"></canvas></div>
    <p class="anim-swipe">↔ ${t(UI.scrollHint)}</p>
    <div class="anim-controls"></div>
    <div class="anim-readout" aria-live="polite"></div>
    ${def.hint ? `<p class="anim-hint">${formula(t(def.hint))}</p>` : ''}`;
  host.appendChild(fig);

  const cv = fig.querySelector('canvas');
  const controls = fig.querySelector('.anim-controls');
  const readoutEl = fig.querySelector('.anim-readout');
  const playBtn = fig.querySelector('[data-act="play"]');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = W * dpr;
  cv.height = H * dpr;
  cv.style.aspectRatio = `${W} / ${H}`;
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  let playing = !reducedMotion();
  let raf = 0;
  let destroyed = false;
  let frame = null;
  let visible = true;
  let simTime = 0;
  let last = 0;
  const cleanups = [];

  const paintPlay = () => {
    playBtn.textContent = playing ? '❚❚' : '▶';
    const label = t(playing ? UI.pause : UI.play);
    playBtn.setAttribute('aria-label', label);
    playBtn.title = label;
  };
  paintPlay();
  playBtn.addEventListener('click', () => { playing = !playing; paintPlay(); });

  const fail = (err) => {
    // eslint-disable-next-line no-console
    console.error(`[anim ${def.id}]`, err);
    cancelAnimationFrame(raf);
    readoutEl.textContent = t(UI.animError);
  };

  const tick = (now) => {
    if (destroyed) return;
    raf = requestAnimationFrame(tick);
    const dtReal = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    if (!visible || !frame) return;
    const dt = playing ? dtReal : 0;
    simTime += dt;
    try { frame(dt, simTime); } catch (err) { fail(err); }
  };

  const io = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }, { rootMargin: '120px' })
    : null;
  if (io) io.observe(cv);

  const label = (v) => formula(t(v));

  const st = {
    W, H, ctx, cv, C, lang,
    D: makeDraw(ctx, C, W, H),
    /** Pick the current language: st.t({ de: '…', en: '…' }) */
    t,
    num: (v, digits) => num(v, digits, lang),
    fix: (v, decimals) => fix(v, decimals, lang),
    si: (v, unit, digits) => si(v, unit, digits, lang),

    slider(o) {
      const wrap = el('label', 'ctl');
      const decimals = o.step && o.step < 1 ? (String(o.step).split('.')[1] || '').length : 0;
      const fmt = o.fmt || ((v) => `${fix(v, decimals, lang)}${o.unit ? ` ${o.unit}` : ''}`);
      wrap.innerHTML = `<span class="ctl-l">${label(o.label)}</span><input type="range" min="${o.min}" max="${o.max}" step="${o.step || 1}" value="${o.value}"><output></output>`;
      const inp = wrap.querySelector('input');
      const out = wrap.querySelector('output');
      const show = () => { out.innerHTML = fmt(Number(inp.value)); };
      inp.addEventListener('input', () => { show(); if (o.on) o.on(Number(inp.value)); });
      show();
      controls.appendChild(wrap);
      return {
        get value() { return Number(inp.value); },
        set(v) { inp.value = v; show(); },
        min: o.min, max: o.max,
      };
    },

    select(o) {
      const seg = el('div', 'seg');
      seg.setAttribute('role', 'group');
      if (o.label) {
        seg.setAttribute('aria-label', String(t(o.label)).replace(/[$]/g, ''));
        seg.appendChild(el('span', 'seg-l', label(o.label)));
      }
      let value = o.value !== undefined ? o.value : o.options[0].v;
      const btns = o.options.map((opt) => {
        const b = el('button', '', label(opt.label));
        b.type = 'button';
        b.dataset.v = String(opt.v);
        b.addEventListener('click', () => { value = opt.v; paint(); if (o.on) o.on(value); });
        seg.appendChild(b);
        return b;
      });
      const paint = () => btns.forEach((b) => {
        const on = b.dataset.v === String(value);
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', String(on));
      });
      paint();
      controls.appendChild(seg);
      return { get value() { return value; }, set(v) { value = v; paint(); }, options: o.options.map((x) => x.v) };
    },

    toggle(o) {
      const wrap = el('label', 'chk');
      wrap.innerHTML = `<input type="checkbox"${o.value ? ' checked' : ''}><span>${label(o.label)}</span>`;
      const inp = wrap.querySelector('input');
      inp.addEventListener('change', () => { if (o.on) o.on(inp.checked); });
      controls.appendChild(wrap);
      return { get value() { return inp.checked; }, set(v) { inp.checked = Boolean(v); } };
    },

    button(text, fn, cls = '') {
      const b = el('button', `btn sm ${cls}`.trim(), label(text));
      b.type = 'button';
      b.addEventListener('click', () => { try { fn(b); } catch (err) { fail(err); } });
      controls.appendChild(b);
      return { el: b, label(v) { b.innerHTML = label(v); }, click() { fn(b); } };
    },

    /** HTML line under the canvas. Formula markup ($…$) is allowed. */
    readout: (() => {
      let lastHtml = null;
      return (html) => { if (html !== lastHtml) { lastHtml = html; readoutEl.innerHTML = formula(html); } };
    })(),

    /** Register the frame function: fn(dt, time). dt is 0 while the animation is paused. */
    loop(fn) { frame = fn; },

    /** Pointer handlers in canvas coordinates: { down(x, y), move(x, y), up(x, y) }. */
    pointer(hd) {
      cv.style.touchAction = 'none';
      cv.style.cursor = 'grab';
      const pos = (e) => {
        const r = cv.getBoundingClientRect();
        return [((e.clientX - r.left) * W) / r.width, ((e.clientY - r.top) * H) / r.height];
      };
      let held = false;
      const down = (e) => { held = true; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; if (hd.down) hd.down(...pos(e)); };
      const move = (e) => { if (hd.move) hd.move(...pos(e), held); };
      const up = (e) => { held = false; cv.style.cursor = 'grab'; if (hd.up) hd.up(...pos(e)); };
      cv.addEventListener('pointerdown', down);
      cv.addEventListener('pointermove', move);
      cv.addEventListener('pointerup', up);
      cv.addEventListener('pointercancel', up);
    },

    get playing() { return playing; },
    play() { playing = true; paintPlay(); },
    onCleanup(fn) { cleanups.push(fn); },
  };

  const start = () => {
    controls.innerHTML = '';
    frame = null;
    simTime = 0;
    try { def.build(st); } catch (err) { fail(err); return; }
    // draw one frame right away so a paused animation is not blank
    try { if (frame) frame(0, 0); } catch (err) { fail(err); }
  };

  fig.querySelector('[data-act="reset"]').addEventListener('click', start);
  const offTheme = onTheme(() => { try { if (frame) frame(0, simTime); } catch (err) { fail(err); } });

  start();
  raf = requestAnimationFrame(tick);

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      if (io) io.disconnect();
      offTheme();
      cleanups.forEach((fn) => fn());
      fig.remove();
    },
  };
}
