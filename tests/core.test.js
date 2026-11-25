import { test } from 'node:test';
import assert from 'node:assert/strict';
import { num, fix, si, formula, runs } from '../js/core/format.js';
import { niceTicks, Trace, clamp, lerp } from '../js/core/draw.js';
import { tr } from '../js/core/i18n.js';
import { C, applyTheme, PALETTES } from '../js/core/theme.js';
import { parseNumber, isClose } from '../js/core/blocks.js';
import {
  polyval, polymul, polyadd, freqResponse, bode, logspace, margins, closeLoop, pt1Step, pt2Step, overshootOf,
  simulateTF, stepInfo, roots2,
} from '../js/physics/lti.js';
import { STRAIN_GAUGE, gaugeDeltaR, bridgeOut, bridgeApprox, bridgeResistors, bridgeFactor } from '../js/physics/bridge.js';
import { piStep, pStep } from '../js/physics/control.js';

const near = (a, b, rel = 1e-3) => assert.ok(Math.abs(a - b) <= Math.abs(b) * rel + 1e-12, `${a} is not close to ${b}`);

// ---------------------------------------------------------------- format
test('num: significant digits, decimal comma, powers of ten', () => {
  assert.equal(num(0.02346, 3, 'de'), '0,0235');
  assert.equal(num(0.02346, 3, 'en'), '0.0235');
  assert.equal(num(487.31, 3, 'de'), '487');
  assert.equal(num(-1.5, 3, 'de'), '−1,5');
  assert.equal(num(0, 3, 'de'), '0');
  assert.equal(num(3e-6, 2, 'de'), '3·10⁻⁶');
  assert.equal(num(2.5e7, 2, 'en'), '2.5·10⁷');
  assert.equal(num(NaN), '–');
});

test('fix and si', () => {
  assert.equal(fix(3.14159, 2, 'de'), '3,14');
  assert.equal(fix(-0.001, 1, 'de'), '0,0');
  assert.equal(fix(Infinity), '–');
  assert.equal(si(0.0125, 'A', 3, 'de'), '12,5 mA');
  assert.equal(si(2.4, 'A', 3, 'en'), '2.4 A');
  assert.equal(si(4.7e-6, 'F', 2, 'en'), '4.7 µF');
  assert.equal(si(12000, 'Hz', 3, 'en'), '12 kHz');
  assert.equal(si(0, 'V'), '0 V');
  assert.equal(si(-0.0025, 'V', 3, 'de'), '−2,5 mV');
  assert.equal(si(0.9999, 'V', 3, 'en'), '1 V');
  assert.equal(si(NaN, 'V'), '–');
  assert.equal(si(1e-15, 'F', 2, 'en'), '0.001 pF');
});

test('formula markup', () => {
  assert.equal(runs('U_a').length, 2);
  assert.deepEqual(runs('k_{em}^2'), [{ t: 'k' }, { t: 'em', sub: true }, { t: '2', sup: true }]);
  assert.match(formula('$U_a$'), /<span class="math"><i>U<\/i><sub><i>a<\/i><\/sub><\/span>/);
  assert.match(formula('$[[1|2]]$'), /class="frac"><span>1<\/span><span>2<\/span>/);
  assert.match(formula('$sin(x)$'), /sin\(<i>x<\/i>\)/);
  assert.equal(formula('plain <b>text</b>'), 'plain <b>text</b>');
  assert.equal(formula(null), '');
  assert.match(formula('$a < b$'), /&lt;/);
  assert.equal(runs('x_{open').length, 2); // unbalanced brace does not hang
});

test('draw helpers: ticks, trace, clamp, lerp', () => {
  assert.deepEqual(niceTicks(0, 10, 5), [0, 2, 4, 6, 8, 10]);
  assert.deepEqual(niceTicks(0, 1, 4), [0, 0.25, 0.5, 0.75, 1]);
  assert.deepEqual(niceTicks(5, 5), [5]);
  assert.ok(niceTicks(-1, 1, 4).includes(0));
  const tr2 = new Trace(3);
  [1, 2, 3, 4].forEach((v) => tr2.push(v, v * v));
  assert.deepEqual(tr2.pts, [[2, 4], [3, 9], [4, 16]]);
  assert.deepEqual(tr2.last, [4, 16]);
  tr2.clear();
  assert.equal(tr2.pts.length, 0);
  assert.equal(clamp(5, 0, 1), 1);
  assert.equal(lerp(0, 10, 0.3), 3);
});

test('i18n and theme', () => {
  assert.equal(tr({ de: 'a', en: 'b' }, 'en'), 'b');
  assert.equal(tr({ de: 'a' }, 'en'), 'a');
  assert.equal(tr('x', 'en'), 'x');
  assert.equal(tr(null), '');
  applyTheme('dark');
  assert.equal(C.paper, PALETTES.dark.paper);
  applyTheme('light');
  assert.equal(C.paper, PALETTES.light.paper);
  assert.deepEqual(Object.keys(PALETTES.light).sort(), Object.keys(PALETTES.dark).sort());
});

test('quiz number parsing', () => {
  assert.equal(parseNumber('0,48'), 0.48);
  assert.equal(parseNumber(' 2.4 '), 2.4);
  assert.equal(parseNumber('−3'), -3);
  assert.equal(parseNumber('4,8e-3'), 0.0048);
  assert.ok(Number.isNaN(parseNumber('abc')));
  assert.ok(Number.isNaN(parseNumber('')));
  assert.ok(Number.isNaN(parseNumber('1,2,3')));
  assert.ok(isClose(2.41, 2.4));
  assert.ok(!isClose(2.6, 2.4));
  assert.ok(!isClose(NaN, 2.4));
  assert.ok(isClose(0, 0));
});

// ---------------------------------------------------------------- lti
test('polynomials and frequency response', () => {
  assert.deepEqual(polymul([1, 1], [1, 2]), [1, 3, 2]);
  assert.deepEqual(polyadd([1, 0, 0], [2, 3]), [1, 2, 3]);
  assert.deepEqual(polyval([1, 3, 2], [-1, 0]), [0, 0]);
  const g = freqResponse([1], [1, 1], 1);
  near(g.mag, Math.SQRT1_2);
  near(g.phase, -Math.PI / 4);
});

test('bode: integrator starts at −90°, margins of 1/(s(s+1))', () => {
  const b = bode([1], [1, 1, 0], logspace(-3, 3, 400));
  near(b.deg[0], -90, 2e-3);
  near(b.deg[b.deg.length - 1], -180, 2e-3);
  const m = margins([1], [1, 1, 0]);
  near(m.wc, 0.7862, 2e-3);
  near(m.pm, 51.83, 2e-3);
  assert.equal(margins([0.1], [1, 1]), null);
});

test('bode: third-order lag unwraps down to −270°', () => {
  const b = bode([1], polymul(polymul([1, 1], [1, 1]), [1, 1]), logspace(-3, 4, 500));
  assert.ok(Math.abs(b.deg[0]) < 0.5);
  near(b.deg[b.deg.length - 1], -270, 5e-3);
});

test('step responses', () => {
  near(pt1Step(2, 0.5, 0.5), 2 * (1 - Math.exp(-1)));
  assert.equal(pt1Step(2, 0.5, -1), 0);
  near(overshootOf(0.5), 0.16303);
  assert.equal(overshootOf(1.2), 0);
  // peak of the D = 0.5 response equals 1 + overshoot
  const tp = Math.PI / (10 * Math.sqrt(1 - 0.25));
  near(pt2Step(1, 10, 0.5, tp), 1 + overshootOf(0.5), 1e-6);
  near(pt2Step(1, 10, 1, 100), 1, 1e-9);
  near(pt2Step(3, 10, 2, 100), 3, 1e-9);
  assert.equal(pt2Step(1, 10, 0.5, 0), 0);
  // all three damping branches agree near D = 1
  near(pt2Step(1, 10, 0.999999, 0.2), pt2Step(1, 10, 1, 0.2), 1e-5);
  near(pt2Step(1, 10, 1.000001, 0.2), pt2Step(1, 10, 1, 0.2), 1e-5);
});

test('simulateTF agrees with the analytic responses', () => {
  const a = simulateTF([2], [0.5, 1], () => 1, 2, 1e-3);
  near(a.y[a.y.length - 1], pt1Step(2, 0.5, 2), 1e-6);
  const b = simulateTF([100], [1, 10, 100], () => 1, 1, 1e-3);
  near(b.y[500], pt2Step(1, 10, 0.5, 0.5), 1e-6);
  // PD-like numerator with direct feed-through: (s + 2)/(s + 1) -> starts at 1, ends at 2
  const c = simulateTF([1, 2], [1, 1], () => 1, 10, 1e-3);
  near(c.y[0], 1);
  near(c.y[c.y.length - 1], 2, 1e-3);
  assert.throws(() => simulateTF([1], [1], () => 1, 1, 0.1));
  assert.throws(() => simulateTF([1, 0, 0], [1, 1], () => 1, 1, 0.1));
});

test('stepInfo and closeLoop', () => {
  const cl = closeLoop([100], [1, 10, 0]);
  assert.deepEqual(cl.den, [1, 10, 100]);
  const r = simulateTF(cl.num, cl.den, () => 1, 3, 1e-3);
  const info = stepInfo(r.t, r.y, 1);
  near(info.overshoot, overshootOf(0.5), 5e-3);
  near(info.tPeak, Math.PI / (10 * Math.sqrt(0.75)), 5e-3);
  assert.ok(info.tRise > 0.1 && info.tRise < 0.25);
  assert.deepEqual(roots2(1, 3, 2), [[-2, 0], [-1, 0]]);
  const [z1] = roots2(1, 2, 5);
  near(z1[0], -1); near(Math.abs(z1[1]), 2);
});

// ---------------------------------------------------------------- bridge
test('strain gauge bridge: quarter, half, full', () => {
  const { R, k } = STRAIN_GAUGE;
  const dR = gaugeDeltaR(R, k, 1e-3);
  near(dR, 0.7);
  const q = bridgeResistors('quarter', R, dR);
  near(bridgeOut(...q, 5), 2.4975e-3, 1e-4);
  near(bridgeApprox(dR, 0, 0, 0, R, 5), 2.5e-3);
  near(bridgeOut(...bridgeResistors('half', R, dR), 5), 5e-3, 1e-12);
  near(bridgeOut(...bridgeResistors('full', R, dR), 5), 10e-3, 1e-12);
  assert.equal(bridgeOut(R, R, R, R, 5), 0);
  assert.equal(bridgeFactor('half'), 0.5);
  // two equal changes on neighbours cancel
  assert.ok(Math.abs(bridgeOut(R + dR, R + dR, R, R, 5)) < 1e-15);
  near(bridgeOut(...bridgeResistors('full', R, gaugeDeltaR(R, k, 5e-4)), 10), 10e-3, 1e-12);
});

// ---------------------------------------------------------------- control
test('PI controller: integrates, saturates, anti-windup', () => {
  const cfg = { kp: 2, ti: 0.5, uMin: 0, uMax: 10 };
  const a = piStep({ integ: 0 }, 1, cfg, 0.1);
  near(a.integ, 0.1);
  near(a.u, 2 * (1 + 0.1 / 0.5));
  assert.equal(a.saturated, false);
  const b = piStep({ integ: 0 }, 100, cfg, 0.1);
  assert.equal(b.u, 10);
  assert.equal(b.integ, 0); // frozen while pushing into the limit
  assert.equal(b.saturated, true);
  const c = piStep({ integ: 5 }, -1, cfg, 0.1);
  near(c.integ, 4.9); // error pulls back: integrator is released
  const d = piStep({ integ: 0 }, -5, cfg, 0.1);
  assert.equal(d.u, 0);
  assert.equal(d.integ, 0);
  const free = piStep({ integ: 1 }, 1, { kp: 1, ti: 1 }, 1);
  near(free.u, 3);
  assert.equal(pStep(3, 2), 6);
  assert.equal(pStep(3, 2, -1, 1), 1);
});
