// Flow measurement: continuity, Bernoulli, Venturi tube, Pitot tube, ultrasonic transit time.
// Pure functions, SI units (m, m/s, m², m³/s, Pa, kg/m³, s, rad).

/** Density (kg/m³) and speed of sound (m/s) of the two example fluids. */
export const FLUIDS = Object.freeze({
  water: Object.freeze({ rho: 1000, c: 1480 }),
  air: Object.freeze({ rho: 1.2, c: 343 }),
});

/** Cross-section of a round pipe with inner diameter D: A = π·D²/4. */
export const pipeArea = (D) => (Math.PI * D * D) / 4;

/** Volume flow Q = A·v in m³/s. */
export const volumeFlow = (A, v) => A * v;

/** m³/s -> litres per second. */
export const toLitresPerSecond = (Q) => Q * 1000;

/** Continuity for a round pipe that narrows from diameter D to d: v2 = (D/d)²·v1. */
export const throatSpeed = (v1, D, d) => v1 * (D / d) ** 2;

/** Dynamic pressure ½·ρ·v² in Pa. */
export const dynamicPressure = (rho, v) => 0.5 * rho * v * v;

/**
 * Bernoulli for a steady, frictionless, horizontal flow: ½·ρ·v1² + p1 = ½·ρ·v2² + p2.
 * @returns {number} the static pressure p2 at the second point
 */
export const bernoulliP2 = (p1, rho, v1, v2) => p1 + dynamicPressure(rho, v1) - dynamicPressure(rho, v2);

/** Venturi tube: pressure difference Δp = p1 − p2 = ½·ρ·v1²·((D/d)⁴ − 1). */
export const venturiDeltaP = (rho, v1, D, d) => dynamicPressure(rho, v1) * ((D / d) ** 4 - 1);

/**
 * Venturi sensor formula: v1 = √(2·Δp / (ρ·((D/d)⁴ − 1))).
 * The formula cannot see the direction of the flow. Without a pressure difference, or without a
 * constriction (d >= D), there is nothing to measure and the result is 0.
 */
export function venturiSpeed(rho, dp, D, d) {
  const k = (D / d) ** 4 - 1;
  if (!(dp > 0) || !(k > 0) || !(rho > 0)) return 0;
  return Math.sqrt((2 * dp) / (rho * k));
}

/**
 * Pitot (Prandtl) tube: v = √(2·(p_t − p_s)/ρ). `dp` is total minus static pressure.
 * A difference of zero or below means no flow towards the opening: the result is 0.
 */
export const pitotSpeed = (rho, dp) => (dp > 0 && rho > 0 ? Math.sqrt((2 * dp) / rho) : 0);

/**
 * Ultrasonic transit times along a path of length L at the angle alpha to the flow.
 * T1 runs with the flow, T2 against it. Negative v means the flow is reversed.
 * @returns {{T1: number, T2: number}} seconds
 */
export function transitTimes(L, c, v, alpha) {
  const along = v * Math.cos(alpha);
  return { T1: L / (c + along), T2: L / (c - along) };
}

/** Flow speed from both transit times: v = L/(2·cos α)·(1/T1 − 1/T2). The speed of sound drops out. */
export const transitSpeed = (L, alpha, T1, T2) => (L / (2 * Math.cos(alpha))) * (1 / T1 - 1 / T2);
