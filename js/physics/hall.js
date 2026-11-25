// Hall effect in a thin plate and the Hall switch as a speed pickup. Pure functions, SI units.
//
// Plate: current I along the length, field B through the plate (at right angles), thickness d
// (along the field), width b (across the current). U_H appears across the width.

/** Elementary charge in C. */
export const Q_E = 1.602176634e-19;

/** Magnetic constant in V·s/(A·m). */
export const MU_0 = 4e-7 * Math.PI;

/** Charge carrier densities in 1/m³: a doped semiconductor and copper. */
export const CARRIERS = Object.freeze({ semi: 1e22, copper: 8.5e28 });

/** Example plate used on the sheet. */
export const HALL_PLATE = Object.freeze({ b: 2e-3, d: 0.1e-3, I: 10e-3, B: 0.1 });

/** Hall constant A_H = 1/(q·n) in m³/C. */
export const hallConstant = (n, q = Q_E) => 1 / (q * n);

/** Hall voltage U_H = A_H·I·B/d in V. The sign follows the signs of I and B. */
export const hallVoltage = (I, B, d, n, q = Q_E) => (hallConstant(n, q) * I * B) / d;

/** Drift velocity of the carriers v = I/(q·n·b·d) in m/s. */
export const driftVelocity = (I, n, b, d, q = Q_E) => I / (q * n * b * d);

/** Transverse field at balance, q·E_H = q·v·B, in V/m. */
export const hallField = (v, B) => v * B;

/** Hall voltage from the balance: U_H = E_H·b = v·B·b. */
export const hallVoltageFromDrift = (v, B, b) => hallField(v, B) * b;

/** Flux density around a long straight wire: B = μ0·I/(2π·r) in T. */
export const wireField = (I, r) => (MU_0 * I) / (2 * Math.PI * r);

// ---------------------------------------------------------------- Hall switch at a magnet wheel

/** Pulse frequency in Hz of a wheel with z magnets at the speed rpm (in 1/min). */
export const pulseFrequency = (rpm, z) => (rpm / 60) * z;

/** Speed in 1/min from the pulse frequency f (Hz) and the number of magnets z. */
export const speedFromFrequency = (f, z) => (60 * f) / z;

/** Speed in 1/min from the time T (s) between two pulses. */
export const speedFromPeriod = (T, z) => 60 / (z * T);
