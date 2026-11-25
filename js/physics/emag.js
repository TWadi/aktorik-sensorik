// Electromagnetic basics behind every motor: force on a wire, induction, and the torque of a wire
// loop with and without a commutator. All functions are pure. Units are SI: T, A, m, N, Wb, V,
// rad, N·m.
//
// Rotor angle θ on the site: θ = 0 when both conductors of the loop sit on the neutral axis
// (the axis perpendicular to the field). Positive torque turns towards larger θ.

const TAU = 2 * Math.PI;

/** Magnetic constant μ0 in V·s/(A·m). */
export const MU0 = 4e-7 * Math.PI;

// ---------------------------------------------------------------- force on a wire

/** Lorentz force on a straight wire perpendicular to the field: F = B·i·l in N. The sign follows B and i. */
export const wireForce = (B, i, l) => B * i * l;

/**
 * General form F = i·(l × B) for vectors [x, y, z].
 * @param {number} i current in A
 * @param {[number, number, number]} l wire vector in m (points along the current)
 * @param {[number, number, number]} B flux density in T
 * @returns {[number, number, number]} force in N
 */
export function lorentzForce(i, l, B) {
  return [
    i * (l[1] * B[2] - l[2] * B[1]),
    i * (l[2] * B[0] - l[0] * B[2]),
    i * (l[0] * B[1] - l[1] * B[0]),
  ];
}

/** Flux density at distance r from a long straight wire (Ampère): B = μ0·i / (2π·r) in T. */
export const wireField = (i, r) => (MU0 * i) / (TAU * r);

/** Reluctance force on a movable iron part: F = ½·i²·dL/dx in N (dL/dx in H/m). */
export const reluctanceForce = (i, dLdx) => 0.5 * i * i * dLdx;

/** First-order lag: move `value` towards `target` with time constant tau (s). Exact for any dt. */
export const lagStep = (value, target, tau, dt) => (dt > 0 ? target + (value - target) * Math.exp(-dt / tau) : value);

// ---------------------------------------------------------------- induction

/** Induction law: U = −N·dΦ/dt in V (dΦ/dt in Wb/s = V). */
export const inducedVoltage = (N, dPhiDt) => 0 - N * dPhiDt;

/** Magnet and coil of the induction animation: largest flux 50 µWb, width parameter 3 cm. */
export const MAGNET_COIL = Object.freeze({ phi0: 50e-6, a: 0.03 });

/**
 * Flux through the coil while the magnet centre is x metres away from the coil centre.
 * A smooth bell: Φ(x) = Φ0 / (1 + (x/a)²)^1.5. It is a model curve, not a field calculation.
 */
export const coilFlux = (x, phi0, a) => phi0 / (1 + (x / a) ** 2) ** 1.5;

/** Slope dΦ/dx of that bell in Wb/m. Zero at the coil centre, largest at x = ∓a/2. */
export const coilFluxSlope = (x, phi0, a) => (-3 * phi0 * x) / (a * a * (1 + (x / a) ** 2) ** 2.5);

/** Voltage of a coil with N turns while the magnet passes with speed v: U = −N·(dΦ/dx)·v. */
export const magnetVoltage = (N, x, v, phi0, a) => inducedVoltage(N, coilFluxSlope(x, phi0, a) * v);

// ---------------------------------------------------------------- one loop in a field

/**
 * The loop of the commutator animation: conductors at r = 2 cm, active length l = 5 cm, B = 0.5 T.
 * J and c (friction) are chosen large on purpose, so the rotor turns slowly enough to watch.
 */
export const DEMO_LOOP = Object.freeze({ r: 0.02, l: 0.05, B: 0.5, J: 1.9e-4, c: 3.2e-4 });

/** Bring an angle into the range 0 … 2π. */
export const wrapAngle = (a) => ((a % TAU) + TAU) % TAU;

/** Largest torque of one loop (two conductors): M0 = 2·r·l·B·i in N·m. */
export const loopPeakTorque = (g, i) => 2 * g.r * g.l * g.B * i;

/**
 * Torque of one rectangular loop at rotor angle θ.
 * Without commutator: M = M0·sin θ. An ideal commutator flips the current every half turn: M = M0·|sin θ|.
 * @param {number} theta rotor angle in rad (0 = conductors on the neutral axis)
 * @param {{r: number, l: number, B: number}} g geometry and field
 * @param {number} i current in A
 * @param {boolean} [commutated]
 * @returns {number} torque in N·m
 */
export function loopTorque(theta, g, i, commutated = false) {
  const s = Math.sin(theta);
  return loopPeakTorque(g, i) * (commutated ? Math.abs(s) : s);
}

/** Torque averaged over one full turn: (2/π)·M0 with a commutator, zero without. */
export const loopMeanTorque = (g, i, commutated = false) => (commutated ? (2 / Math.PI) * loopPeakTorque(g, i) : 0);

/** Direction of the current in the first conductor of the loop: +1, or −1 after the commutator has flipped it. */
export const loopCurrentSign = (theta, commutated = false) => (commutated && Math.sin(theta) < 0 ? -1 : 1);

/**
 * Advance the one-loop rotor by dt:  J·dω/dt = M(θ) − c·ω,  dθ/dt = ω.
 * Small sub-steps, friction taken implicitly, so it stays stable for any dt.
 * @param {{theta: number, w: number}} state
 * @param {{r: number, l: number, B: number, J: number, c: number}} g
 * @returns {{theta: number, w: number}} new state (the old one is not changed)
 */
export function stepLoopRotor(state, g, i, commutated, dt) {
  if (!(dt > 0)) return { ...state };
  const n = Math.max(1, Math.ceil(dt / 0.002));
  const hStep = dt / n;
  let { theta, w } = state;
  for (let k = 0; k < n; k++) {
    w = (w + (loopTorque(theta, g, i, commutated) / g.J) * hStep) / (1 + (g.c / g.J) * hStep);
    theta += w * hStep;
  }
  return { theta: wrapAngle(theta), w };
}

// ---------------------------------------------------------------- several coils

/** Angle of coil k (0 … n−1) when n coils are spread evenly: θ + k·π/n. */
export const coilAngle = (theta, n, k) => theta + (k * Math.PI) / n;

/** Torque of commutated coil k in units of its own peak value M0. */
export const coilTorque = (theta, n, k) => Math.abs(Math.sin(coilAngle(theta, n, k)));

/** Total torque of n evenly spread, commutated coils in units of M0 (the peak of one coil). */
export function multiCoilTorque(theta, n) {
  let sum = 0;
  for (let k = 0; k < n; k++) sum += coilTorque(theta, n, k);
  return sum;
}

/**
 * Mean, lowest and highest total torque of n commutated coils (units of M0), and the ripple
 * (max − min) / mean. Closed form: within one segment the sum is cos(θ − π/2n) / sin(π/2n).
 * @returns {{mean: number, min: number, max: number, ripple: number}}
 */
export function torqueRipple(n) {
  const half = Math.PI / (2 * n);
  const mean = (2 * n) / Math.PI;
  const max = 1 / Math.sin(half);
  const min = n === 1 ? 0 : Math.cos(half) / Math.sin(half);
  return { mean, min, max, ripple: (max - min) / mean };
}
