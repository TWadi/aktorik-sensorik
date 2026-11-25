import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Q_E, MU_0, CARRIERS, HALL_PLATE, hallConstant, hallVoltage, driftVelocity, hallField, hallVoltageFromDrift,
  wireField, pulseFrequency, speedFromFrequency, speedFromPeriod,
} from '../js/physics/hall.js';

const near = (a, b, rel = 1e-3) => assert.ok(Math.abs(a - b) <= Math.abs(b) * rel + 1e-30, `${a} is not close to ${b}`);
const P = HALL_PLATE;

test('constants', () => {
  near(Q_E, 1.602e-19);
  near(MU_0, 1.2566e-6, 1e-4);
  assert.equal(CARRIERS.semi, 1e22);
  assert.equal(CARRIERS.copper, 8.5e28);
  assert.deepEqual({ ...P }, { b: 2e-3, d: 0.1e-3, I: 10e-3, B: 0.1 });
});

test('example plate in a semiconductor: A_H = 6.24e-4 m³/C, U_H = 6.24 mV', () => {
  near(hallConstant(CARRIERS.semi), 6.2415e-4, 1e-4);
  near(hallVoltage(P.I, P.B, P.d, CARRIERS.semi), 6.2415e-3, 1e-4);
  // the worked example, step by step
  near(1 / (1.602e-19 * 1e22), hallConstant(CARRIERS.semi), 2e-4);
  near((6.24e-4 * 0.01 * 0.1) / 1e-4, 6.24e-3, 1e-12);
});

test('the same plate in copper: 0.73 nV, 8.5 million times less', () => {
  near(hallConstant(CARRIERS.copper), 7.343e-11, 1e-4);
  near(hallVoltage(P.I, P.B, P.d, CARRIERS.copper), 0.7343e-9, 1e-4);
  near(hallVoltage(P.I, P.B, P.d, CARRIERS.semi) / hallVoltage(P.I, P.B, P.d, CARRIERS.copper), 8.5e6, 1e-9);
});

test('U_H is proportional to I and B, inversely to d, and takes their signs', () => {
  const u = hallVoltage(P.I, P.B, P.d, CARRIERS.semi);
  near(hallVoltage(2 * P.I, P.B, P.d, CARRIERS.semi), 2 * u, 1e-12);
  near(hallVoltage(P.I, P.B, P.d / 2, CARRIERS.semi), 2 * u, 1e-12);
  near(hallVoltage(-P.I, P.B, P.d, CARRIERS.semi), -u, 1e-12);
  near(hallVoltage(-P.I, -P.B, P.d, CARRIERS.semi), u, 1e-12);
  assert.equal(hallVoltage(0, P.B, P.d, CARRIERS.semi), 0);
  assert.equal(hallVoltage(P.I, 0, P.d, CARRIERS.semi), 0);
});

test('slider extremes: 125 mV in the semiconductor, 14.7 nV in copper', () => {
  near(hallVoltage(20e-3, 0.5, 0.05e-3, CARRIERS.semi), 0.12483, 1e-4);
  near(hallVoltage(20e-3, 0.5, 0.05e-3, CARRIERS.copper), 14.686e-9, 1e-4);
});

test('drift velocity: 31.2 m/s in the semiconductor, 3.67 µm/s in copper', () => {
  near(driftVelocity(P.I, CARRIERS.semi, P.b, P.d), 31.208, 1e-4);
  near(driftVelocity(P.I, CARRIERS.copper, P.b, P.d), 3.6715e-6, 1e-4);
  assert.equal(driftVelocity(0, CARRIERS.semi, P.b, P.d), 0);
});

test('the balance q·E_H = q·v·B gives the same Hall voltage: the width cancels', () => {
  for (const b of [1e-3, 2e-3, 5e-3]) {
    const v = driftVelocity(P.I, CARRIERS.semi, b, P.d);
    near(hallVoltageFromDrift(v, P.B, b), hallVoltage(P.I, P.B, P.d, CARRIERS.semi), 1e-12);
    near(hallField(v, P.B) * b, hallVoltage(P.I, P.B, P.d, CARRIERS.semi), 1e-12);
  }
  near(hallField(31.2, 0.1), 3.12, 1e-12);
});

test('quiz: 5 mA, 0.2 T, 0.05 mm in the semiconductor gives 12.5 mV', () => {
  near(hallVoltage(5e-3, 0.2, 0.05e-3, CARRIERS.semi), 12.483e-3, 1e-4);
  near((6.24e-4 * 0.005 * 0.2) / 0.05e-3, 12.48e-3, 1e-12);
});

test('field of a wire: 10 A at 1 cm distance give 0.2 mT', () => {
  near(wireField(10, 0.01), 0.2e-3, 1e-9);
  near(wireField(20, 0.01), 0.4e-3, 1e-9);
});

test('pulse frequency of the magnet wheel and the way back to the speed', () => {
  assert.equal(pulseFrequency(300, 1), 5);
  assert.equal(pulseFrequency(300, 2), 10);
  assert.equal(pulseFrequency(300, 4), 20);
  assert.equal(pulseFrequency(600, 4), 40);
  assert.equal(pulseFrequency(0, 4), 0);
  assert.equal(speedFromFrequency(80, 4), 1200); // quiz
  for (const [rpm, z] of [[300, 1], [450, 2], [600, 4]]) {
    near(speedFromFrequency(pulseFrequency(rpm, z), z), rpm, 1e-12);
    near(speedFromPeriod(1 / pulseFrequency(rpm, z), z), rpm, 1e-12);
  }
  near(speedFromPeriod(0.1, 2), 300, 1e-12);
});
