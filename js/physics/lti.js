// Small toolbox for linear systems: transfer functions as polynomial coefficient arrays
// (highest power first, e.g. s² + 3s + 2 -> [1, 3, 2]), frequency response, step responses.
// Complex numbers are [re, im] pairs. All functions are pure.

const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cdiv = (a, b) => {
  const d = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};

/** Evaluate a polynomial (coefficients highest power first) at the complex point s. */
export function polyval(coeffs, s) {
  return coeffs.reduce((acc, c) => { const m = cmul(acc, s); return [m[0] + c, m[1]]; }, [0, 0]);
}

/** Multiply two polynomials. */
export function polymul(a, b) {
  const out = new Array(a.length + b.length - 1).fill(0);
  a.forEach((x, i) => b.forEach((y, k) => { out[i + k] += x * y; }));
  return out;
}

/** Add two polynomials. */
export function polyadd(a, b) {
  const n = Math.max(a.length, b.length);
  const pad = (p) => [...new Array(n - p.length).fill(0), ...p];
  const pa = pad(a), pb = pad(b);
  return pa.map((x, i) => x + pb[i]);
}

/** G(jω) for G = num/den. Returns { re, im, mag, phase } (phase in rad, range −π…π). */
export function freqResponse(num, den, w) {
  const s = [0, w];
  const g = cdiv(polyval(num, s), polyval(den, s));
  return { re: g[0], im: g[1], mag: Math.hypot(g[0], g[1]), phase: Math.atan2(g[1], g[0]) };
}

/** Logarithmically spaced frequencies from 10^a to 10^b. */
export function logspace(a, b, n = 200) {
  return Array.from({ length: n }, (_, k) => 10 ** (a + ((b - a) * k) / (n - 1)));
}

/**
 * Bode data with unwrapped phase.
 * @returns {{w: number[], db: number[], deg: number[]}}
 */
export function bode(num, den, ws) {
  const db = [], deg = [];
  let prev = null, offset = 0;
  for (const w of ws) {
    const g = freqResponse(num, den, w);
    let ph = (g.phase * 180) / Math.PI;
    if (prev !== null) {
      while (ph + offset - prev > 180) offset -= 360;
      while (ph + offset - prev < -180) offset += 360;
    }
    prev = ph + offset;
    db.push(20 * Math.log10(g.mag));
    deg.push(prev);
  }
  // a system with integrators starts at −90° per integrator: fix the absolute level at low frequency
  const lead = trailingZeros(den) - trailingZeros(num);
  const expected = -90 * lead + (Math.sign(lowGain(num) / lowGain(den)) < 0 ? -180 : 0);
  const shift = Math.round((expected - deg[0]) / 360) * 360;
  return { w: [...ws], db, deg: deg.map((d) => d + shift) };
}

const trailingZeros = (p) => { let n = 0; for (let k = p.length - 1; k >= 0 && p[k] === 0; k--) n += 1; return n; };
const lowGain = (p) => p[p.length - 1 - trailingZeros(p)];

/**
 * Gain crossover frequency (|L| = 1) and phase margin of an open loop L = num/den.
 * @returns {{wc: number, pm: number} | null} wc in rad/s, pm in degrees; null if |L| never crosses 1
 */
export function margins(num, den, wMin = 1e-3, wMax = 1e6) {
  const ws = logspace(Math.log10(wMin), Math.log10(wMax), 1200);
  const b = bode(num, den, ws);
  for (let k = 1; k < ws.length; k++) {
    if (b.db[k - 1] >= 0 && b.db[k] < 0) {
      const f = b.db[k - 1] / (b.db[k - 1] - b.db[k]);
      const wc = ws[k - 1] * (ws[k] / ws[k - 1]) ** f;
      const ph = b.deg[k - 1] + (b.deg[k] - b.deg[k - 1]) * f;
      return { wc, pm: 180 + ph };
    }
  }
  return null;
}

/** Closed loop T = L/(1 + L) for unity feedback, L = num/den. Returns { num, den }. */
export function closeLoop(num, den) {
  return { num: [...num], den: polyadd(den, num) };
}

/** Step response of a first-order lag K/(1 + sT) at time t. */
export const pt1Step = (K, T, t) => (t < 0 ? 0 : K * (1 - Math.exp(-t / T)));

/** Step response of K·ω0²/(s² + 2Dω0·s + ω0²) at time t (any damping D > 0). */
export function pt2Step(K, w0, D, t) {
  if (t <= 0) return 0;
  if (Math.abs(D - 1) < 1e-9) return K * (1 - Math.exp(-w0 * t) * (1 + w0 * t));
  if (D < 1) {
    const wd = w0 * Math.sqrt(1 - D * D);
    return K * (1 - Math.exp(-D * w0 * t) * (Math.cos(wd * t) + ((D * w0) / wd) * Math.sin(wd * t)));
  }
  const r = Math.sqrt(D * D - 1);
  const s1 = -w0 * (D - r), s2 = -w0 * (D + r);
  return K * (1 - (s2 * Math.exp(s1 * t) - s1 * Math.exp(s2 * t)) / (s2 - s1));
}

/** Overshoot (fraction of the final value) of a second-order system with damping D < 1. */
export const overshootOf = (D) => (D >= 1 ? 0 : Math.exp((-Math.PI * D) / Math.sqrt(1 - D * D)));

/**
 * Simulate y = (num/den)·u with RK4 (controllable canonical form). The system must be proper
 * (num degree <= den degree).
 * @param {(t: number) => number} u input signal
 * @returns {{t: number[], y: number[]}}
 */
export function simulateTF(num, den, u, tEnd, dt) {
  const n = den.length - 1;
  if (n < 1) throw new Error('simulateTF needs a denominator of degree >= 1');
  if (num.length > den.length) throw new Error('simulateTF needs a proper transfer function');
  const a = den.map((c) => c / den[0]);
  const bFull = [...new Array(den.length - num.length).fill(0), ...num].map((c) => c / den[0]);
  const d = bFull[0];
  const cRow = bFull.slice(1).map((bk, k) => bk - a[k + 1] * d); // multiplies x_n … x_1
  const deriv = (x, uu) => {
    const dx = new Array(n);
    for (let k = 0; k < n - 1; k++) dx[k] = x[k + 1];
    let acc = uu;
    for (let k = 0; k < n; k++) acc -= a[n - k] * x[k];
    dx[n - 1] = acc;
    return dx;
  };
  const out = (x, uu) => cRow.reduce((s, ck, k) => s + ck * x[n - 1 - k], d * uu);
  const steps = Math.max(1, Math.round(tEnd / dt));
  let x = new Array(n).fill(0);
  const ts = [0], ys = [out(x, u(0))];
  const axpy = (x0, k, hh) => x0.map((v, j) => v + k[j] * hh);
  for (let s = 0; s < steps; s++) {
    const t = s * dt;
    const k1 = deriv(x, u(t));
    const k2 = deriv(axpy(x, k1, dt / 2), u(t + dt / 2));
    const k3 = deriv(axpy(x, k2, dt / 2), u(t + dt / 2));
    const k4 = deriv(axpy(x, k3, dt), u(t + dt));
    x = x.map((v, j) => v + (dt / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
    ts.push(t + dt);
    ys.push(out(x, u(t + dt)));
  }
  return { t: ts, y: ys };
}

/**
 * Read the usual quality numbers off a step response.
 * @returns {{final: number, peak: number, overshoot: number, tRise: number, tPeak: number}}
 *   overshoot as a fraction of the final value; tRise from 10 % to 90 %
 */
export function stepInfo(ts, ys, final = ys[ys.length - 1]) {
  let peak = -Infinity, tPeak = 0, t10 = NaN, t90 = NaN;
  for (let k = 0; k < ys.length; k++) {
    const r = ys[k] / final;
    if (ys[k] * Math.sign(final) > peak) { peak = ys[k] * Math.sign(final); tPeak = ts[k]; }
    if (Number.isNaN(t10) && r >= 0.1) t10 = ts[k];
    if (Number.isNaN(t90) && r >= 0.9) t90 = ts[k];
  }
  const peakVal = peak * Math.sign(final);
  return { final, peak: peakVal, overshoot: Math.max(0, peakVal / final - 1), tRise: t90 - t10, tPeak };
}

/** Roots of a·s² + b·s + c as [re, im] pairs. */
export function roots2(a, b, c) {
  const disc = b * b - 4 * a * c;
  if (disc >= 0) { const r = Math.sqrt(disc); return [[(-b - r) / (2 * a), 0], [(-b + r) / (2 * a), 0]]; }
  const im = Math.sqrt(-disc) / (2 * a);
  return [[-b / (2 * a), im], [-b / (2 * a), -im]];
}
