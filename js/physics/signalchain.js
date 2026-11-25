// The signal chain between a sensor and a microcontroller: amplifier gains (ideal op-amp),
// RC low-pass, sampling and aliasing, quantisation, successive approximation.
// Pure functions, SI units (V, Ω, F, C, Hz, s, rad).

const TAU = 2 * Math.PI;

// ---------------------------------------------------------------- amplifiers
/** Inverting amplifier: R1 at the input, R2 from the output back to the minus input. U_a/U_e = −R2/R1. */
export const invertingGain = (R1, R2) => -R2 / R1;

/** Non-inverting amplifier: Rf from the output to the minus input, Rg from there to ground. U_a/U_e = 1 + Rf/Rg. */
export const nonInvertingGain = (Rf, Rg) => 1 + Rf / Rg;

/** Voltage follower: the output is wired straight to the minus input. */
export const FOLLOWER_GAIN = 1;

/** Instrumentation amplifier: differential gain (1 + 2·R/R_gain)·(R3/R2). */
export const inAmpGain = (R, Rgain, R3 = 1, R2 = 1) => (1 + (2 * R) / Rgain) * (R3 / R2);

/** Instrumentation amplifier output U_a = gain·(U2 − U1). Whatever both inputs share cancels. */
export const inAmpOut = (U1, U2, R, Rgain, R3 = 1, R2 = 1) => inAmpGain(R, Rgain, R3, R2) * (U2 - U1);

/** The gain resistor that gives a wanted differential gain: R_gain = 2·R / (gain·R2/R3 − 1). */
export const inAmpRgain = (gain, R, R3 = 1, R2 = 1) => (2 * R) / ((gain * R2) / R3 - 1);

/** Charge amplifier for piezo sensors: U_a = −Q/C_f, independent of the cable capacitance. */
export const chargeAmpOut = (Q, Cf) => -Q / Cf;

// ---------------------------------------------------------------- RC low-pass
/** Cut-off frequency of an RC low-pass: f_c = 1/(2π·R·C). */
export const rcCutoff = (R, C) => 1 / (TAU * R * C);

/** Amplitude ratio of a first-order low-pass at the frequency f: 1/√(1 + (f/f_c)²). */
export const lowpassGain = (f, fc) => 1 / Math.sqrt(1 + (f / fc) ** 2);

/** Phase of a first-order low-pass in rad: −arctan(f/f_c). Negative means the output lags. */
export const lowpassPhase = (f, fc) => -Math.atan(f / fc);

/** Amplitude ratio -> decibel: 20·lg(ratio). */
export const toDb = (ratio) => 20 * Math.log10(ratio);

/** rad -> degrees. */
export const toDeg = (rad) => (rad * 180) / Math.PI;

/**
 * A tone is { a, f, ph }: a·sin(2π·f·t + ph). In the steady state a first-order low-pass scales
 * its amplitude and shifts its phase. Returns the new tone.
 */
export const lowpassTone = (tone, fc) => ({ a: tone.a * lowpassGain(tone.f, fc), f: tone.f, ph: tone.ph + lowpassPhase(tone.f, fc) });

/** Sum of tones at the time t. */
export const toneSum = (tones, t) => tones.reduce((sum, tone) => sum + tone.a * Math.sin(TAU * tone.f * t + tone.ph), 0);

// ---------------------------------------------------------------- sampling
/** The frequency a tone f seems to have after sampling at fs: |f − k·fs| with the nearest k. */
export const aliasFrequency = (f, fs) => Math.abs(f - Math.round(f / fs) * fs);

/**
 * Sampling theorem: fs must be more than twice the signal frequency.
 * @returns {'ok' | 'edge' | 'alias'} 'edge' is exactly f = fs/2, where the samples depend on the phase
 */
export function samplingVerdict(f, fs) {
  if (f < fs / 2) return 'ok';
  return f === fs / 2 ? 'edge' : 'alias';
}

// ---------------------------------------------------------------- quantisation
/** One step of an N-bit converter: U_LSB = U_ref / 2^N. */
export const lsb = (Uref, N) => Uref / 2 ** N;

/** Ideal rounding quantiser: the nearest code, limited to 0 … 2^N − 1. Its error stays within ±½ LSB. */
export const quantize = (U, Uref, N) => Math.min(2 ** N - 1, Math.max(0, Math.round(U / lsb(Uref, N))));

/** The voltage a code stands for: code·U_LSB. */
export const codeVoltage = (code, Uref, N) => code * lsb(Uref, N);

/** Code as a binary string with N digits, MSB first. */
export const toBinary = (code, N) => code.toString(2).padStart(N, '0');

/** A flash (parallel) converter needs 2^N − 1 comparators. */
export const flashComparators = (N) => 2 ** N - 1;

/**
 * Successive approximation, MSB first. Each step puts half of the remaining interval on top of
 * what is already certain and compares: the bit stays 1 when U >= trial.
 * @returns {Array<{k: number, weight: number, trial: number, keep: boolean, lo: number, hi: number, code: number}>}
 *   k = step 1 … N, weight = voltage of the bit, trial = comparison voltage, lo/hi = interval that
 *   was still possible before the step, code = result after the step
 */
export function sarSteps(U, Uref, N) {
  const steps = [];
  let certain = 0, code = 0;
  for (let k = 1; k <= N; k++) {
    const weight = Uref / 2 ** k;
    const trial = certain + weight;
    const keep = U >= trial;
    if (keep) code += 2 ** (N - k);
    steps.push({ k, weight, trial, keep, lo: certain, hi: certain + 2 * weight, code });
    if (keep) certain = trial;
  }
  return steps;
}

/** Result code of the successive approximation: it always rounds down, the error is 0 … 1 LSB. */
export const sarCode = (U, Uref, N) => sarSteps(U, Uref, N)[N - 1].code;
