// Position and angle sensors: potentiometer, coil with iron core, LVDT, incremental encoder,
// absolute encoder with binary or Gray code. Pure functions, SI units unless a name says otherwise.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mod = (a, m) => ((a % m) + m) % m;

// ---------------------------------------------------------------- potentiometer

/** Example potentiometer used on the site: track resistance R = 10 kΩ. */
export const EXAMPLE_POT = Object.freeze({ R: 10e3 });

/**
 * Unloaded potentiometer (ideal voltage divider): U_a = U_e·x.
 * @param {number} x wiper position 0…1 (= R_x/R)
 * @param {number} Ue supply voltage in V
 */
export const potIdeal = (x, Ue) => Ue * x;

/**
 * Loaded potentiometer: U_a/U_e = x / (1 + x·(1 − x)·R/R_m).
 * The load R_m lies in parallel with the lower part x·R of the track.
 * @param {number} x wiper position 0…1
 * @param {number} R track resistance in Ω
 * @param {number} Rm load (meter input) resistance in Ω
 */
export const potRatio = (x, R, Rm) => x / (1 + (x * (1 - x) * R) / Rm);

/** Output voltage of the loaded potentiometer in V. */
export const potLoaded = (x, Ue, R, Rm) => Ue * potRatio(x, R, Rm);

/** Loading error as a fraction of U_e (negative: the meter reads too little). */
export const potError = (x, R, Rm) => potRatio(x, R, Rm) - x;

/** Current through the load R_m in A. */
export const potLoadCurrent = (x, Ue, R, Rm) => potLoaded(x, Ue, R, Rm) / Rm;

/**
 * Worst loading error over the whole track, found numerically (golden-section search).
 * @returns {{x: number, err: number}} wiper position of the largest error and the error as a fraction of U_e
 */
export function potWorstError(R, Rm) {
  const g = (Math.sqrt(5) - 1) / 2;
  let a = 0, b = 1;
  for (let k = 0; k < 60; k++) {
    const c = b - g * (b - a), d = a + g * (b - a);
    if (potError(c, R, Rm) < potError(d, R, Rm)) b = d; else a = c;
  }
  const x = (a + b) / 2;
  return { x, err: potError(x, R, Rm) };
}

// ---------------------------------------------------------------- coil and LVDT

/** Magnetic field constant μ0 in V·s/(A·m). */
export const MU0 = 4e-7 * Math.PI;

/**
 * Inductance of a long coil: L = N²·A·μ0·μr/l.
 * @param {number} N number of turns
 * @param {number} A cross-section in m²
 * @param {number} l length in m
 * @param {number} mur relative permeability of the core (1 = air)
 */
export const coilInductance = (N, A, l, mur = 1) => (N * N * A * MU0 * mur) / l;

/**
 * Example LVDT of the site. Up: amplitude of the primary voltage in V, k: amplitude of the output
 * at full stroke divided by Up, stroke: largest displacement to each side in m.
 */
export const EXAMPLE_LVDT = Object.freeze({ Up: 5, k: 0.8, stroke: 0.01 });

/**
 * Amplitudes of the two secondary voltages. Simple linear coupling model: the core shares its
 * flux between the secondaries in proportion (1 − x)/2 and (1 + x)/2.
 * @param {number} x core position −1…1 (fraction of the stroke, positive towards secondary 2)
 * @returns {{u1: number, u2: number}} amplitudes in V
 */
export function lvdtSecondaries(x, Up, k) {
  const c = clamp(x, -1, 1);
  return { u1: (k * Up * (1 - c)) / 2, u2: (k * Up * (1 + c)) / 2 };
}

/**
 * Output of the LVDT, U_a = U_2 − U_1 (secondaries wired against each other).
 * @returns {{amp: number, phase: 0 | 180 | null, signed: number}} amplitude in V, phase against the
 *   primary in degrees (null in the centre) and the phase-sensitive (demodulated) value in V
 */
export function lvdtOutput(x, Up, k) {
  const { u1, u2 } = lvdtSecondaries(x, Up, k);
  const signed = u2 - u1;
  return { amp: Math.abs(signed), phase: signed > 0 ? 0 : signed < 0 ? 180 : null, signed };
}

// ---------------------------------------------------------------- incremental encoder

/** Index of the quarter period the disc is in (integer, grows with the angle). */
export const quadrant = (theta, N) => Math.floor((theta * 2 * N) / Math.PI);

/**
 * Signals of an incremental encoder with N lines at the angle theta (rad).
 * Positive rotation: A leads B by a quarter period. z is the reference pulse: once per
 * revolution, half a period wide, in step with A.
 * @returns {{a: 0 | 1, b: 0 | 1, z: 0 | 1}}
 */
export function quadSignals(theta, N) {
  const q = quadrant(theta, N);
  const s = mod(q, 4);
  return { a: s < 2 ? 1 : 0, b: s === 1 || s === 2 ? 1 : 0, z: mod(q, 4 * N) < 2 ? 1 : 0 };
}

// place of a state in the forward sequence 10 → 11 → 01 → 00
const quadIndex = ({ a, b }) => (a ? (b ? 1 : 0) : (b ? 2 : 3));

/**
 * Quadrature decoder, one transition.
 * @param {{a: number, b: number}} prev previous state
 * @param {{a: number, b: number}} next new state
 * @returns {-1 | 0 | 1} +1 forward (A leads B), −1 backward, 0 for no change or an invalid jump of both signals
 */
export function quadStep(prev, next) {
  const d = mod(quadIndex(next) - quadIndex(prev), 4);
  return d === 1 ? 1 : d === 3 ? -1 : 0;
}

/**
 * Counts for one transition with ×1, ×2 or ×4 evaluation.
 * ×4: every edge of A and B · ×2: every edge of A · ×1: only the edge of A while B is low
 * (the rising edge of A when turning forward).
 * @param {1 | 2 | 4} mode
 * @returns {-1 | 0 | 1}
 */
export function quadCount(prev, next, mode = 4) {
  const step = quadStep(prev, next);
  if (step === 0 || mode === 4) return step;
  if (prev.a === next.a) return 0;
  if (mode === 2) return step;
  return next.b ? 0 : step;
}

/** Counts per revolution for N lines. */
export const countsPerRev = (N, mode = 4) => N * mode;

/** Angle per count in degrees: 360°/(mode·N). */
export const angleStepDeg = (N, mode = 4) => 360 / (N * mode);

/** Angle in degrees (0…360) that belongs to a counter value. */
export const countToAngleDeg = (count, N, mode = 4) => mod(count, N * mode) * angleStepDeg(N, mode);

/**
 * Speed from counts: n = Δcounts/(mode·N·Δt).
 * @param {number} counts counts within dt
 * @param {number} dt gate time in s (must be > 0)
 * @returns {number} speed in revolutions per second
 */
export const speedFromCounts = (counts, N, dt, mode = 4) => counts / (mode * N * dt);

/** Revolutions per second → revolutions per minute. */
export const revsToRpm = (n) => n * 60;

/** Revolutions per second → rad/s. */
export const revsToRad = (n) => n * 2 * Math.PI;

// ---------------------------------------------------------------- absolute encoder

/** Binary number → Gray code: g = b XOR (b >> 1). */
export const toGray = (b) => b ^ (b >> 1);

/** Gray code → binary number. */
export function fromGray(g) {
  let b = 0;
  for (let v = g; v > 0; v >>= 1) b ^= v;
  return b;
}

/** The n bits of a value, most significant bit first. */
export const bitsOf = (value, n = 4) => Array.from({ length: n }, (_, k) => (value >> (n - 1 - k)) & 1);

/** Bits (most significant first) → value. */
export const fromBits = (bits) => bits.reduce((v, bit) => (v << 1) | bit, 0);

/** Code word printed on cell `index` of the strip. */
export const codeWord = (index, code = 'binary') => (code === 'gray' ? toGray(index) : index);

/** Small fixed mounting errors of the four sensors, in cells (most significant track first). */
export const SENSOR_OFFSETS = Object.freeze([0.16, -0.1, 0.06, -0.18]);

/** Perfectly aligned sensors. */
export const ALIGNED = Object.freeze([0, 0, 0, 0]);

const cellAt = (pos, n) => clamp(Math.floor(pos), 0, 2 ** n - 1);

/**
 * Read a code strip with one sensor per track. Sensor k sits at pos + offsets[k].
 * @param {number} pos position of the reading line in cells (0 … 2ⁿ)
 * @param {'binary' | 'gray'} code
 * @param {readonly number[]} offsets one offset per track in cells, most significant track first
 * @returns {{bits: number[], word: number, value: number, truth: number, error: number}}
 *   bits read, the raw word, the decoded position, the true cell and their difference
 */
export function readStrip(pos, code = 'binary', offsets = ALIGNED) {
  const n = offsets.length;
  const bits = offsets.map((off, k) => bitsOf(codeWord(cellAt(pos + off, n), code), n)[k]);
  const word = fromBits(bits);
  const value = code === 'gray' ? fromGray(word) : word;
  const truth = cellAt(pos, n);
  return { bits, word, value, truth, error: value - truth };
}

/**
 * The reading over the whole strip as a staircase: every interval in which neither the reading
 * nor the true cell changes.
 * @returns {Array<{x0: number, x1: number, value: number, truth: number}>}
 */
export function readingSteps(code = 'binary', offsets = ALIGNED) {
  const cells = 2 ** offsets.length;
  const edges = [0, cells];
  for (let k = 1; k < cells; k++) {
    edges.push(k);
    offsets.forEach((off) => edges.push(k - off));
  }
  const sorted = [...new Set(edges.filter((x) => x >= 0 && x <= cells))].sort((p, q) => p - q);
  return sorted.slice(1).map((x1, k) => {
    const x0 = sorted[k];
    const { value, truth } = readStrip((x0 + x1) / 2, code, offsets);
    return { x0, x1, value, truth };
  });
}
