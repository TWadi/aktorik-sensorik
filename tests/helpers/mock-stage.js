// A stand-in for the animation stage (js/core/stage.js) that runs in Node without a DOM.
// It records every canvas call, so tests can catch NaN coordinates and thrown errors.

import { C } from '../../js/core/theme.js';
import { tr } from '../../js/core/i18n.js';
import { makeDraw } from '../../js/core/draw.js';
import { num, fix, si, formula } from '../../js/core/format.js';

export const STAGE_W = 760;

function makeCtx(problems) {
  const check = (name, args) => {
    args.forEach((a, k) => {
      if (typeof a === 'number' && !Number.isFinite(a)) problems.push(`ctx.${name}(arg ${k} = ${a})`);
    });
  };
  const target = { calls: 0 };
  return new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop];
      if (prop === 'measureText') return (s) => ({ width: String(s).length * 6.5 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop() {} });
      return (...args) => { obj.calls += 1; check(String(prop), args); };
    },
    set(obj, prop, value) {
      if (typeof value === 'number' && !Number.isFinite(value)) problems.push(`ctx.${String(prop)} = ${value}`);
      obj[prop] = value;
      return true;
    },
  });
}

/**
 * Build an animation against the mock stage.
 * @returns {{frame: Function, sliders: Array, selects: Array, toggles: Array, buttons: Array,
 *            pointer: object|null, problems: string[], readouts: string[], ctx: object}}
 */
export function mountMock(def, lang = 'de') {
  const problems = [];
  const readouts = [];
  const ctx = makeCtx(problems);
  const H = def.height || 400;
  const out = { frame: null, sliders: [], selects: [], toggles: [], buttons: [], pointer: null, problems, readouts, ctx };
  const t = (v) => tr(v, lang);
  let playing = true;

  const st = {
    W: STAGE_W, H, ctx, cv: { style: {} }, C, lang,
    D: makeDraw(ctx, C, STAGE_W, H),
    t,
    num: (v, d) => num(v, d, lang),
    fix: (v, d) => fix(v, d, lang),
    si: (v, unit, d) => si(v, unit, d, lang),
    slider(o) {
      if (!(o.min < o.max)) problems.push(`slider "${t(o.label)}": min must be below max`);
      if (!(o.value >= o.min && o.value <= o.max)) problems.push(`slider "${t(o.label)}": value outside min/max`);
      let value = o.value;
      const ctl = {
        get value() { return value; },
        set(v) { value = v; },
        min: o.min, max: o.max, step: o.step || 1, on: o.on, labelText: t(o.label),
        fmt: o.fmt || ((v) => `${fix(v, 1, lang)} ${o.unit || ''}`),
        drive(v) { value = v; if (o.on) o.on(v); },
      };
      out.sliders.push(ctl);
      return ctl;
    },
    select(o) {
      let value = o.value !== undefined ? o.value : o.options[0].v;
      o.options.forEach((opt) => formula(t(opt.label)));
      const ctl = {
        get value() { return value; },
        set(v) { value = v; },
        options: o.options.map((x) => x.v),
        drive(v) { value = v; if (o.on) o.on(v); },
      };
      out.selects.push(ctl);
      return ctl;
    },
    toggle(o) {
      let value = Boolean(o.value);
      const ctl = {
        get value() { return value; },
        set(v) { value = Boolean(v); },
        drive(v) { value = Boolean(v); if (o.on) o.on(value); },
      };
      out.toggles.push(ctl);
      return ctl;
    },
    button(text, fn) {
      const fake = { innerHTML: formula(t(text)) };
      const ctl = { el: fake, label(v) { fake.innerHTML = formula(t(v)); }, click() { fn(fake); } };
      out.buttons.push(ctl);
      return ctl;
    },
    readout(html) { readouts.push(formula(String(html))); },
    loop(fn) { out.frame = fn; },
    pointer(hd) { out.pointer = hd; },
    get playing() { return playing; },
    play() { playing = true; },
    onCleanup() {},
  };

  def.build(st);
  return out;
}
