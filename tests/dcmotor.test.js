import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXAMPLE_MOTOR as P, steadyState, noLoadSpeed, noLoadCurrent, stallTorque, stallCurrent, loadTorqueAt, powerAt,
  speedOfMaxPower, maxPower, timeConstants, speedGain, poles, inductanceNegligible, stepMotor, stepMotorNoL,
  stepCurrentDriven, toRpm, fromRpm,
} from '../js/physics/dcmotor.js';

const near = (a, b, rel = 1e-3) => assert.ok(Math.abs(a - b) <= Math.abs(b) * rel + 1e-12, `${a} is not close to ${b}`);

test('no-load operating point of the example motor at 12 V', () => {
  const op = steadyState(P, 12, 0);
  near(op.w, 487.31);
  near(op.i, 0.060914);
  near(noLoadSpeed(P, 12), op.w, 1e-12);
  near(noLoadCurrent(P, 12), op.i, 1e-12);
  near(toRpm(op.w), 4653.4);
});

test('operating point with 20 mNm load', () => {
  const op = steadyState(P, 12, 0.02);
  near(op.i, 0.87310);
  near(op.w, 318.10);
});

test('the operating point satisfies both model equations', () => {
  for (const [U, Ml] of [[12, 0], [9, 0.01], [5, 0.004], [12, 0.05]]) {
    const { i, w } = steadyState(P, U, Ml);
    near(P.R * i + P.ke * w, U, 1e-9);
    assert.ok(Math.abs(P.km * i - P.Cr * w - Ml) < 1e-12);
  }
});

test('stall values and characteristic line', () => {
  near(stallTorque(P, 12), 0.0576);
  near(stallCurrent(P, 12), 2.4);
  near(loadTorqueAt(P, 12, 0), stallTorque(P, 12), 1e-12);
  assert.ok(Math.abs(loadTorqueAt(P, 12, noLoadSpeed(P, 12))) < 1e-12);
  near(loadTorqueAt(P, 12, steadyState(P, 12, 0.02).w), 0.02, 1e-9);
});

test('power balance closes exactly (k_e = k_m)', () => {
  const w = 300;
  const pw = powerAt(P, 12, w);
  near(pw.pel, pw.pmech + pw.pheat + pw.pfric, 1e-12);
  assert.ok(pw.eta > 0 && pw.eta < 1);
});

test('maximum useful power sits at half the no-load speed', () => {
  const w = speedOfMaxPower(P, 12);
  near(w, noLoadSpeed(P, 12) / 2, 1e-12);
  near(powerAt(P, 12, w).pmech, maxPower(P, 12), 1e-9);
  assert.ok(powerAt(P, 12, w * 0.9).pmech < maxPower(P, 12));
  assert.ok(powerAt(P, 12, w * 1.1).pmech < maxPower(P, 12));
  near(maxPower(P, 12), 7.0173, 1e-3);
});

test('time constants, gain and poles', () => {
  const tc = timeConstants(P);
  near(tc.tauE, 80e-6);
  near(tc.tauM, 1);
  near(tc.tau, 0.025381);
  near(speedGain(P), 40.609);
  const [fast, slow] = poles(P);
  near(fast[0], -12461.5);
  near(slow[0], -39.52);
  assert.equal(fast[1], 0);
  assert.equal(inductanceNegligible(P), true);
  // complex pole pair when the inertia is tiny
  const [p1, p2] = poles({ ...P, J: 1e-9 });
  assert.ok(p1[1] > 0 && p2[1] < 0);
  near(p1[0], p2[0], 1e-12);
});

// reference: classic RK4 with a very small step
function rk4(U, Ml, tEnd, h = 1e-7) {
  const f = (i, w) => [(U - P.R * i - P.ke * w) / P.L, (P.km * i - P.Cr * w - Ml) / P.J];
  let i = 0, w = 0;
  for (let t = 0; t < tEnd - h / 2; t += h) {
    const [a1, b1] = f(i, w);
    const [a2, b2] = f(i + (a1 * h) / 2, w + (b1 * h) / 2);
    const [a3, b3] = f(i + (a2 * h) / 2, w + (b2 * h) / 2);
    const [a4, b4] = f(i + a3 * h, w + b3 * h);
    i += (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
    w += (h / 6) * (b1 + 2 * b2 + 2 * b3 + b4);
  }
  return { i, w };
}

test('stepMotor matches a fine RK4 integration', () => {
  const ref = rk4(12, 0.005, 1e-3);
  // one big step, and many small steps, must both land on the same point
  const one = stepMotor({ i: 0, w: 0, phi: 0 }, { U: 12, Ml: 0.005 }, P, 1e-3);
  near(one.i, ref.i, 1e-4);
  near(one.w, ref.w, 1e-4);
  let s = { i: 0, w: 0, phi: 0 };
  for (let k = 0; k < 50; k++) s = stepMotor(s, { U: 12, Ml: 0.005 }, P, 2e-5);
  near(s.i, ref.i, 1e-4);
  near(s.w, ref.w, 1e-4);
});

test('stepMotor converges to the operating point and never exceeds U/R', () => {
  let s = { i: 0, w: 0, phi: 0 };
  let peak = 0;
  for (let k = 0; k < 4000; k++) { s = stepMotor(s, { U: 12, Ml: 0.01 }, P, 1e-4); peak = Math.max(peak, s.i); }
  const op = steadyState(P, 12, 0.01);
  near(s.i, op.i, 1e-6);
  near(s.w, op.w, 1e-6);
  assert.ok(peak < stallCurrent(P, 12));
  assert.ok(peak > 2.2);
  assert.ok(s.phi > 0);
});

test('stepMotor does not change its input and ignores dt = 0', () => {
  const s0 = Object.freeze({ i: 0.1, w: 10, phi: 1 });
  const s1 = stepMotor(s0, { U: 12, Ml: 0 }, P, 0);
  assert.deepEqual(s1, { i: 0.1, w: 10, phi: 1 });
  assert.notEqual(s1, s0);
  stepMotor(s0, { U: 12, Ml: 0 }, P, 1e-3);
  assert.deepEqual(s0, { i: 0.1, w: 10, phi: 1 });
});

test('stepMotor stays finite for a tiny inductance (stiff case)', () => {
  let s = { i: 0, w: 0, phi: 0 };
  for (let k = 0; k < 200; k++) s = stepMotor(s, { U: 12, Ml: 0 }, { ...P, L: 0 }, 1e-3);
  assert.ok(Number.isFinite(s.i) && Number.isFinite(s.w));
  near(s.w, noLoadSpeed(P, 12), 1e-3);
});

test('model without inductance reaches 63.2 % after one time constant', () => {
  const { tau } = timeConstants(P);
  const s = stepMotorNoL({ i: 0, w: 0, phi: 0 }, { U: 12, Ml: 0 }, P, tau);
  near(s.w / noLoadSpeed(P, 12), 1 - Math.exp(-1), 1e-9);
  near(s.i, (12 - P.ke * s.w) / P.R, 1e-12);
  assert.deepEqual(stepMotorNoL({ i: 1, w: 2, phi: 3 }, { U: 12, Ml: 0 }, P, 0), { i: 1, w: 2, phi: 3 });
});

test('current-driven motor: ramp towards k_m·i/C_r with time constant J/C_r', () => {
  const s = stepCurrentDriven({ i: 0, w: 0, phi: 0 }, { i: 0.4, Ml: 0 }, P, 1);
  near(s.w, ((P.km * 0.4) / P.Cr) * (1 - Math.exp(-1)), 1e-9);
  assert.equal(s.i, 0.4);
  assert.deepEqual(stepCurrentDriven({ i: 1, w: 2, phi: 3 }, { i: 0.4, Ml: 0 }, P, 0), { i: 1, w: 2, phi: 3 });
});

test('rpm conversion round trip', () => {
  near(fromRpm(toRpm(123.4)), 123.4, 1e-12);
  near(toRpm(2 * Math.PI), 60, 1e-12);
});
