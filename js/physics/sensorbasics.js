// Sensor basics: static characteristic, sensitivity, the usual error shapes, first-order lag.
// Pure functions, no state.
//
// A "range" is { x0, x1, y0, y1 }: the measured quantity x0…x1 maps onto the output y0…y1.
// An "err" is { offset, gain, nonlin, hyst }:
//   offset  shift of the whole curve, in output units
//   gain    slope error as a fraction (0.1 = 10 % too steep), pivot at the start of the range
//   nonlin  parabolic bow, its peak as a fraction of the output span, zero at both ends
//   hyst    full width of the hysteresis loop at mid range, as a fraction of the output span
// A "dir" picks the hysteresis branch: +1 rising (lags below), −1 falling (lags above), 0 the mean.

import { pt1Step } from './lti.js';

/** Example temperature transmitter: 0…100 °C become 0…10 V. */
export const TRANSMITTER = Object.freeze({ x0: 0, x1: 100, y0: 0, y1: 10 });

/** A sensor without any error. */
export const NO_ERROR = Object.freeze({ offset: 0, gain: 0, nonlin: 0, hyst: 0 });

/** Platinum resistor: resistance in Ω at 0 °C and at 100 °C. */
export const PT100 = Object.freeze({ r0: 100, r100: 138.51 });

/** Sensitivity ε = Δy/Δx from two points of the characteristic. */
export const sensitivity = (xA, yA, xB, yB) => (yB - yA) / (xB - xA);

/** Output span y1 − y0 of a range. */
export const outputSpan = (range) => range.y1 - range.y0;

const frac = (x, range) => (x - range.x0) / (range.x1 - range.x0);
const bend = (err, dir) => err.nonlin - (dir * err.hyst) / 2;

/** Output of the ideal (straight) characteristic at x. */
export const idealOutput = (x, range) => range.y0 + frac(x, range) * outputSpan(range);

/** Unit parabola over s = 0…1: zero at both ends, 1 in the middle. */
export const bow = (s) => 4 * s * (1 - s);

/**
 * Output of the real characteristic at x.
 * @param {number} x measured quantity
 * @param {{x0: number, x1: number, y0: number, y1: number}} range
 * @param {{offset: number, gain: number, nonlin: number, hyst: number}} err
 * @param {1 | -1 | 0} [dir] hysteresis branch
 */
export function realOutput(x, range, err, dir = 0) {
  const s = frac(x, range);
  const S = outputSpan(range);
  return idealOutput(x, range) + err.offset + err.gain * s * S + bend(err, dir) * S * bow(s);
}

/** Deviation real − ideal at x, in output units. */
export const deviation = (x, range, err, dir = 0) => realOutput(x, range, err, dir) - idealOutput(x, range);

/** A deviation (output units) as a percentage of the output span. */
export const percentOfRange = (dev, range) => (dev / outputSpan(range)) * 100;

/** Slope dy/dx of the real characteristic at x (the local sensitivity). */
export function localSensitivity(x, range, err, dir = 0) {
  const s = frac(x, range);
  return (outputSpan(range) / (range.x1 - range.x0)) * (1 + err.gain + 4 * bend(err, dir) * (1 - 2 * s));
}

/**
 * Largest deviation over the whole range and both hysteresis branches (exact, not sampled).
 * @returns {{x: number, dev: number, dir: number}} where it happens, its signed value, its branch
 */
export function worstDeviation(range, err) {
  const S = outputSpan(range);
  const candidates = [1, -1].flatMap((dir) => {
    const q = bend(err, dir);
    const vertex = q !== 0 ? (err.gain + 4 * q) / (8 * q) : NaN;
    return [0, 1, vertex].filter((s) => s >= 0 && s <= 1).map((s) => ({ s, dir }));
  });
  return candidates
    .map(({ s, dir }) => ({
      x: range.x0 + s * (range.x1 - range.x0),
      dev: err.offset + err.gain * s * S + bend(err, dir) * S * bow(s),
      dir,
    }))
    .reduce((best, c) => (Math.abs(c.dev) > Math.abs(best.dev) ? c : best));
}

/**
 * Reading of a first-order sensor (time constant T) t seconds after the true value jumped
 * from `start` to `target`. Before the jump (t < 0) it still shows `start`.
 */
export const lagReading = (start, target, T, t) => start + (target - start) * pt1Step(1, T, t);

/** Fraction of a step that a first-order sensor has covered after n time constants. */
export const settledFraction = (n) => 1 - Math.exp(-n);
