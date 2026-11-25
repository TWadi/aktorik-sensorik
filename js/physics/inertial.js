// Inertial sensors: seismic mass on a spring (accelerometer), differential capacitor read-out,
// Coriolis force (gyroscope). Pure functions, SI units.
//
// Relative motion of the seismic mass against its housing:
//   m·z″ + c·z′ + k·z = m·a(t)      z = deflection (the mass lags behind), a = housing acceleration

/** Electric constant ε0 in F/m. */
export const EPS0 = 8.8541878128e-12;

/** Example accelerometer: 0.1 g on a 100 N/m spring. ω0 = 1000 rad/s, D = 0.7. */
export const SEISMIC = Object.freeze({ m: 1e-4, k: 100, c: 0.14 });

/** Example differential capacitor: plate area 1 mm², rest gap 2 µm, air. C0 = 4.43 pF. */
export const CAP_SENSOR = Object.freeze({ A: 1e-6, d0: 2e-6, epsR: 1 });

/** Example gyroscope: 1 µg vibrating with a peak speed of 0.1 m/s, sense spring 20 N/m. */
export const GYRO = Object.freeze({ m: 1e-9, v: 0.1, ks: 20 });

/** Natural angular frequency ω0 = √(k/m) in rad/s. */
export const naturalFrequency = (m, k) => Math.sqrt(k / m);

/** Damping ratio D = c/(2·m·ω0) = c/(2·√(k·m)). */
export const dampingRatio = (m, k, c) => c / (2 * Math.sqrt(k * m));

/** Damping constant c in N·s/m that gives the damping ratio D. */
export const dampingConstant = (m, k, D) => 2 * D * Math.sqrt(k * m);

/** Deflection under a constant acceleration: z = (m/k)·a. */
export const staticDeflection = (m, k, a) => (m * a) / k;

/**
 * Amplitude ratio Z/(m·a0/k) for a sinusoidal acceleration, η = ω/ω0.
 * Grows without bound for η = 1 and D → 0 (the undamped resonance).
 */
export const amplitudeRatio = (eta, D) => 1 / Math.hypot(1 - eta * eta, 2 * D * eta);

/** Phase lag φ of the deflection behind the acceleration, in rad (0…π). */
export const phaseLag = (eta, D) => Math.atan2(2 * D * eta, 1 - eta * eta);

/**
 * Resonance peak of the amplitude ratio.
 * @returns {{eta: number, ratio: number} | null} null when there is no peak (D ≥ 1/√2 ≈ 0.707)
 */
export function resonancePeak(D) {
  if (!(D > 0) || D >= Math.SQRT1_2) return null;
  return { eta: Math.sqrt(1 - 2 * D * D), ratio: 1 / (2 * D * Math.sqrt(1 - D * D)) };
}

/**
 * Steady-state deflection, normalised to m·a0/k, at the drive phase θ = ω·t
 * for the acceleration a = a0·cos(θ): z/(m·a0/k) = ratio·cos(θ − φ).
 */
export const steadyDeflection = (eta, D, theta) => amplitudeRatio(eta, D) * Math.cos(theta - phaseLag(eta, D));

/**
 * One time step of z″ + 2·D·ω0·z′ + ω0²·z = ω0²·target (semi-implicit Euler).
 * `target` is the static deflection the mass finally rests at. Keep ω0·dt well below 1.
 * @param {{z: number, v: number}} state
 * @returns {{z: number, v: number}} new state
 */
export function stepSeismic(state, target, w0, D, dt) {
  const v = state.v + (w0 * w0 * (target - state.z) - 2 * D * w0 * state.v) * dt;
  return { z: state.z + v * dt, v };
}

/**
 * Verdict on an amplitude ratio: within ±tol of 1 the sensor measures correctly.
 * @returns {'ok' | 'high' | 'low'}
 */
export function classify(ratio, tol = 0.05) {
  if (ratio > 1 + tol) return 'high';
  if (ratio < 1 - tol) return 'low';
  return 'ok';
}

/** Plate capacitor: C = ε0·εr·A/d. */
export const plateCapacitance = (A, d, epsR = 1) => (EPS0 * epsR * A) / d;

/**
 * Differential capacitor: the middle plate moves by dd towards plate 1.
 * C1 = ε0·εr·A/(d0 − dd), C2 = ε0·εr·A/(d0 + dd). Valid for |dd| < d0.
 * @returns {{c1: number, c2: number}}
 */
export const differentialCaps = (A, d0, dd, epsR = 1) => ({
  c1: plateCapacitance(A, d0 - dd, epsR),
  c2: plateCapacitance(A, d0 + dd, epsR),
});

/** Half-bridge output of the differential capacitor: U_a = U_e·Δd/(2·d0), exactly linear. */
export const capBridgeOut = (Ue, d0, dd) => (Ue * dd) / (2 * d0);

/**
 * The same output from the two capacitances: C1 (top) and C2 (bottom) form a divider, the
 * reference is the mid point of two equal resistors. U_a = U_e·(C1/(C1 + C2) − 1/2).
 */
export const capDividerOut = (Ue, c1, c2) => Ue * (c1 / (c1 + c2) - 0.5);

/** Coriolis force on a mass m moving with speed v in a frame turning with Ω: F = 2·m·v·Ω. */
export const coriolisForce = (m, v, omega) => 2 * m * v * omega;

/** Quasi-static deflection of the sense spring under a force: y = F/k_s. */
export const senseDeflection = (force, ks) => force / ks;
