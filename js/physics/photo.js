// Photodiode: shifted diode curve, operating points with a resistor, light barrier geometry.
// Pure functions, SI units.
//
// Sign convention: U is the diode voltage in forward direction (anode minus cathode), I the
// current in forward direction. Light adds the photocurrent in reverse direction.

/** Boltzmann constant in J/K. */
export const K_B = 1.380649e-23;

/** Elementary charge in C. */
export const Q_E = 1.602176634e-19;

/** Example photodiode: reverse current, emission coefficient, temperature, A per lux. */
export const PHOTODIODE = Object.freeze({ Is: 10e-9, n: 1, T: 300, sens: 0.1e-6 });

// exp() of anything above this is far outside every plot; clamping keeps the numbers finite
const MAX_EXPONENT = 40;

/** Thermal voltage U_T = k·T/q in V (25.85 mV at 300 K). */
export const thermalVoltage = (T = PHOTODIODE.T) => (K_B * T) / Q_E;

/** Photocurrent in A for the illuminance E in lux (never negative). */
export const photoCurrent = (E, d = PHOTODIODE) => d.sens * Math.max(0, E);

/** Diode curve with light: I = I_s·(exp(U/(n·U_T)) − 1) − I_Ph. */
export function diodeCurrent(U, Iph = 0, d = PHOTODIODE) {
  const arg = Math.min(U / (d.n * thermalVoltage(d.T)), MAX_EXPONENT);
  return d.Is * (Math.exp(arg) - 1) - Iph;
}

/** Open-circuit voltage U_L = n·U_T·ln(I_Ph/I_s + 1). */
export const openCircuitVoltage = (Iph, d = PHOTODIODE) => d.n * thermalVoltage(d.T) * Math.log(Math.max(0, Iph) / d.Is + 1);

/** Short-circuit current I_K = −I_Ph (zero stays a plain zero). */
export const shortCircuitCurrent = (Iph) => (Iph > 0 ? -Iph : 0);

/**
 * Root of a rising function f on [lo, hi] by bisection. Needs f(lo) <= 0 <= f(hi).
 * 60 halvings shrink the interval far below any measurable voltage.
 */
export function bisect(f, lo, hi, steps = 60) {
  let a = lo, b = hi;
  for (let k = 0; k < steps; k++) {
    const mid = (a + b) / 2;
    if (f(mid) > 0) b = mid; else a = mid;
  }
  return (a + b) / 2;
}

/**
 * Photovoltaic mode: the diode alone feeds a load resistor R (load line I = −U/R).
 * @returns {{U: number, I: number, P: number}} operating point and the power delivered to R
 */
export function photovoltaicPoint(Iph, R, d = PHOTODIODE) {
  const U = bisect((u) => diodeCurrent(u, Iph, d) + u / R, 0, openCircuitVoltage(Iph, d));
  const I = U > 0 ? -U / R : 0;
  return { U, I, P: (U * U) / R };
}

/**
 * Photodiode mode: reverse supply Ub in series with R (load line I = −(U + Ub)/R).
 * @returns {{U: number, I: number, UR: number, saturated: boolean}} operating point, the signal
 *   voltage across R, and whether the diode has left the reverse region (R·I_Ph above Ub)
 */
export function photodiodePoint(Iph, R, Ub, d = PHOTODIODE) {
  const U = bisect((u) => diodeCurrent(u, Iph, d) + (u + Ub) / R, -Ub, openCircuitVoltage(Iph, d));
  const I = -(U + Ub) / R;
  return { U, I, UR: U + Ub, saturated: U >= 0 };
}

const E12 = Object.freeze([1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2]);

/** Resistor of the E12 series: step k = 0 is `base` (100 Ω), twelve steps make one decade. */
export function e12(k, base = 100) {
  const step = Math.max(0, Math.round(k));
  return Number((E12[step % 12] * base * 10 ** Math.floor(step / 12)).toPrecision(2));
}

// ---------------------------------------------------------------- light barrier

/** Fraction (0…1) of a beam of width w centred at x0 that an object from xa to xb covers. */
export function beamCover(xa, xb, x0, w) {
  const overlap = Math.min(xb, x0 + w / 2) - Math.max(xa, x0 - w / 2);
  return Math.min(1, Math.max(0, overlap / w));
}

/** Length of an object that blocks the beam for the time t at the belt speed v: L = v·t. */
export const blockedLength = (v, t) => v * t;
