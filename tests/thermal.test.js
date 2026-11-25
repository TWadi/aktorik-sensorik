import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KELVIN_OFFSET, PT100, NTC_10K, SEEBECK_K, toKelvin,
  ptResistance, ptTemperature, ptSensitivity, ptRelSensitivity, sensorVoltage, selfHeatingPower, leadError,
  ntcResistance, ntcRelSensitivity, ntcSensitivity, ntcTemperature,
  thermoVoltage, thermoReading,
} from '../js/physics/thermal.js';

const near = (a, b, rel = 1e-3) => assert.ok(Math.abs(a - b) <= Math.abs(b) * rel + 1e-12, `${a} is not close to ${b}`);
const round = (v, decimals) => Number(v.toFixed(decimals));

test('constants of the three sensors', () => {
  assert.equal(KELVIN_OFFSET, 273.15);
  assert.equal(toKelvin(25), 298.15);
  assert.deepEqual({ ...PT100 }, { R0: 100, alpha: 3.851e-3 });
  assert.deepEqual({ ...NTC_10K }, { R25: 10e3, B: 3950, T25: 25 });
  assert.equal(SEEBECK_K, 41e-6);
});

test('PT100: 100 Ω at 0 °C and 138.51 Ω at 100 °C', () => {
  assert.equal(ptResistance(0), 100);
  near(ptResistance(100), 138.51, 1e-9);
  near(ptResistance(25), 109.6275, 1e-9); // table: 109.6 Ω
  near(ptResistance(50), 119.255, 1e-9); // table: 119.3 Ω
  near(ptResistance(-50), 80.745, 1e-9); // left end of the plot
  near(ptResistance(150), 157.765, 1e-9); // right end of the plot
});

test('PT100 backwards: 119.4 Ω means 50.4 °C, 123.1 Ω means 60 °C (quiz)', () => {
  assert.equal(round(ptTemperature(119.4), 1), 50.4);
  assert.equal(round(ptTemperature(123.1), 0), 60);
  near((119.4 / 100 - 1) / 0.003851, ptTemperature(119.4), 1e-12); // the example step 0.194 / 0.003851
  for (const T of [-200, -50, 0, 37, 850]) near(ptTemperature(ptResistance(T)), T, 1e-9);
});

test('PT100 sensitivity: 0.385 Ω/K, 0.35 %/K at 25 °C', () => {
  near(ptSensitivity(), 0.3851, 1e-12);
  near(ptRelSensitivity(25) * 100, 0.3513, 1e-3);
  near(ptRelSensitivity(0), PT100.alpha, 1e-12);
  // the relative sensitivity really is slope / value
  near(ptRelSensitivity(80), ptSensitivity() / ptResistance(80), 1e-12);
});

test('PT100 measuring current: 138.5 mV at 1 mA, self-heating grows with I²', () => {
  near(sensorVoltage(ptResistance(100), 1e-3), 0.13851, 1e-9);
  near(selfHeatingPower(ptResistance(100), 1e-3), 0.13851e-3, 1e-9); // 0.14 mW
  near(selfHeatingPower(ptResistance(100), 10e-3) / selfHeatingPower(ptResistance(100), 1e-3), 100, 1e-9);
});

test('1 Ω of lead resistance fakes 2.6 °C', () => {
  assert.equal(round(leadError(1), 1), 2.6);
  near(ptTemperature(ptResistance(20) + 1) - 20, leadError(1), 1e-9);
});

test('NTC 10 kΩ: values at 0, 25, 50 and 100 °C', () => {
  near(ntcResistance(25), 10e3, 1e-12);
  near(ntcResistance(0), 33620.6, 1e-4); // table: 33.6 kΩ
  near(ntcResistance(50), 3588.2, 1e-4); // table: 3.59 kΩ
  near(ntcResistance(100), 697.5, 1e-3); // table: 0.70 kΩ
  assert.equal(round(ntcResistance(0) / 1000, 1), 33.6);
  assert.equal(round(ntcResistance(50) / 1000, 2), 3.59);
  assert.equal(round(ntcResistance(100) / 1000, 2), 0.7);
});

test('NTC at the ends of the slider and at the edge of the plot', () => {
  assert.equal(round(ntcResistance(-50) / 1000, 0), 859); // "859 kΩ" in the try-it text
  near(ntcResistance(150), 199.7, 1e-3);
  assert.ok(ntcResistance(-20) > 100e3, 'below −20 °C the curve is above the 100 kΩ axis');
  assert.ok(ntcResistance(-19) < 100e3);
});

test('NTC sensitivity at 25 °C: −4.44 %/K, −444 Ω/K, about 13 times the PT100', () => {
  near(ntcRelSensitivity(25) * 100, -4.4435, 1e-4);
  near(ntcSensitivity(25), -444.35, 1e-4);
  assert.equal(round(Math.abs(ntcRelSensitivity(25)) / ptRelSensitivity(25), 0), 13);
  // numerical slope agrees with the formula
  const h = 1e-4;
  near((ntcResistance(25 + h) - ntcResistance(25 - h)) / (2 * h), ntcSensitivity(25), 1e-6);
});

test('NTC model can be inverted', () => {
  for (const T of [-50, 0, 25, 80, 150]) near(ntcTemperature(ntcResistance(T)) + 300, T + 300, 1e-9);
  near(ntcTemperature(10e3), 25, 1e-9);
});

test('thermocouple type K: 300 °C against 25 °C gives 11.3 mV', () => {
  near(thermoVoltage(300, 25), 11.275e-3, 1e-12);
  assert.equal(round(thermoVoltage(300, 25) * 1000, 1), 11.3);
  assert.equal(thermoVoltage(40, 40), 0);
  near(thermoVoltage(1000, 0), 41e-3, 1e-12);
  assert.ok(thermoVoltage(0, 50) < 0);
});

test('reference junction: without it the display is wrong by T_V', () => {
  const U = thermoVoltage(300, 25);
  near(thermoReading(U, 25, false), 275, 1e-9);
  near(thermoReading(U, 25, true), 300, 1e-9);
  near(thermoReading(8.2e-3, 20, true), 220, 1e-9); // quiz
  near(thermoReading(thermoVoltage(500, 0), 0, false), 500, 1e-9); // ice-point reference needs no correction
});
