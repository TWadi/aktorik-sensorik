import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  K_B, Q_E, PHOTODIODE, thermalVoltage, photoCurrent, diodeCurrent, openCircuitVoltage, shortCircuitCurrent,
  bisect, photovoltaicPoint, photodiodePoint, e12, beamCover, blockedLength,
} from '../js/physics/photo.js';

const near = (a, b, rel = 1e-3) => assert.ok(Math.abs(a - b) <= Math.abs(b) * rel + 1e-15, `${a} is not close to ${b}`);
const round = (v, decimals) => Number(v.toFixed(decimals));

test('constants and thermal voltage: 25.85 mV at 300 K', () => {
  near(K_B, 1.380649e-23, 1e-9);
  near(Q_E, 1.602176634e-19, 1e-9);
  assert.deepEqual({ ...PHOTODIODE }, { Is: 10e-9, n: 1, T: 300, sens: 0.1e-6 });
  near(thermalVoltage(300), 25.852e-3, 1e-4);
  assert.equal(round(thermalVoltage() * 1000, 2), 25.85);
});

test('photocurrent: 0.1 µA per lux', () => {
  near(photoCurrent(500), 50e-6, 1e-12);
  near(photoCurrent(1000), 100e-6, 1e-12);
  near(photoCurrent(300), 30e-6, 1e-12); // quiz
  assert.equal(photoCurrent(0), 0);
  assert.equal(photoCurrent(-5), 0);
});

test('dark curve: 0.469 µA at +0.1 V, −I_s far in reverse', () => {
  near(0.1 / thermalVoltage(), 3.868, 1e-4); // the exponent in the example
  near(diodeCurrent(0.1), 0.4685e-6, 1e-3);
  assert.equal(round(diodeCurrent(0.1) * 1e6, 3), 0.469);
  assert.equal(diodeCurrent(0), 0);
  near(diodeCurrent(-2), -PHOTODIODE.Is, 1e-9);
});

test('light shifts the whole curve down by I_Ph', () => {
  for (const U of [-2, -0.5, 0, 0.1, 0.2]) near(diodeCurrent(U, 50e-6) - diodeCurrent(U), -50e-6, 1e-12);
  near(diodeCurrent(0, 50e-6), -50e-6, 1e-12);
  near(diodeCurrent(-2, 50e-6), -50.01e-6, 1e-6);
});

test('the diode equation stays finite for absurd voltages', () => {
  for (const U of [-1e6, -5, 5, 100, 1e6]) assert.ok(Number.isFinite(diodeCurrent(U, 1e-4)));
});

test('open circuit and short circuit: 0.220 V and −50 µA at I_Ph = 50 µA', () => {
  near(openCircuitVoltage(50e-6), 0.22019, 1e-4);
  assert.equal(round(openCircuitVoltage(50e-6), 3), 0.22);
  near(Math.log(50e-6 / 10e-9 + 1), Math.log(5001), 1e-9); // ln(5001) in the example
  assert.ok(Math.abs(diodeCurrent(openCircuitVoltage(50e-6), 50e-6)) < 1e-12);
  assert.equal(shortCircuitCurrent(50e-6), -50e-6);
  assert.equal(shortCircuitCurrent(0), 0);
  assert.ok(Object.is(shortCircuitCurrent(0), 0), 'no negative zero');
  assert.equal(openCircuitVoltage(0), 0);
  assert.equal(openCircuitVoltage(-1), 0);
});

test('double light: I_K doubles, U_L rises by only 18 mV', () => {
  near(openCircuitVoltage(100e-6), 0.23811, 1e-4);
  assert.equal(round((openCircuitVoltage(100e-6) - openCircuitVoltage(50e-6)) * 1000, 0), 18);
  assert.equal(shortCircuitCurrent(100e-6), 2 * shortCircuitCurrent(50e-6));
});

test('bisection finds the root of a rising function', () => {
  near(bisect((x) => x * x - 2, 0, 2), Math.SQRT2, 1e-12);
  assert.equal(bisect((x) => x, 0, 0), 0);
  near(bisect((x) => x - 0.3, 0, 1, 10), 0.3, 5e-3);
});

test('photovoltaic mode with 4.7 kΩ: 0.182 V, −38.7 µA, 7.0 µW', () => {
  const op = photovoltaicPoint(50e-6, 4700);
  near(op.U, 0.18180, 1e-4);
  near(op.I, -38.68e-6, 1e-3);
  near(op.P, 7.032e-6, 1e-3);
  assert.equal(round(op.U, 3), 0.182);
  assert.equal(round(op.I * 1e6, 1), -38.7);
  assert.equal(round(op.P * 1e6, 1), 7);
  // the point lies on the diode curve and on the load line
  near(diodeCurrent(op.U, 50e-6), op.I, 1e-9);
  near(op.P, op.U * -op.I, 1e-12);
});

test('photovoltaic mode: limits and the best load', () => {
  const short = photovoltaicPoint(50e-6, 1);
  near(short.I, -50e-6, 1e-3); // almost short circuit
  const open = photovoltaicPoint(50e-6, 1e9);
  near(open.U, openCircuitVoltage(50e-6), 1e-3); // almost open circuit
  const dark = photovoltaicPoint(0, 4700);
  assert.deepEqual(dark, { U: 0, I: 0, P: 0 });
  // among the E12 values the power peaks at 3.9 kΩ with 7.29 µW
  const powers = Array.from({ length: 37 }, (_, k) => [e12(k), photovoltaicPoint(50e-6, e12(k)).P]);
  const best = powers.reduce((a, b) => (b[1] > a[1] ? b : a));
  assert.equal(best[0], 3900);
  near(best[1], 7.286e-6, 1e-3);
});

test('photodiode mode: the current equals −I_Ph and the signal is R·I_Ph', () => {
  const op = photodiodePoint(50e-6, 10e3, 5);
  near(op.I, -50.01e-6, 1e-4);
  near(op.UR, 0.5001, 1e-4); // "0.5 V" in the text
  near(op.U, -4.4999, 1e-4); // "−4.5 V" in the text
  assert.equal(op.saturated, false);
  near(diodeCurrent(op.U, 50e-6), op.I, 1e-9);
  // linear in the light
  near(photodiodePoint(100e-6, 10e3, 5).UR, 2 * op.UR, 1e-3);
  // quiz: 300 lx on 20 kΩ gives 0.6 V
  near(photodiodePoint(photoCurrent(300), 20e3, 5).UR, 0.6, 1e-3);
});

test('photodiode mode saturates when R·I_Ph exceeds the supply', () => {
  const op = photodiodePoint(100e-6, 100e3, 5); // would need 10 V
  assert.equal(op.saturated, true);
  assert.ok(op.U > 0 && op.U < openCircuitVoltage(100e-6));
  assert.ok(op.UR < 5.3 && Math.abs(op.I) < 100e-6);
  near(diodeCurrent(op.U, 100e-6), op.I, 1e-6);
  // in the dark only the reverse current flows
  const dark = photodiodePoint(0, 10e3, 5);
  near(dark.I, -10e-9, 1e-3);
  assert.equal(dark.saturated, false);
});

test('E12 resistor steps from 100 Ω to 100 kΩ', () => {
  assert.equal(e12(0), 100);
  assert.equal(e12(8), 470);
  assert.equal(e12(12), 1000);
  assert.equal(e12(20), 4700);
  assert.equal(e12(24), 10000);
  assert.equal(e12(28), 22000);
  assert.equal(e12(36), 100000);
  assert.equal(e12(-3), 100);
  assert.equal(e12(0, 1000), 1000);
  for (let k = 1; k <= 36; k++) assert.ok(e12(k) > e12(k - 1));
});

test('light barrier: beam cover and length from the dark time', () => {
  assert.equal(beamCover(0, 10, 50, 4), 0); // box before the beam
  assert.equal(beamCover(40, 60, 50, 4), 1); // box over the whole beam
  assert.equal(beamCover(50, 60, 50, 4), 0.5); // edge in the middle of the beam
  assert.equal(beamCover(60, 90, 50, 4), 0); // box behind the beam
  near(blockedLength(0.25, 0.4), 0.1, 1e-12); // quiz: 10 cm
  near(blockedLength(0.2, 0.4), 0.08, 1e-12);
});
