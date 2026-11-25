// Permanent-magnet DC motor, the model used on every Aktorik sheet.
//
//   U = R·i + L·di/dt + k_e·ω          (electrical: mesh rule)
//   J·dω/dt = k_m·i − C_r·ω − M_L      (mechanical: torque balance)
//   dφ/dt = ω
//
// All functions are pure. Units are SI: V, A, Ω, H, rad/s, N·m, kg·m², N·m·s.

/** Example motor used across the site: a small 12 V motor with round numbers. */
export const EXAMPLE_MOTOR = Object.freeze({ R: 5, L: 0.4e-3, ke: 0.024, km: 0.024, J: 3e-6, Cr: 3e-6 });

const denom = (p) => p.ke * p.km + p.Cr * p.R;

/**
 * Operating point: all derivatives are zero.
 * @returns {{i: number, w: number}} current in A and speed in rad/s
 */
export function steadyState(p, U, Ml = 0) {
  const d = denom(p);
  return { i: (p.Cr * U + p.ke * Ml) / d, w: (p.km * U - p.R * Ml) / d };
}

/** No-load speed in rad/s (M_L = 0). */
export const noLoadSpeed = (p, U) => (p.km * U) / denom(p);

/** No-load current in A (only friction has to be overcome). */
export const noLoadCurrent = (p, U) => (p.Cr * U) / denom(p);

/** Stall torque in N·m: the largest load the motor can hold at ω = 0. */
export const stallTorque = (p, U) => (p.km * U) / p.R;

/** Stall (start-up) current in A. */
export const stallCurrent = (p, U) => U / p.R;

/** The characteristic line: load torque the motor delivers at speed ω (steady state). */
export const loadTorqueAt = (p, U, w) => (p.km / p.R) * U - (denom(p) / p.R) * w;

/**
 * Power balance at speed ω on the characteristic line.
 * P_el = P_mech + P_heat + P_fric holds exactly when k_e = k_m.
 */
export function powerAt(p, U, w) {
  const i = (U - p.ke * w) / p.R;
  const Ml = p.km * i - p.Cr * w;
  const pel = U * i;
  const pmech = Ml * w;
  return { i, Ml, pel, pmech, pheat: p.R * i * i, pfric: p.Cr * w * w, eta: pel > 0 ? pmech / pel : 0 };
}

/** Speed (rad/s) at which the useful power is largest: half the no-load speed. */
export const speedOfMaxPower = (p, U) => noLoadSpeed(p, U) / 2;

/** Largest useful power in W. */
export const maxPower = (p, U) => (p.km * p.km * U * U) / (4 * p.R * denom(p));

/** Time constants in s: electrical L/R, mechanical J/C_r, and the run-up constant without L. */
export function timeConstants(p) {
  return { tauE: p.L / p.R, tauM: p.J / p.Cr, tau: (p.J * p.R) / denom(p) };
}

/** Static gain speed/voltage in rad/(V·s). */
export const speedGain = (p) => p.km / denom(p);

/**
 * Poles of Ω(s)/U(s) = (k_m/(J·L)) / (s² + s·(R/L + C_r/J) + (k_e·k_m + C_r·R)/(J·L)).
 * @returns {Array<[number, number]>} two poles as [re, im]
 */
export function poles(p) {
  const b = p.R / p.L + p.Cr / p.J;
  const c = denom(p) / (p.J * p.L);
  const disc = b * b - 4 * c;
  if (disc >= 0) {
    const r = Math.sqrt(disc);
    return [[(-b - r) / 2, 0], [(-b + r) / 2, 0]];
  }
  const im = Math.sqrt(-disc) / 2;
  return [[-b / 2, im], [-b / 2, -im]];
}

/** Rule of thumb: the inductance may be neglected when R/L > 100 · C_r/J. */
export const inductanceNegligible = (p) => p.R / p.L > (100 * p.Cr) / p.J;

// exp(A·t) for a real 2×2 matrix [[a, b], [c, d]] in closed form
function expm2(a, b, c, d, t) {
  const half = (a + d) / 2;
  const disc = half * half - (a * d - b * c);
  let f0, f1; // exp(A t) = f0·I + f1·(A − half·I)
  if (disc > 1e-18) {
    // two real eigenvalues: use them directly, cosh/sinh would overflow for stiff systems
    const r = Math.sqrt(disc);
    const e1 = Math.exp((half + r) * t), e2 = Math.exp((half - r) * t);
    f0 = (e1 + e2) / 2; f1 = (e1 - e2) / (2 * r);
  } else if (disc < -1e-18) {
    const e = Math.exp(half * t), wd = Math.sqrt(-disc);
    f0 = e * Math.cos(wd * t); f1 = (e * Math.sin(wd * t)) / wd;
  } else {
    const e = Math.exp(half * t);
    f0 = e; f1 = e * t;
  }
  return [f0 + f1 * (a - half), f1 * b, f1 * c, f0 + f1 * (d - half)];
}

/**
 * Advance the motor by dt seconds with constant U and M_L. Exact for any dt
 * (matrix exponential of the linear model), so it stays stable for stiff parameters.
 * @param {{i: number, w: number, phi: number}} state
 * @param {{U: number, Ml: number}} input
 * @returns {{i: number, w: number, phi: number}} new state (the old one is not changed)
 */
export function stepMotor(state, input, p, dt) {
  if (!(dt > 0)) return { ...state };
  const L = Math.max(p.L, 1e-7);
  const a = -p.R / L, b = -p.ke / L, c = p.km / p.J, d = -p.Cr / p.J;
  const [e11, e12, e21, e22] = expm2(a, b, c, d, dt);
  // particular solution = steady state for the constant inputs
  const ss = steadyState(p, input.U, input.Ml);
  const di = state.i - ss.i, dw = state.w - ss.w;
  const i = ss.i + e11 * di + e12 * dw;
  const w = ss.w + e21 * di + e22 * dw;
  return { i, w, phi: state.phi + ((state.w + w) / 2) * dt };
}

/**
 * Same motor without inductance (L = 0): first-order model
 *   dω/dt = (1/J)·((k_m/R)·U − (k_m·k_e/R + C_r)·ω − M_L),   i = (U − k_e·ω)/R
 */
export function stepMotorNoL(state, input, p, dt) {
  if (!(dt > 0)) return { ...state };
  const ss = steadyState(p, input.U, input.Ml);
  const tau = (p.J * p.R) / denom(p);
  const w = ss.w + (state.w - ss.w) * Math.exp(-dt / tau);
  return { i: (input.U - p.ke * w) / p.R, w, phi: state.phi + ((state.w + w) / 2) * dt };
}

/**
 * Current-controlled motor (the current is forced, for example by an H-bridge):
 *   J·dω/dt = k_m·i − C_r·ω − M_L
 */
export function stepCurrentDriven(state, input, p, dt) {
  if (!(dt > 0)) return { ...state };
  const wEnd = (p.km * input.i - input.Ml) / p.Cr;
  const w = wEnd + (state.w - wEnd) * Math.exp((-dt * p.Cr) / p.J);
  return { i: input.i, w, phi: state.phi + ((state.w + w) / 2) * dt };
}

/** rad/s -> revolutions per minute. */
export const toRpm = (w) => (w * 60) / (2 * Math.PI);

/** revolutions per minute -> rad/s. */
export const fromRpm = (n) => (n * 2 * Math.PI) / 60;
