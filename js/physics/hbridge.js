// H-bridge with four switches, four freewheeling diodes and a shunt in the ground path, driving
// the DC motor of dcmotor.js. Also the two-point (hysteresis) current control built on it.
//
//        +U_H ─────┬───────────────┬─────
//                T_LH             T_RH          each switch has a diode in parallel
//                  ├───── M ───────┤            (cathode towards +U_H)
//                T_LL             T_RL
//                  └───────┬───────┘
//                       R_Shunt
//        0 V ──────────────┴─────────────
//
// Sign convention: the current i is positive when it flows from the left half-bridge through
// the motor to the right half-bridge. U_M is the voltage across the motor terminals (left minus
// right), so the motor itself obeys  U_M = R·i + L·di/dt + k_e·ω.
// All functions are pure. Units are SI.

import { stepMotor, stepCurrentDriven } from './dcmotor.js';

/** Assumed bridge values used on the site: supply, switch resistance, shunt, diode voltage. */
export const EXAMPLE_BRIDGE = Object.freeze({ UH: 12, RdsOn: 0.05, Rshunt: 0.1, UD: 0.7 });

/** Switch patterns of the four named states. */
export const PRESETS = Object.freeze({
  forward: Object.freeze({ LH: true, RH: false, LL: false, RL: true }),
  reverse: Object.freeze({ LH: false, RH: true, LL: true, RL: false }),
  off: Object.freeze({ LH: false, RH: false, LL: false, RL: false }),
  brake: Object.freeze({ LH: false, RH: false, LL: true, RL: true }),
});

const OPEN = Object.freeze({ left: 'Z', right: 'Z' });
const legOf = (high, low) => (high && low ? 'X' : high ? 'H' : low ? 'L' : 'Z');
const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

/**
 * Classify a switch pattern.
 * Each side is 'H' (high switch on), 'L' (low switch on), 'Z' (both off) or 'X' (both on).
 * @param {{LH: boolean, RH: boolean, LL: boolean, RL: boolean}} sw
 * @returns {{mode: 'forward'|'reverse'|'brake'|'off'|'shoot', left: string, right: string,
 *            legs: {left: string, right: string}}}
 *   `legs` is what the motor effectively sees: a shoot-through is locked out (both sides open).
 */
export function bridgeState(sw) {
  const left = legOf(sw.LH, sw.LL), right = legOf(sw.RH, sw.RL);
  let mode = 'off';
  if (left === 'X' || right === 'X') mode = 'shoot';
  else if (left === 'H' && right === 'L') mode = 'forward';
  else if (left === 'L' && right === 'H') mode = 'reverse';
  else if (left !== 'Z' && left === right) mode = 'brake';
  return { mode, left, right, legs: mode === 'shoot' ? OPEN : { left, right } };
}

/** The two sides ('H' | 'L' | 'Z') of a named state. Unknown names and 'shoot' give an open bridge. */
export function legsOf(mode) {
  return PRESETS[mode] ? bridgeState(PRESETS[mode]).legs : OPEN;
}

// One half-bridge. `sourcing` is true when the current flows out of it into the motor.
// With both switches off a diode takes over: the low one when sourcing, the high one when sinking.
function side(leg, sourcing, cfg) {
  if (leg === 'H') return { v: cfg.UH, r: cfg.RdsOn, level: 'H', via: 'switch' };
  if (leg === 'L') return { v: 0, r: cfg.RdsOn, level: 'L', via: 'switch' };
  return sourcing
    ? { v: -cfg.UD, r: 0, level: 'L', via: 'diode' }
    : { v: cfg.UH + cfg.UD, r: 0, level: 'H', via: 'diode' };
}

/**
 * The path a current of direction `dir` (+1 or −1) takes through the bridge.
 * The motor then sees  U_M = V0 − Rext·i.
 * @returns {{V0: number, Rext: number, left: {level: string, via: string},
 *            right: {level: string, via: string}, shunt: number, dirDependent: boolean}}
 *   shunt: the shunt carries shunt·i towards ground (+1, −1, or 0 when the current only circulates).
 */
export function bridgePath(legs, dir, cfg = EXAMPLE_BRIDGE) {
  const d = dir < 0 ? -1 : 1;
  const l = side(legs.left, d > 0, cfg), r = side(legs.right, d < 0, cfg);
  const shunt = (r.level === 'L' ? 1 : 0) - (l.level === 'L' ? 1 : 0);
  return {
    V0: l.v - r.v,
    Rext: l.r + r.r + (shunt !== 0 ? cfg.Rshunt : 0),
    left: { level: l.level, via: l.via },
    right: { level: r.level, via: r.via },
    shunt,
    dirDependent: legs.left === 'Z' || legs.right === 'Z',
  };
}

/**
 * Which way does the current flow, and through which path?
 * A flowing current keeps its direction. At i = 0 a current only starts when the bridge voltage
 * beats the back-EMF in that direction; otherwise the diodes block and the motor coasts.
 * @param {number} emf back-EMF k_e·ω in V
 * @returns {{dir: number, path: object|null}} dir = 0 and path = null while nothing conducts
 */
export function conduction(legs, i, emf, cfg = EXAMPLE_BRIDGE) {
  if (Math.abs(i) > 1e-9) return { dir: sign(i), path: bridgePath(legs, sign(i), cfg) };
  const plus = bridgePath(legs, 1, cfg);
  if (plus.V0 - emf > 0) return { dir: 1, path: plus };
  const minus = bridgePath(legs, -1, cfg);
  if (minus.V0 - emf < 0) return { dir: -1, path: minus };
  return { dir: 0, path: null };
}

/**
 * Voltage across the motor terminals in one of the named states.
 *   forward:  U_H − (2·R_DS,on + R_Shunt)·i          reverse: −U_H − (2·R_DS,on + R_Shunt)·i
 *   brake:    −2·R_DS,on·i
 *   off:      −(U_H + 2·U_D) − R_Shunt·i  while i > 0 (two diodes feed the supply), mirrored for i < 0;
 *             at i = 0 the terminals float and simply show the back-EMF.
 * @param {number} emf back-EMF k_e·ω in V (only matters at i = 0)
 */
export function motorVoltage(mode, i, cfg = EXAMPLE_BRIDGE, emf = 0) {
  const c = conduction(legsOf(mode), i, emf, cfg);
  return c.path ? c.path.V0 - c.path.Rext * i : emf;
}

/** Slope of the current di/dt in A/s for a named state: (U_M − R·i − k_e·ω)/L. */
export function currentSlope(mode, i, w, p, cfg = EXAMPLE_BRIDGE) {
  return (motorVoltage(mode, i, cfg, p.ke * w) - p.R * i - p.ke * w) / p.L;
}

/** Motor torque in N·m for a given current: M_M = k_m·i. */
export const torqueFromCurrent = (p, i) => p.km * i;

/**
 * Highest speed (rad/s) at which the bridge can still push the current i through the motor:
 * k_e·ω < U_H − (R + 2·R_DS,on + R_Shunt)·i.
 */
export function holdSpeedLimit(p, i, cfg = EXAMPLE_BRIDGE) {
  return (cfg.UH - (p.R + 2 * cfg.RdsOn + cfg.Rshunt) * i) / p.ke;
}

// Time in (0, tMax] at which the current of an exact motor step reaches zero (bisection).
function zeroTime(s, u, pp, tMax, dir) {
  let lo = 0, hi = tMax;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (stepMotor(s, u, pp, mid).i * dir > 0) lo = mid; else hi = mid;
  }
  return hi;
}

/**
 * Advance the bridge-driven motor by dt seconds with a fixed switch pattern.
 * While a path conducts this is the exact motor step with U = V0 and R + Rext. When the current
 * of a diode path reaches zero it stays zero and the motor coasts (only friction and load act).
 * @param {{i: number, w: number, phi: number}} state
 * @param {{legs?: {left: string, right: string}, mode?: string, Ml?: number}} input
 * @returns {{i: number, w: number, phi: number}} new state
 */
export function stepBridge(state, input, p, cfg, dt) {
  let s = { i: state.i, w: state.w, phi: state.phi };
  if (!(dt > 0)) return s;
  const legs = input.legs || legsOf(input.mode);
  const Ml = input.Ml || 0;
  let left = dt;
  for (let k = 0; k < 4 && left > 0; k++) {
    const c = conduction(legs, s.i, p.ke * s.w, cfg);
    if (!c.path) break;
    const pp = { ...p, R: p.R + c.path.Rext };
    const u = { U: c.path.V0, Ml };
    const next = stepMotor(s, u, pp, left);
    if (!c.path.dirDependent || next.i * c.dir > 0) return next;
    const tz = zeroTime(s, u, pp, left, c.dir);
    const at = stepMotor(s, u, pp, tz);
    s = { i: 0, w: at.w, phi: at.phi };
    left -= tz;
  }
  return left > 0 ? stepCurrentDriven({ ...s, i: 0 }, { i: 0, Ml }, p, left) : s;
}

/**
 * Two-point controller (comparator with hysteresis) on the shunt signal.
 * Too little current switches on, too much switches off, in between the state is kept.
 * @param {boolean} on present switch state
 * @param {number} band half width of the hysteresis band in A
 * @returns {boolean} new switch state
 */
export function hysteresisSwitch(on, i, iSet, band) {
  if (i >= iSet + band) return false;
  if (i <= Math.max(iSet - band, 0)) return true;
  return on;
}

const MAX_SUB = 20e-6; // s, longest piece between two looks at the comparator
const MIN_BAND = 1e-3; // A, keeps the number of switching events per call finite

/**
 * Advance the motor under two-point current control by dt seconds. Switching instants inside
 * the step are located, so the current turns exactly at the band limits.
 * On = forward path (T_LH + T_RL), off = all switches open (diode path).
 * @param {{i: number, w: number, phi: number, on?: boolean, tCycle?: number, qCycle?: number,
 *          period?: number, iMean?: number}} state
 * @param {{iSet: number, band: number, Ml?: number, passiveLoad?: boolean}} input
 *   passiveLoad: the load is a brake. It can stop the rotor but not turn it backwards.
 * @param {{corners?: boolean}} [opts] collect the turning points [time since step start, i, on]
 * @returns {object} new state { i, w, phi, on, tCycle, qCycle, period, iMean } plus the statistics
 *   of this step { iMin, iMax, duty, switchOns, corners }. period and iMean describe the last
 *   complete switching cycle (0 and the present current before the first one).
 */
export function stepHysteresis(state, input, p, cfg, dt, opts = {}) {
  let s = { i: state.i, w: state.w, phi: state.phi };
  let on = Boolean(state.on);
  let tCycle = state.tCycle || 0, qCycle = state.qCycle || 0;
  let period = state.period || 0, iMean = state.iMean ?? state.i;
  const stats = { iMin: s.i, iMax: s.i, duty: on ? 1 : 0, switchOns: 0, corners: [] };
  const done = () => ({ ...s, on, tCycle, qCycle, period, iMean, ...stats });
  if (!(dt > 0)) return done();

  const band = Math.max(input.band, MIN_BAND);
  const upper = input.iSet + band, lower = Math.max(input.iSet - band, 0);
  const Ml = input.Ml || 0;
  const legsOn = legsOf('forward'), legsOff = legsOf('off');
  let left = dt, onTime = 0;

  for (let guard = 0; guard < 2e6 && left > 1e-15; guard++) {
    const want = hysteresisSwitch(on, s.i, input.iSet, band);
    if (want !== on) {
      on = want;
      if (opts.corners) stats.corners.push([dt - left, s.i, on]);
      if (on) {
        stats.switchOns += 1;
        if (tCycle > 0) { period = tCycle; iMean = qCycle / tCycle; }
        tCycle = 0; qCycle = 0;
      }
    }
    const path = bridgePath(on ? legsOn : legsOff, s.i < 0 ? -1 : 1, cfg);
    const pp = { ...p, R: p.R + path.Rext };
    const u = { U: path.V0, Ml };
    const target = on ? upper : lower;
    let h = Math.min(left, MAX_SUB);
    let next = stepMotor(s, u, pp, h);
    if (on ? next.i >= upper : next.i <= lower) {
      // crossed the band limit inside this piece: two secant steps find the instant
      let hc = h * Math.min(1, Math.max(0, (target - s.i) / (next.i - s.i)));
      const probe = stepMotor(s, u, pp, hc);
      if (probe.i !== s.i) hc = Math.min(h, Math.max(0, (hc * (target - s.i)) / (probe.i - s.i)));
      h = Math.max(hc, 1e-12);
      next = { ...stepMotor(s, u, pp, h), i: target };
    }
    if (input.passiveLoad && next.w < 0) next = { ...next, w: 0 };
    qCycle += ((s.i + next.i) / 2) * h;
    tCycle += h;
    if (on) onTime += h;
    stats.iMin = Math.min(stats.iMin, next.i);
    stats.iMax = Math.max(stats.iMax, next.i);
    s = next;
    left -= h;
  }
  stats.duty = onTime / dt;
  return done();
}
