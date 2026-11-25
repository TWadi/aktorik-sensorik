// Controllers as pure step functions.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * One time step of a PI controller  u = kp·(e + (1/ti)·∫e dt)  with output limits.
 * Anti-windup: the integrator stops while the output is at a limit and the error pushes further out.
 * @param {{integ: number}} state integral of the error so far
 * @param {number} e control error (setpoint − measured value)
 * @param {{kp: number, ti: number, uMin?: number, uMax?: number}} cfg
 * @returns {{u: number, integ: number, saturated: boolean}}
 */
export function piStep(state, e, cfg, dt) {
  const uMin = cfg.uMin ?? -Infinity, uMax = cfg.uMax ?? Infinity;
  const integ = state.integ + e * dt;
  const raw = cfg.kp * (e + integ / cfg.ti);
  const u = clamp(raw, uMin, uMax);
  const pushingOut = (raw > uMax && e > 0) || (raw < uMin && e < 0);
  return { u, integ: pushingOut ? state.integ : integ, saturated: u !== raw };
}

/** P controller with output limits. */
export const pStep = (e, kp, uMin = -Infinity, uMax = Infinity) => clamp(kp * e, uMin, uMax);
