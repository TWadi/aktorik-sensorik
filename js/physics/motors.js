// Motors beyond the brushed DC motor: BLDC with block commutation, stepper motor, piezo stack.
// All functions are pure. A name ending in "Deg" is an angle in degrees; everything else is SI
// (V, A, Ω, H, N·m, kg·m², rad, rad/s, m, C, N).

const RAD = Math.PI / 180;
const SQRT3 = Math.sqrt(3);
const mod = (v, m) => ((v % m) + m) % m;

// ---------------------------------------------------------------- BLDC, block commutation
//
// Electrical angle θ = p·φ (p pole pairs, φ mechanical rotor angle). θ = 0° is the start of
// step 1. Step k (sector k − 1) covers the 60° from 60°·(k − 1) to 60°·k.
//
//   per phase:  U = R·i + L·di/dt + u_bemf,   u_bemf = k_e·ω·sin(θ − offset)
//   torque:     M = Σ k_m·i_X·sin(θ − offset_X)      (X = A, B, C)
//
// The offsets are chosen so that a phase carries current while its back-EMF is near the peak.
// The zero crossing of the phase that is switched off then lies in the middle of the step.

export const PHASES = Object.freeze(['A', 'B', 'C']);

/** Block commutation table. Entry k is step k + 1: +1 = phase to plus, −1 = to minus, 0 = off. */
export const COMMUTATION = Object.freeze([
  Object.freeze({ A: 1, B: -1, C: 0 }),
  Object.freeze({ A: 1, B: 0, C: -1 }),
  Object.freeze({ A: 0, B: 1, C: -1 }),
  Object.freeze({ A: -1, B: 1, C: 0 }),
  Object.freeze({ A: -1, B: 0, C: 1 }),
  Object.freeze({ A: 0, B: -1, C: 1 }),
]);

/** Phase offsets of the sinusoidal back-EMF in degrees: u_X ∝ sin(θ − offset_X). */
export const BEMF_OFFSET_DEG = Object.freeze({ A: -30, B: 90, C: 210 });

/**
 * Small demo BLDC with a fan wheel (strong viscous friction). Per-phase values, star connection:
 * two phases in series give 5 Ω and a stall current of 2.4 A at 12 V, like the example DC motor.
 */
export const BLDC_DEMO = Object.freeze({ R: 2.5, ke: 0.014, km: 0.014, J: 0.5e-6, Cr: 1.25e-4, p: 1 });

/** Electrical angle in degrees for a mechanical angle and p pole pairs. */
export const electricalAngle = (mechDeg, p) => p * mechDeg;

/** Commutation steps per mechanical revolution: six per electrical revolution. */
export const commutationsPerRev = (p) => 6 * p;

/** Commutation steps per second at n revolutions per second. */
export const commutationRate = (p, revPerSec) => 6 * p * revPerSec;

/** Electrical frequency in Hz (also the frequency of one Hall signal) at n revolutions per second. */
export const electricalFrequency = (p, revPerSec) => p * revPerSec;

/** Sector 0…5 (step number − 1) for an electrical angle in degrees. */
export const sectorOf = (angleElDeg) => Math.floor(mod(angleElDeg, 360) / 60) % 6;

/**
 * Signals of the three Hall sensors. Each is high (1) for 180° electrical.
 * With 120° between the sensors the six codes are 101, 100, 110, 010, 011, 001.
 * With 60° between them 000 and 111 appear as well.
 * @returns {[number, number, number]} [h1, h2, h3]
 */
export function hallCode(angleElDeg, spacingDeg = 120) {
  return [0, 1, 2].map((k) => (mod(angleElDeg - k * spacingDeg, 360) < 180 ? 1 : 0));
}

const HALL_KEYS = [0, 1, 2, 3, 4, 5].map((s) => hallCode(s * 60 + 30).join(''));

/** What the electronics does: Hall code (120° spacing) -> sector 0…5. Invalid codes give −1. */
export const sectorFromHall = (code) => HALL_KEYS.indexOf(code.join(''));

/** Phase states of a sector as a new object { A, B, C } with +1, −1 or 0. */
export const phaseStates = (sector) => ({ ...COMMUTATION[mod(sector, 6)] });

/** The phase that carries no current in a sector: 'A', 'B' or 'C'. */
export const offPhase = (sector) => PHASES.find((X) => COMMUTATION[mod(sector, 6)][X] === 0);

/**
 * Direction of the stator field in a sector, as an electrical angle in degrees (same frame as
 * the rotor angle θ). It jumps by 60° at every commutation.
 */
export const statorAngle = (sector) => mod(120 + 60 * mod(sector, 6), 360);

/** Angle by which the stator field leads the rotor, wrapped to −180°…180°. */
export const leadAngle = (fieldDeg, angleElDeg) => mod(fieldDeg - angleElDeg + 180, 360) - 180;

/** Torque as a fraction of its maximum when the stator field leads the rotor by leadDeg. */
export const alignTorque = (leadDeg) => Math.sin(leadDeg * RAD);

/** Back-EMF of one phase divided by k_e·ω: a sine over the electrical angle. */
export const backEmfShape = (phase, angleElDeg) => Math.sin((angleElDeg - BEMF_OFFSET_DEG[phase]) * RAD);

/** Sum of the three phase torques in a sector, divided by k_m·i. Equals √3·sin(lead). */
export function phaseTorqueSum(sector, angleElDeg) {
  const s = COMMUTATION[mod(sector, 6)];
  return PHASES.reduce((sum, X) => sum + s[X] * backEmfShape(X, angleElDeg), 0);
}

/** Electrical angle (degrees) at which the back-EMF of the off phase crosses zero: mid step. */
export const zeroCrossingAngle = (sector) => 60 * mod(sector, 6) + 30;

/** Current through the two energised phases in series, inductance neglected: i = (U − u_bemf)/(2R). */
export const bldcCurrent = (U, w, leadDeg, P) => (U - SQRT3 * P.ke * w * Math.sin(leadDeg * RAD)) / (2 * P.R);

/** Torque of the two energised phases: M = √3·k_m·i·sin(lead). */
export const bldcTorque = (i, leadDeg, P) => SQRT3 * P.km * i * Math.sin(leadDeg * RAD);

/**
 * Speed at which the mean motor torque balances friction and a brake torque (block commutation,
 * lead between 60° and 120°). Zero when the motor cannot turn the load.
 */
export function bldcMeanSpeed(U, Ml, P) {
  const K = SQRT3 * P.ke, Km = SQRT3 * P.km;
  const meanSin = 3 / Math.PI, meanSin2 = 0.5 + (3 * SQRT3) / (4 * Math.PI);
  const w = ((Km * meanSin * U) / (2 * P.R) - Ml) / ((Km * K * meanSin2) / (2 * P.R) + P.Cr);
  return Math.max(0, w);
}

/**
 * Speed after a small time step dt for a rotor with inertia J that feels the torque `drive`
 * (everything except the brake) and a brake torque. The brake opposes the motion, holds the
 * rotor at standstill while the drive is weaker, and never pushes it backwards.
 */
export function brakedSpeed(w, drive, brake, J, dt) {
  const b = Math.max(0, brake);
  let net = drive;
  if (w === 0) net = Math.abs(drive) <= b ? 0 : drive - Math.sign(drive) * b;
  else net -= Math.sign(w) * b;
  const next = w + (net / J) * dt;
  return w !== 0 && Math.sign(next) !== Math.sign(w) ? 0 : next;
}

/**
 * One small time step of the BLDC rotor (semi-implicit Euler, use dt ≤ 0.1 ms).
 *   J·dω/dt = M(i, lead) − C_r·ω − brake,   dφ/dt = ω
 * The load is a brake: see brakedSpeed.
 * @param {{phi: number, w: number}} state mechanical angle in rad, speed in rad/s
 * @param {{U: number, Ml: number, fieldDeg: number}} input voltage, brake torque ≥ 0, stator field angle (electrical)
 * @returns {{phi: number, w: number, i: number, M: number}} new state with current and motor torque
 */
export function stepBldc(state, input, P, dt) {
  const lead = leadAngle(input.fieldDeg, (P.p * state.phi) / RAD);
  const i = bldcCurrent(input.U, state.w, lead, P);
  const M = bldcTorque(i, lead, P);
  if (!(dt > 0)) return { phi: state.phi, w: state.w, i, M };
  const w = brakedSpeed(state.w, M - P.Cr * state.w, input.Ml, P.J, dt);
  return { phi: state.phi + w * dt, w, i, M };
}

// ---------------------------------------------------------------- stepper motor
//
// Two-phase motor with p_r rotor pole pairs. Phase A pulls the rotor to θ = 0, phase B to a
// quarter of a pole pitch further. Electrical angle of the stator field: γ = atan2(i_B, i_A).
// The rotor rests where p_r·θ = γ.

/** Phase currents [i_A, i_B] (as +1, −1, 0) for each drive mode, in stepping order. */
export const STEP_SEQUENCES = Object.freeze({
  full: Object.freeze([[1, 1], [-1, 1], [-1, -1], [1, -1]]),
  wave: Object.freeze([[1, 0], [0, 1], [-1, 0], [0, -1]]),
  half: Object.freeze([[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]),
});

/** Typical NEMA-17 hybrid stepper (datasheet values). */
export const NEMA17 = Object.freeze({ stepAngleDeg: 1.8, I: 1.7, R: 1.5, L: 2.8e-3, MH: 0.4 });

/**
 * Coarse demo stepper for the animation: 5 rotor pole pairs (18° full step), the holding torque
 * of the NEMA-17 and a heavy rotor, so that it rings at about 4 Hz (slow motion).
 * D is the viscous damping in N·m·s/rad.
 */
export const STEPPER_DEMO = Object.freeze({ pr: 5, MH: 0.4, J: 3.2e-3, D: 0.032 });

/** Step angle in degrees for a number of steps per revolution. */
export const stepAngle = (stepsPerRev) => 360 / stepsPerRev;

/** Steps per revolution for a step angle in degrees. */
export const stepsPerRev = (alphaDeg) => 360 / alphaDeg;

/** Full-step angle in degrees of a two-phase motor with p_r rotor pole pairs. */
export const fullStepAngle = (pr) => 90 / pr;

/** Speed in revolutions per second for a step rate f (steps/s) and a step angle in degrees. */
export const speedFromStepRate = (f, alphaDeg) => (f * alphaDeg) / 360;

/** Phase currents [i_A, i_B] for step number `index` (any integer) in a drive mode. */
export function phaseCurrents(mode, index) {
  const seq = STEP_SEQUENCES[mode];
  return [...seq[mod(index, seq.length)]];
}

/** Electrical angle of the stator field in degrees (−180…180) for the two phase currents. */
export const fieldAngleDeg = (iA, iB) => Math.atan2(iB, iA) / RAD;

/** Holding torque relative to "two phases on": 1 with two phases, 1/√2 with one. */
export const holdingFactor = (iA, iB) => Math.hypot(iA, iB) / Math.SQRT2;

/**
 * Rest position of the rotor (mechanical degrees, not wrapped) for step number `index`.
 * full: two phases on · wave: one phase on · half: alternating, half the angle.
 */
export function equilibriumAngle(mode, index, pr) {
  const el = mode === 'full' ? 45 + 90 * index : mode === 'wave' ? 90 * index : 45 * index;
  return el / pr;
}

/** Restoring torque that pulls the rotor to its target: M = −M_H·sin(p_r·(θ − θ_target)). */
export const stepperTorque = (thetaDeg, targetDeg, MH, pr) => -MH * Math.sin(pr * (thetaDeg - targetDeg) * RAD);

/** Ringing frequency of small swings around a step position in Hz (two phases on). */
export const stepperRingHz = (P) => Math.sqrt((P.pr * P.MH) / P.J) / (2 * Math.PI);

/**
 * Lost steps: the rotor can only rest in positions that are whole pole pitches (4 full steps)
 * away from the commanded one. Returns the offset in steps of size stepDeg (positive = behind).
 */
export function lostSteps(commandDeg, thetaDeg, pr, stepDeg) {
  const pitch = 360 / pr;
  const cycles = Math.round((commandDeg - thetaDeg) / pitch);
  return cycles === 0 ? 0 : Math.round((cycles * pitch) / stepDeg);
}

/**
 * One small time step of the stepper rotor (semi-implicit Euler, use dt ≤ 2 ms).
 *   J·dω/dt = −factor·M_H·sin(p_r·(θ − θ_target)) − D·ω − brake
 * The load is a brake (friction): see brakedSpeed.
 * @param {{theta: number, w: number}} state mechanical angle in rad, speed in rad/s
 * @param {{target: number, factor: number, Ml: number}} input target angle in rad,
 *        holding factor (see holdingFactor), brake torque ≥ 0
 * @returns {{theta: number, w: number}}
 */
export function stepStepper(state, input, P, dt) {
  if (!(dt > 0)) return { ...state };
  const drive = -input.factor * P.MH * Math.sin(P.pr * (state.theta - input.target)) - P.D * state.w;
  const w = brakedSpeed(state.w, drive, input.Ml, P.J, dt);
  return { theta: state.theta + w * dt, w };
}

/** Voltage that drives the rated current through the winding at standstill: U = R·I. */
export const windingVoltage = (R, I) => R * I;

/** Electrical time constant of a winding: τ = L/R. */
export const windingTimeConstant = (L, R) => L / R;

// ---------------------------------------------------------------- piezo

/** Typical soft PZT ceramic: 500 pm/V, which is the same number in pC/N. */
export const PIEZO_D33 = 500e-12;

/** Stroke of a stack of n layers: Δl = n·d_33·U (inverse piezo effect). */
export const piezoStroke = (n, d33, U) => n * d33 * U;

/** Charge of one piezo element under a force: Q = d·F (direct piezo effect). */
export const piezoCharge = (d, F) => d * F;
