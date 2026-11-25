// Controller design around the DC motor: first-order lag facts, the PI speed loop and the
// position loops. The speed plant is the motor without inductance, G_S(s) = K/(1 + s·τ).
// All functions are pure. SI units (V, A, rad, rad/s, s); angles of the design recipes in degrees.

import { pt2Step } from './lti.js';
import { stepCurrentDriven } from './dcmotor.js';

const DEG = 180 / Math.PI;

// ---------------------------------------------------------------- first-order lag, motor as a system

/** Share of the final value a first-order lag has reached after n time constants: 1 − e^(−n). */
export const lagFraction = (n) => 1 - Math.exp(-n);

/**
 * Frequency response of the unit-gain lag 1/(1 + jω·τ).
 * @returns {{ratio: number, db: number, deg: number}} amplitude ratio, the same in dB, phase in degrees
 */
export function lagResponse(tau, w) {
  const x = w * tau;
  const ratio = 1 / Math.sqrt(1 + x * x);
  return { ratio, db: 20 * Math.log10(ratio), deg: -Math.atan(x) * DEG };
}

/**
 * The full motor model as a standard second-order system:
 *   Ω/U = K·ω0²/(s² + 2·D·ω0·s + ω0²),  ω0² = (k_e·k_m + C_r·R)/(J·L),  2·D·ω0 = R/L + C_r/J.
 * @returns {{K: number, w0: number, D: number}}
 */
export function motorSecondOrder(p) {
  const d = p.ke * p.km + p.Cr * p.R;
  const w0 = Math.sqrt(d / (p.J * p.L));
  return { K: p.km / d, w0, D: (p.R / p.L + p.Cr / p.J) / (2 * w0) };
}

/** Speed in rad/s per volt, t seconds after a voltage step, full model with inductance. */
export function motorStep(p, t) {
  const { K, w0, D } = motorSecondOrder(p);
  return pt2Step(K, w0, D, t);
}

/**
 * Current-driven motor Ω/I = (k_m/J)/(s + C_r/J).
 * @returns {{K: number, tau: number}} gain k_m/C_r in rad/(A·s) and time constant J/C_r in s
 */
export const currentDriven = (p) => ({ K: p.km / p.Cr, tau: p.J / p.Cr });

// ---------------------------------------------------------------- speed loop: P and PI on K/(1 + s·τ)

/** Remaining error of a P controller on K/(1 + s·τ), as a share of the setpoint step. */
export const pSteadyError = (K, VR) => 1 / (1 + K * VR);

/**
 * Closed loop of G_PI = V_R·(1 + 1/(s·T_N)) with the plant K/(1 + s·τ):
 *   s² + ((1 + K·V_R)/τ)·s + K·V_R/(τ·T_N) = s² + 2·D·ω0·s + ω0².
 * @returns {{w0: number, D: number}}
 */
export function piLoop(K, tau, VR, TN) {
  const w0 = Math.sqrt((K * VR) / (tau * TN));
  return { w0, D: (1 + K * VR) / (2 * tau * w0) };
}

/**
 * PI design by comparing coefficients: choose D and ω0, get V_R and T_N.
 * @returns {{VR: number, TN: number} | null} null when the wish needs a negative gain (2·D·ω0·τ <= 1)
 */
export function piByCoefficients(K, tau, D, w0) {
  const VR = (2 * D * w0 * tau - 1) / K;
  if (!(VR > 0)) return null;
  return { VR, TN: (K * VR) / (tau * w0 * w0) };
}

/**
 * PI design in the frequency domain: choose the crossover ω_c and the phase margin φ_R.
 *   φ_S = −arctan(ω_c·τ),  φ_PI = φ_R − φ_S − 180°,  T_N = tan(φ_PI + 90°)/ω_c,  |L(jω_c)| = 1.
 * @returns {{VR: number, TN: number, phiS: number, phiPI: number} | null} angles in degrees;
 *   null when φ_PI is not between −90° and 0° (a PI controller can only take phase away)
 */
export function piByPhaseMargin(K, tau, wc, pmDeg) {
  const phiS = -Math.atan(wc * tau) * DEG;
  const phiPI = pmDeg - phiS - 180;
  if (!(phiPI > -90 && phiPI < 0)) return null;
  const x = Math.tan((phiPI + 90) / DEG); // = ω_c·T_N
  const VR = (x * Math.sqrt(1 + (wc * tau) ** 2)) / (K * Math.sqrt(1 + x * x));
  return { VR, TN: x / wc, phiS, phiPI };
}

/** Open loop L(s) = V_R·(1 + 1/(s·T_N))·K/(1 + s·τ) as polynomials for lti.js. */
export const piOpenLoop = (K, tau, VR, TN) => ({ num: [K * VR * TN, K * VR], den: [TN * tau, TN, 0] });

/**
 * Crossover frequency and phase margin of that open loop, in closed form.
 * |L| = 1 gives a quadratic in ω²; the phase there is −90° − arctan(ω·τ) + arctan(ω·T_N).
 * @returns {{wc: number, pm: number}} ω_c in rad/s, φ_R in degrees
 */
export function piMargin(K, tau, VR, TN) {
  const g2 = (K * VR) ** 2;
  const a = TN * TN * tau * tau, b = TN * TN * (1 - g2), c = -g2;
  const root = Math.sqrt(b * b - 4 * a * c);
  const w2 = b > 0 ? (-2 * c) / (b + root) : (-b + root) / (2 * a);
  const wc = Math.sqrt(w2);
  return { wc, pm: 90 - Math.atan(wc * tau) * DEG + Math.atan(wc * TN) * DEG };
}

/** Words for a phase margin: 'good' from 60°, 'fair' from 40°, otherwise 'poor'. */
export const marginClass = (pmDeg) => (pmDeg >= 60 ? 'good' : pmDeg >= 40 ? 'fair' : 'poor');

// derivative of pt2Step(1, w0, D, t): impulse response of ω0²/(s² + 2·D·ω0·s + ω0²)
function pt2Impulse(w0, D, t) {
  if (t <= 0) return 0;
  if (Math.abs(D - 1) < 1e-9) return w0 * w0 * t * Math.exp(-w0 * t);
  if (D < 1) {
    const wd = w0 * Math.sqrt(1 - D * D);
    return ((w0 * w0) / wd) * Math.exp(-D * w0 * t) * Math.sin(wd * t);
  }
  const r = Math.sqrt(D * D - 1);
  const s1 = -w0 * (D - r), s2 = -w0 * (D + r);
  return (w0 * w0 * (Math.exp(s1 * t) - Math.exp(s2 * t))) / (s1 - s2);
}

/**
 * Response of the closed PI speed loop to a unit setpoint step at time t (linear, no voltage limit):
 *   T(s) = ω0²·(1 + s·T_N)/(s² + 2·D·ω0·s + ω0²).
 * The factor (1 + s·T_N) is the controller zero; it adds T_N times the slope to the plain response.
 */
export function piClosedStep(K, tau, VR, TN, t) {
  if (t <= 0) return 0;
  const { w0, D } = piLoop(K, tau, VR, TN);
  return pt2Step(1, w0, D, t) + TN * pt2Impulse(w0, D, t);
}

/**
 * Overshoot and rise time of that step response, read off n samples.
 * @returns {{overshoot: number, tRise: number | null}} overshoot as a share of the step,
 *   rise time from 10 % to 90 % in s
 */
export function piStepQuality(K, tau, VR, TN, n = 4000) {
  const { w0, D } = piLoop(K, tau, VR, TN);
  const slow = D < 1 ? D * w0 : w0 * (D - Math.sqrt(D * D - 1));
  const tEnd = 10 / slow;
  let peak = 0, t10 = null, t90 = null, prevT = 0, prevY = 0;
  for (let k = 1; k <= n; k++) {
    const t = (tEnd * k) / n;
    const y = piClosedStep(K, tau, VR, TN, t);
    const cross = (level) => prevT + ((level - prevY) / (y - prevY)) * (t - prevT);
    if (t10 === null && y >= 0.1) t10 = cross(0.1);
    if (t90 === null && y >= 0.9) t90 = cross(0.9);
    peak = Math.max(peak, y);
    prevT = t; prevY = y;
  }
  return { overshoot: Math.max(0, peak - 1), tRise: t10 !== null && t90 !== null ? t90 - t10 : null };
}

// ---------------------------------------------------------------- measuring a running step response

/** Start measuring a setpoint step from the value `from` to the value `to` at time t0. */
export const stepMeter = (from, to, t0) => ({ from, to, t0, t10: null, t90: null, peak: from, tPeak: t0 });

/** Feed one sample (time t, value y). Returns a new meter; the old one is not changed. */
export function stepMeterPush(m, t, y) {
  const span = m.to - m.from;
  if (span === 0) return m;
  const r = (y - m.from) / span; // 0 at the start, 1 at the setpoint
  const higher = r > (m.peak - m.from) / span;
  return {
    ...m,
    t10: m.t10 === null && r >= 0.1 ? t : m.t10,
    t90: m.t90 === null && r >= 0.9 ? t : m.t90,
    peak: higher ? y : m.peak,
    tPeak: higher ? t : m.tPeak,
  };
}

/**
 * Read the meter.
 * @returns {{overshoot: number, tRise: number | null}} overshoot as a share of the step height,
 *   rise time from 10 % to 90 % (null until both levels were passed)
 */
export function stepMeterRead(m) {
  const span = m.to - m.from;
  return {
    overshoot: span === 0 ? 0 : Math.max(0, (m.peak - m.to) / span),
    tRise: m.t10 !== null && m.t90 !== null ? m.t90 - m.t10 : null,
  };
}

// ---------------------------------------------------------------- position loops

/** Position plant of the voltage-driven motor with L: Φ/U, third order (one more 1/s). */
export function positionPlantVoltage(p) {
  const d = p.ke * p.km + p.Cr * p.R;
  return { num: [p.km / (p.J * p.L)], den: [1, p.R / p.L + p.Cr / p.J, d / (p.J * p.L), 0] };
}

/** Position plant of the current-driven motor: Φ/I = (k_m/J)/(s·(s + C_r/J)). */
export const positionPlant = (p) => ({ num: [p.km / p.J], den: [1, p.Cr / p.J, 0] });

/**
 * P position loop i = K_P·(φ_soll − φ): s² + (C_r/J)·s + K_P·k_m/J.
 * @returns {{w0: number, D: number}}
 */
export function pPositionLoop(p, KP) {
  const w0 = Math.sqrt((KP * p.km) / p.J);
  return { w0, D: p.Cr / p.J / (2 * w0) };
}

/** The K_P (in A/rad) that gives the P position loop the damping D. */
export const kpForDamping = (p, D) => (p.Cr * p.Cr) / (4 * D * D * p.J * p.km);

/**
 * Cascade i = K_ω·(K_φ·(φ_soll − φ) − ω): s² + ((C_r + k_m·K_ω)/J)·s + k_m·K_ω·K_φ/J.
 * @returns {{w0: number, D: number}}
 */
export function cascadeLoop(p, Kw, Kphi) {
  const w0 = Math.sqrt((p.km * Kw * Kphi) / p.J);
  return { w0, D: (p.Cr + p.km * Kw) / p.J / (2 * w0) };
}

/**
 * Current command of the two position controllers, limited to ±iMax.
 * @param {{kind: 'p', KP: number} | {kind: 'cascade', Kw: number, Kphi: number}} ctrl
 * @param {number} e position error φ_soll − φ in rad
 * @param {number} w speed in rad/s (only the cascade uses it)
 * @returns {{i: number, limited: boolean}}
 */
export function positionCurrent(ctrl, e, w, iMax = Infinity) {
  const raw = ctrl.kind === 'cascade' ? ctrl.Kw * (ctrl.Kphi * e - w) : ctrl.KP * e;
  const i = Math.min(iMax, Math.max(-iMax, raw));
  return { i, limited: i !== raw };
}

/**
 * Advance the position loop by dt: the controller picks the current once, then the current-driven
 * motor runs with it. Use sub-steps well below 1/ω0.
 * @param {{i: number, w: number, phi: number}} state
 * @param {{iMax?: number, Ml?: number}} o current limit in A and load torque in N·m
 * @returns {{i: number, w: number, phi: number}} new state (the old one is not changed)
 */
export function stepPositionLoop(state, ctrl, phiSet, p, dt, o = {}) {
  if (!(dt > 0)) return { ...state };
  const { i } = positionCurrent(ctrl, phiSet - state.phi, state.w, o.iMax);
  return stepCurrentDriven(state, { i, Ml: o.Ml || 0 }, p, dt);
}
