import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MU0, wireForce, lorentzForce, wireField, reluctanceForce, lagStep, inducedVoltage, MAGNET_COIL, coilFlux,
  coilFluxSlope, magnetVoltage, DEMO_LOOP, wrapAngle, loopPeakTorque, loopTorque, loopMeanTorque, loopCurrentSign,
  stepLoopRotor, coilAngle, coilTorque, multiCoilTorque, torqueRipple,
} from '../js/physics/emag.js';
import { EXAMPLE_MOTOR } from '../js/physics/dcmotor.js';

const near = (a, b, rel = 1e-9) => assert.ok(Math.abs(a - b) <= Math.abs(b) * rel + 1e-12, `${a} is not close to ${b}`);
const deg = (d) => (d * Math.PI) / 180;

// ---------------------------------------------------------------- A02: force on a wire

test('force on a wire: worked example and quiz', () => {
  near(wireForce(0.5, 2, 0.05), 0.05); // example: 0.5 T, 2 A, 5 cm -> 0.05 N = 50 mN
  near(wireForce(0.2, 4, 0.1), 0.08); // quiz: 0.2 T, 4 A, 10 cm -> 80 mN
  near(wireForce(1, 5, 0.1), 0.5); // largest force the animation can show
  assert.equal(wireForce(0.5, 0, 0.05), 0);
  assert.equal(wireForce(0, 2, 0.05), 0);
});

test('force doubles with each of the three quantities', () => {
  const F = wireForce(0.5, 2, 0.05);
  near(wireForce(1, 2, 0.05), 2 * F);
  near(wireForce(0.5, 4, 0.05), 2 * F);
  near(wireForce(0.5, 2, 0.1), 2 * F);
});

test('direction: reversing current or field reverses the force, reversing both does not', () => {
  near(wireForce(0.5, -2, 0.05), -0.05);
  near(wireForce(-0.5, 2, 0.05), -0.05);
  near(wireForce(-0.5, -2, 0.05), 0.05);
});

test('cross product form agrees with F = B·i·l and with the drawing', () => {
  // field to the right (+x), current towards the viewer (+z): the force points up (+y)
  const F = lorentzForce(2, [0, 0, 0.05], [0.5, 0, 0]);
  near(F[0], 0); near(F[1], wireForce(0.5, 2, 0.05)); near(F[2], 0);
  // current away from the viewer: the force points down
  near(lorentzForce(2, [0, 0, -0.05], [0.5, 0, 0])[1], -0.05);
  // wire parallel to the field: no force
  assert.deepEqual(lorentzForce(2, [0.05, 0, 0], [0.5, 0, 0]).map(Math.abs), [0, 0, 0]);
  // the force is perpendicular to wire and field
  const l = [0.01, 0.02, 0.03], B = [0.2, -0.1, 0.4];
  const G = lorentzForce(3, l, B);
  near(G[0] * l[0] + G[1] * l[1] + G[2] * l[2], 0);
  near(G[0] * B[0] + G[1] * B[1] + G[2] * B[2], 0);
});

test('field of a straight wire and reluctance force: table examples', () => {
  near(MU0, 1.2566370614e-6, 1e-9);
  near(wireField(10, 0.01), 2e-4); // 10 A at 1 cm -> 0.2 mT
  near(wireField(10, 0.02), 1e-4); // twice the distance, half the field
  near(reluctanceForce(1, 0.5), 0.25); // 1 A and 0.5 H/m -> 0.25 N
  near(reluctanceForce(-1, 0.5), 0.25); // the direction does not depend on the sign of the current
  near(reluctanceForce(2, 0.5), 1);
});

test('first-order lag moves towards the target and never jumps over it', () => {
  assert.equal(lagStep(3, 10, 0.25, 0), 3); // paused frame
  near(lagStep(0, 10, 0.25, 0.25), 10 * (1 - Math.exp(-1)));
  near(lagStep(0, 10, 0.25, 100), 10);
  let v = 0;
  for (let k = 0; k < 60; k++) { const next = lagStep(v, 10, 0.25, 1 / 60); assert.ok(next > v && next < 10); v = next; }
  near(v, 10 * (1 - Math.exp(-4)), 1e-9);
});

// ---------------------------------------------------------------- A02: induction

test('induction law: table example, no change no voltage', () => {
  near(inducedVoltage(200, 50e-6 / 0.1), -0.1); // 200 turns, +50 µWb in 0.1 s -> −0.1 V
  near(inducedVoltage(200, -50e-6 / 0.1), 0.1); // falling flux: the other sign
  near(inducedVoltage(400, 50e-6 / 0.1), -0.2); // twice the turns, twice the voltage
  assert.equal(inducedVoltage(200, 0), 0);
});

test('flux bell: peak, symmetry, slope', () => {
  const { phi0, a } = MAGNET_COIL;
  near(phi0, 50e-6);
  near(coilFlux(0, phi0, a), phi0);
  near(coilFlux(0.02, phi0, a), coilFlux(-0.02, phi0, a));
  assert.ok(coilFlux(0.09, phi0, a) < 0.04 * phi0, 'far away the flux is almost zero');
  assert.equal(Math.abs(coilFluxSlope(0, phi0, a)), 0);
  for (const x of [-0.08, -0.03, -0.015, 0.004, 0.02, 0.07]) {
    const hx = 1e-7;
    const numeric = (coilFlux(x + hx, phi0, a) - coilFlux(x - hx, phi0, a)) / (2 * hx);
    near(coilFluxSlope(x, phi0, a), numeric, 1e-5);
  }
  // steepest at x = ∓a/2
  const peak = Math.abs(coilFluxSlope(a / 2, phi0, a));
  near(peak, (0.858650 * phi0) / a, 1e-5);
  assert.ok(Math.abs(coilFluxSlope(0.4 * a, phi0, a)) < peak && Math.abs(coilFluxSlope(0.6 * a, phi0, a)) < peak);
});

test('moving magnet: zero at rest and at the coil centre, sign flips with direction and side', () => {
  const { phi0, a } = MAGNET_COIL;
  assert.equal(magnetVoltage(300, 0.01, 0, phi0, a), 0); // magnet at rest, even inside the coil
  assert.equal(magnetVoltage(300, 0, 0.3, phi0, a), 0); // passing the centre: flux at its maximum
  const approaching = magnetVoltage(300, -0.02, 0.3, phi0, a); // flux rises
  assert.ok(approaching < 0);
  near(magnetVoltage(300, 0.02, 0.3, phi0, a), -approaching); // leaving: flux falls
  near(magnetVoltage(300, -0.02, -0.3, phi0, a), -approaching); // reversing
  near(magnetVoltage(600, -0.02, 0.3, phi0, a), 2 * approaching); // twice the turns
  near(magnetVoltage(300, -0.02, 0.6, phi0, a), 2 * approaching); // twice the speed
  // U = −N·dΦ/dt along a real path x(t) = v·t
  const v = 0.25, t0 = -0.06, dtt = 1e-6;
  const dPhiDt = (coilFlux(v * (t0 + dtt), phi0, a) - coilFlux(v * (t0 - dtt), phi0, a)) / (2 * dtt);
  near(magnetVoltage(300, v * t0, v, phi0, a), inducedVoltage(300, dPhiDt), 1e-5);
});

test('the induction animation stays inside its ±500 mV scale', () => {
  const { phi0, a } = MAGNET_COIL;
  const amp = 0.09, f = 1, N = 500; // largest slider values
  let top = 0;
  for (let k = 0; k < 4000; k++) {
    const ph = (2 * Math.PI * k) / 4000;
    top = Math.max(top, Math.abs(magnetVoltage(N, amp * Math.sin(ph), amp * 2 * Math.PI * f * Math.cos(ph), phi0, a)));
  }
  assert.ok(top > 0.3 && top < 0.5, `auto mode peak ${top} V`);
  const hand = Math.abs(magnetVoltage(N, a / 2, 0.6, phi0, a)); // fastest hand motion at the steepest point
  assert.ok(hand < 0.5, `hand mode peak ${hand} V`);
});

// ---------------------------------------------------------------- A03: one loop

test('torque of one loop: worked example and quiz', () => {
  near(loopPeakTorque(DEMO_LOOP, 2), 0.002); // 2 cm, 5 cm, 0.5 T, 2 A -> 2 mNm
  near(loopTorque(deg(90), DEMO_LOOP, 2), 0.002);
  near(loopTorque(deg(30), DEMO_LOOP, 2), 0.001); // 1 mNm at 30°
  near(loopTorque(0, DEMO_LOOP, 2), 0); // on the neutral axis
  near(loopPeakTorque(DEMO_LOOP, 3), 0.003); // top of the plot scale
  near(loopTorque(deg(30), { r: 0.03, l: 0.04, B: 0.4 }, 5), 0.0024); // quiz: 2.4 mNm
});

test('M = 2·r·l·B·i·sin θ follows from two conductor forces and their lever arm', () => {
  const { r, l, B } = DEMO_LOOP, i = 2;
  for (const d of [0, 20, 90, 135, 200, 300]) {
    const th = deg(d);
    // conductor a sits at angle θ (clockwise from the top), its current flows away from the viewer
    const F = wireForce(B, i, l); // magnitude, always vertical
    const lever = r * Math.sin(th); // horizontal distance from the axis
    near(loopTorque(th, DEMO_LOOP, i), 2 * F * lever);
  }
});

test('commutator: the torque keeps its sign, the current flips every half turn', () => {
  near(loopTorque(deg(270), DEMO_LOOP, 2, false), -0.002);
  near(loopTorque(deg(270), DEMO_LOOP, 2, true), 0.002);
  for (let d = 0; d <= 360; d += 7) {
    const plain = loopTorque(deg(d), DEMO_LOOP, 1.5, false), comm = loopTorque(deg(d), DEMO_LOOP, 1.5, true);
    assert.ok(comm >= 0);
    near(comm, Math.abs(plain));
    near(comm, plain * loopCurrentSign(deg(d), true)); // same formula, flipped current
    assert.equal(loopCurrentSign(deg(d), false), 1);
  }
  assert.equal(loopCurrentSign(deg(90), true), 1);
  assert.equal(loopCurrentSign(deg(270), true), -1);
  assert.equal(loopCurrentSign(deg(270)), 1);
});

test('mean torque over a turn: (2/π)·M0 with commutator, zero without', () => {
  const n = 3600;
  let sumPlain = 0, sumComm = 0;
  for (let k = 0; k < n; k++) {
    sumPlain += loopTorque((2 * Math.PI * k) / n, DEMO_LOOP, 2, false);
    sumComm += loopTorque((2 * Math.PI * k) / n, DEMO_LOOP, 2, true);
  }
  near(loopMeanTorque(DEMO_LOOP, 2, true), sumComm / n, 1e-6);
  assert.ok(Math.abs(sumPlain / n) < 1e-12);
  assert.equal(loopMeanTorque(DEMO_LOOP, 2, false), 0);
  assert.equal(loopMeanTorque(DEMO_LOOP, 2), 0);
  near(loopMeanTorque(DEMO_LOOP, 2, true) / loopPeakTorque(DEMO_LOOP, 2), 2 / Math.PI);
  assert.equal((2 / Math.PI).toFixed(2), '0.64'); // "≈ 0.64·M0" in the text
  assert.equal((loopMeanTorque(DEMO_LOOP, 2, true) * 1000).toFixed(2), '1.27'); // worked example, mNm
});

test('wrapAngle keeps angles in 0 … 2π', () => {
  near(wrapAngle(7), 7 - 2 * Math.PI);
  near(wrapAngle(-1), 2 * Math.PI - 1);
  assert.equal(wrapAngle(0), 0);
  for (const a of [-50, -1e-17, 0, 3, 6.3, 1e6]) assert.ok(wrapAngle(a) >= 0 && wrapAngle(a) < 2 * Math.PI + 1e-12);
});

test('rotor without commutator swings and comes to rest at θ = 180°', () => {
  let s = { theta: deg(60), w: 0 };
  let turnedBack = false;
  for (let k = 0; k < 60 * 40; k++) {
    const next = stepLoopRotor(s, DEMO_LOOP, 1.5, false, 1 / 60);
    if (next.w < 0) turnedBack = true;
    s = next;
  }
  assert.ok(turnedBack, 'it should swing back at least once');
  near(s.theta, Math.PI, 1e-3);
  assert.ok(Math.abs(s.w) < 1e-3);
});

test('rotor with commutator keeps turning, faster with more current', () => {
  const run = (i) => {
    let s = { theta: deg(60), w: 0 };
    let sum = 0, count = 0, lowest = Infinity;
    for (let k = 0; k < 60 * 30; k++) {
      s = stepLoopRotor(s, DEMO_LOOP, i, true, 1 / 60);
      if (k >= 60 * 15) { sum += s.w; count += 1; lowest = Math.min(lowest, s.w); }
    }
    return { mean: sum / count, lowest };
  };
  const slow = run(1.5), fast = run(3);
  assert.ok(slow.lowest > 0 && fast.lowest > 0, 'the speed never changes sign');
  assert.ok(fast.mean > 1.8 * slow.mean);
  // friction balances the mean torque
  near(slow.mean, loopMeanTorque(DEMO_LOOP, 1.5, true) / DEMO_LOOP.c, 0.06);
  near(fast.mean, loopMeanTorque(DEMO_LOOP, 3, true) / DEMO_LOOP.c, 0.06);
  assert.ok(fast.mean < 9, 'slow enough to watch, below the speed limit of the animation');
});

test('rotor step: paused frame, pure state, dead point, no current', () => {
  const s0 = Object.freeze({ theta: 1, w: 2 });
  assert.deepEqual(stepLoopRotor(s0, DEMO_LOOP, 2, true, 0), { theta: 1, w: 2 });
  assert.notEqual(stepLoopRotor(s0, DEMO_LOOP, 2, true, 0), s0);
  const dead = stepLoopRotor({ theta: 0, w: 0 }, DEMO_LOOP, 3, true, 1);
  assert.deepEqual(dead, { theta: 0, w: 0 }); // on the neutral axis nothing starts by itself
  let s = { theta: 1, w: 5 };
  for (let k = 0; k < 600; k++) s = stepLoopRotor(s, DEMO_LOOP, 0, true, 0.05);
  assert.ok(Math.abs(s.w) < 1e-6, 'without current friction stops the rotor');
  assert.ok(Number.isFinite(s.theta) && s.theta >= 0 && s.theta < 2 * Math.PI);
});

// ---------------------------------------------------------------- A03: several coils

test('several coils: angles, single shares and their sum', () => {
  near(coilAngle(0.3, 3, 0), 0.3);
  near(coilAngle(0.3, 3, 2), 0.3 + (2 * Math.PI) / 3);
  near(coilTorque(deg(90), 1, 0), 1);
  near(coilTorque(deg(30), 2, 1), Math.abs(Math.sin(deg(120))));
  for (const n of [1, 2, 3, 6]) {
    for (const d of [0, 11, 45, 100, 222, 359]) {
      let sum = 0;
      for (let k = 0; k < n; k++) sum += coilTorque(deg(d), n, k);
      near(multiCoilTorque(deg(d), n), sum);
      near(multiCoilTorque(deg(d) + Math.PI / n, n), sum, 1e-9); // one segment further looks the same
    }
  }
  near(multiCoilTorque(deg(77), 1), loopTorque(deg(77), DEMO_LOOP, 2, true) / loopPeakTorque(DEMO_LOOP, 2));
});

test('ripple: closed form agrees with a scan over one turn', () => {
  for (const n of [1, 2, 3, 4, 6, 12]) {
    let min = Infinity, max = -Infinity, sum = 0;
    const steps = 7200;
    for (let k = 0; k < steps; k++) {
      const m = multiCoilTorque((2 * Math.PI * k) / steps, n);
      min = Math.min(min, m); max = Math.max(max, m); sum += m;
    }
    const r = torqueRipple(n);
    near(r.mean, sum / steps, 1e-6);
    near(r.max, max, 1e-6);
    assert.ok(Math.abs(r.min - min) < 1e-9);
    near(r.ripple, (r.max - r.min) / r.mean);
  }
});

test('ripple numbers quoted on the sheet', () => {
  const pct = (v) => Math.round(v * 100);
  const one = (v) => (v * 100).toFixed(1);
  const r1 = torqueRipple(1), r2 = torqueRipple(2), r3 = torqueRipple(3), r6 = torqueRipple(6);
  // lowest point and peak relative to the mean
  assert.deepEqual([r1.min / r1.mean, r1.max / r1.mean].map(pct), [0, 157]);
  assert.deepEqual([r2.min / r2.mean, r2.max / r2.mean].map(pct), [79, 111]);
  assert.deepEqual([r3.min / r3.mean, r3.max / r3.mean].map(pct), [91, 105]);
  assert.deepEqual([r6.min / r6.mean, r6.max / r6.mean].map(pct), [98, 101]);
  // ripple = (max − min) / mean
  assert.equal(pct(r1.ripple), 157);
  assert.equal(one(r2.ripple), '32.5');
  assert.equal(one(r3.ripple), '14.0');
  assert.equal(one(r6.ripple), '3.4');
  near(r1.ripple, Math.PI / 2);
  // the mean per coil is always 2/π of its peak
  for (const r of [r1, r2, r3, r6]) assert.ok(r.max / r.mean < 1.8, 'fits the plot range of the animation');
  near(r1.mean, 2 / Math.PI); near(r2.mean, 4 / Math.PI); near(r3.mean, 6 / Math.PI); near(r6.mean, 12 / Math.PI);
  assert.equal(r3.mean.toFixed(2), '1.91');
});

test('k_e = k_m: electrical power equals mechanical power (example on the sheet)', () => {
  const { ke, km } = EXAMPLE_MOTOR;
  const i = 1, w = 100;
  near(km * i, 0.024); // torque in N·m
  near(ke * w, 2.4); // induced voltage in V
  near(ke * w * i, 2.4); // electrical power in W
  near(km * i * w, 2.4); // mechanical power in W
  assert.equal(ke, km);
});
