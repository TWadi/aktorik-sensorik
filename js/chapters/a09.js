// A09 — Speed control with PI: quality of a loop, P versus PI, two design recipes, saturation.

import { h, p, anim, formula, tryIt, note, steps, example, quiz, table } from '../core/dsl.js';
import { Trace, clamp } from '../core/draw.js';
import { EXAMPLE_MOTOR, stepMotor, speedGain, timeConstants } from '../physics/dcmotor.js';
import { piStep, pStep } from '../physics/control.js';
import { bode, logspace } from '../physics/lti.js';
import {
  pSteadyError, piLoop, piOpenLoop, piMargin, marginClass, piClosedStep, piStepQuality,
  stepMeter, stepMeterPush, stepMeterRead,
} from '../physics/design.js';

const K = speedGain(EXAMPLE_MOTOR); // rad/(V·s)
const TAU = timeConstants(EXAMPLE_MOTOR).tau; // s
const RATE = 0.05; // slow motion: 1 s on screen = 50 ms in the motor
const SPAN = 0.25; // seconds of motor time shown
const U_MAX = 12; // V
const LOAD = 0.01; // N·m
const SETPOINTS = [100, 300]; // rad/s

// local helpers (drawing only): a slider that carries an exponent, and a legend entry with a
// dashed sample (D.legend draws solid samples only). `key` returns the x of the next entry.
const two = (x) => Number((10 ** x).toPrecision(2));
const key = (D, x, y, label, col, lw, dash) => {
  D.line(x, y - 4, x + 18, y - 4, col, lw, dash);
  return x + 24 + D.text(label, x + 24, y, { size: 12 }) + 16;
};

const gainSlider = (st) => st.slider({
  label: { de: 'Verstärkung $V_R$', en: 'Gain $V_R$' }, min: -2.3, max: -0.52, step: 0.02, value: -1.2,
  fmt: (x) => `${st.num(two(x), 2)} V·s/rad`,
});
const resetSlider = (st) => st.slider({ label: { de: 'Nachstellzeit $T_N$', en: 'Reset time $T_N$' }, min: 2, max: 100, step: 1, value: 10, unit: 'ms' });

const piAnim = {
  id: 'a09-pi',
  title: { de: 'Der Drehzahlregelkreis antwortet auf Sprung und Last', en: 'The speed loop answers a step and a load' },
  hint: {
    de: 'Zeitlupe: 1 s im Bild sind 50 ms im Motor. Der Steller liefert 0 bis 12 V. Die zwei Punkte markieren 10 % und 90 % des Sprungs.',
    en: 'Slow motion: 1 s on screen is 50 ms in the motor. The driver delivers 0 to 12 V. The two dots mark 10 % and 90 % of the step.',
  },
  height: 450,
  build(st) {
    const { D, C, t } = st;
    const P = EXAMPLE_MOTOR;
    let state = { i: 0, w: 0, phi: 0 };
    let uI = 0; // integral part of the controller output in V (kept in volts, so the sliders cause no jump)
    let u = 0, tSim = 0, wSet = SETPOINTS[0], loadOn = false, tLoad = null, saturated = false;
    let meter = stepMeter(0, wSet, 0);
    const trW = new Trace(900), trU = new Trace(900), trSet = new Trace(900);

    const vS = gainSlider(st);
    const nS = resetSlider(st);
    const iOn = st.toggle({ label: { de: 'I-Anteil', en: 'Integral part' }, value: true, on: () => { uI = 0; } });
    st.button({ de: 'Sollwertsprung', en: 'Setpoint step' }, () => {
      wSet = wSet === SETPOINTS[0] ? SETPOINTS[1] : SETPOINTS[0];
      meter = stepMeter(state.w, wSet, tSim);
      st.play();
    }, 'primary');
    const loadBtn = st.button({ de: 'Last 10 mNm auflegen', en: 'Apply 10 mNm load' }, () => {
      loadOn = !loadOn;
      tLoad = tSim;
      loadBtn.label(loadOn ? { de: 'Last wegnehmen', en: 'Remove load' } : { de: 'Last 10 mNm auflegen', en: 'Apply 10 mNm load' });
      st.play();
    });

    // plots 62..736 · top: speed (y 50..200), key at y 42 · bottom: controller output (y 272..392)
    st.loop((dt) => {
      const VR = two(vS.value), TN = nS.value / 1000;
      const Ml = loadOn ? LOAD : 0;
      const n = 20, hh = (dt * RATE) / n;
      for (let k = 0; k < n && dt > 0; k++) {
        const e = wSet - state.w;
        if (iOn.value) {
          const out = piStep({ integ: (uI * TN) / VR }, e, { kp: VR, ti: TN, uMin: 0, uMax: U_MAX }, hh);
          uI = (VR * out.integ) / TN;
          u = out.u;
          saturated = out.saturated;
        } else {
          u = pStep(e, VR, 0, U_MAX);
          saturated = u !== VR * e;
        }
        state = stepMotor(state, { U: u, Ml }, P, hh);
        tSim += hh;
        meter = stepMeterPush(meter, tSim, state.w);
        if (k % 10 === 9) { trW.push(tSim, state.w); trU.push(tSim, u); trSet.push(tSim, wSet); }
      }

      const x0 = Math.max(0, tSim - SPAN);
      const xt = [];
      for (let k = Math.ceil(x0 / 0.05 - 1e-9); k * 0.05 <= x0 + SPAN + 1e-9; k++) xt.push(k * 0.05);
      const xf = (v) => st.fix(v * 1000, 0);
      const mw = D.map({ x: 62, y: 50, w: 674, h: 150, x0, x1: x0 + SPAN, y0: 0, y1: 480 });
      const mu = D.map({ x: 62, y: 272, w: 674, h: 120, x0, x1: x0 + SPAN, y0: 0, y1: 14 });

      D.clear();
      D.axes(mw, { xt, xf, yt: [0, 100, 200, 300, 400], yl: t({ de: 'Drehzahl ω in rad/s', en: 'speed ω in rad/s' }), xl: 't in ms' });
      D.axes(mu, { xt, xf, yt: [0, 4, 8, 12], yl: t({ de: 'Stellgröße u in V', en: 'controller output u in V' }), xl: 't in ms' });
      const next = key(D, 540, 42, t({ de: 'Sollwert', en: 'setpoint' }), C.dim, 1.6, [6, 5]);
      key(D, next, 42, t({ de: 'Istwert', en: 'actual' }), C.w, 3);

      if (tLoad !== null && tLoad > x0) {
        const px = mw.X(tLoad), right = px > mw.x + mw.w - 90;
        D.vline(mw, tLoad, C.M);
        D.text(loadOn ? t({ de: 'Last ein', en: 'load on' }) : t({ de: 'Last aus', en: 'load off' }), px + (right ? -5 : 5), mw.y + 14, { size: 11.5, align: right ? 'right' : 'left' });
      }
      D.series(mw, trSet.pts, C.dim, 1.6, [6, 5]);
      D.series(mw, trW.pts, C.w, 2.8);
      const span = meter.to - meter.from;
      if (meter.t10 !== null) D.dot(mw, meter.t10, meter.from + 0.1 * span, C.ink, 3);
      if (meter.t90 !== null) D.dot(mw, meter.t90, meter.from + 0.9 * span, C.ink, 3);
      D.dot(mw, tSim, state.w, C.w, 4);

      D.hline(mu, U_MAX, C.bad);
      D.text(t({ de: 'Grenze 12 V', en: 'limit 12 V' }), mu.x + 6, mu.Y(U_MAX) - 5, { size: 11.5 });
      D.series(mu, trU.pts, C.U, 2.5);
      D.dot(mu, tSim, u, C.U, 4);

      const q = stepMeterRead(meter);
      const loop = piLoop(K, TAU, VR, TN);
      const theory = iOn.value
        ? `${t({ de: 'Formel', en: 'formula' })}: $D$ = <b>${st.num(loop.D, 2)}</b>, $ω_0$ = <b>${st.num(loop.w0, 3)} rad/s</b>`
        : `${t({ de: 'P allein: Es bleiben', en: 'P only: what remains is' })} <b>${st.num(pSteadyError(K, VR) * 100, 3)} %</b>`;
      const limit = saturated ? ` &nbsp;·&nbsp; <span class="U">${t({ de: '$u$ an der Grenze', en: '$u$ at the limit' })}</span>` : '';
      st.readout(`<span class="w">$e$ = <b>${st.fix(wSet - state.w, 1)} rad/s</b></span> &nbsp;·&nbsp; ${t({ de: 'Überschwingen', en: 'overshoot' })} <b>${st.fix(q.overshoot * 100, 1)} %</b> &nbsp;·&nbsp; $t_r$ = <b>${q.tRise === null ? '–' : st.si(q.tRise, 's')}</b> &nbsp;·&nbsp; ${theory}${limit}`);
    });
  },
};

const VERDICT = {
  good: { de: 'gut gedämpft', en: 'well damped' },
  fair: { de: 'schwingt etwas über', en: 'overshoots a little' },
  poor: { de: 'schwingt deutlich', en: 'oscillates clearly' },
};

const bodeAnim = {
  id: 'a09-bode',
  title: { de: 'Der offene Kreis im Bode-Diagramm', en: 'The open loop in the Bode plot' },
  hint: {
    de: 'Die Strecke ist hier ohne $L$ gerechnet: $K/(1 + s·τ)$. Rechts antwortet der geschlossene Kreis, ohne Spannungsgrenze.',
    en: 'The plant is calculated without $L$ here: $K/(1 + s·τ)$. On the right the closed loop answers, without a voltage limit.',
  },
  height: 450,
  build(st) {
    const { D, C, t } = st;
    const vS = gainSlider(st);
    const nS = resetSlider(st);
    const ws = logspace(0, 4, 161);
    const plant = bode([K], [TAU, 1], ws);
    const pts = (ys) => ws.map((w, k) => [Math.log10(w), ys[k]]);
    const plantDb = pts(plant.db), plantDeg = pts(plant.deg);
    let cached = { VR: null, TN: null, q: null };
    const xt = [0, 1, 2, 3, 4];
    const xf = (v) => (v >= 3 ? `10^{${v}}` : String(10 ** v));
    const yf = (v) => st.num(v, 3);

    // left 62..462: |L| (y 50..200, key at y 42) and phase (y 270..400)
    // right 536..736: closed-loop step (y 50..200), numbers (y 292..366)
    st.loop(() => {
      const VR = two(vS.value), TN = nS.value / 1000;
      const { wc, pm } = piMargin(K, TAU, VR, TN);
      const L = piOpenLoop(K, TAU, VR, TN);
      const open = bode(L.num, L.den, ws);
      if (cached.VR !== VR || cached.TN !== TN) cached = { VR, TN, q: piStepQuality(K, TAU, VR, TN) };
      const { q } = cached;
      const cls = marginClass(pm);
      const col = cls === 'good' ? C.ok : cls === 'fair' ? C.warn : C.bad;
      const lc = Math.log10(wc);

      D.clear();
      const mm = D.map({ x: 62, y: 50, w: 400, h: 150, x0: 0, x1: 4, y0: -80, y1: 80 });
      const mp = D.map({ x: 62, y: 270, w: 400, h: 130, x0: 0, x1: 4, y0: -225, y1: 0 });
      D.axes(mm, { xt, xf, yt: [-80, -40, 0, 40, 80], yf, yl: t({ de: 'Betrag in dB', en: 'magnitude in dB' }), xl: 'ω in rad/s' });
      D.axes(mp, { xt, xf, yt: [-180, -135, -90, -45, 0], yf, yl: t({ de: 'Phase in °', en: 'phase in °' }), xl: 'ω in rad/s' });
      const next = key(D, 200, 42, t({ de: 'offener Kreis L', en: 'open loop L' }), C.ink, 2.5);
      key(D, next, 42, t({ de: 'Strecke allein', en: 'plant alone' }), C.dim, 1.4, [5, 4]);

      // magnitude: 0 dB is the zero line of the axes; the crossover is where the curve cuts it
      D.series(mm, plantDb, C.dim, 1.4, [5, 4]);
      D.vline(mm, lc, C.dim, 'ω_c');
      D.series(mm, pts(open.db), C.ink, 2.5);
      D.dot(mm, lc, 0, col, 5);

      // phase: the margin is the gap between the curve and −180° at the crossover
      const px = mp.X(lc), yLow = mp.Y(-180), yCut = mp.Y(pm - 180);
      D.series(mp, plantDeg, C.dim, 1.4, [5, 4]);
      D.hline(mp, -180, C.dim);
      D.line(px, mp.y, px, yCut, C.dim, 1.2, [5, 4]);
      D.series(mp, pts(open.deg), C.ink, 2.5);
      D.line(px, yLow, px, yCut, col, 5);
      D.line(px - 7, yLow, px + 7, yLow, col, 2.5);
      D.dot(mp, lc, pm - 180, col, 5);
      D.text(`φ_R = ${st.fix(pm, 0)}°`, clamp(px, mp.x + 40, mp.x + mp.w - 40), yLow + 18, { size: 12.5, bold: true, align: 'center' });

      // closed-loop step response
      const mc = D.map({ x: 536, y: 50, w: 200, h: 150, x0: 0, x1: 0.2, y0: 0, y1: 1.5 });
      D.axes(mc, { xt: [0, 0.05, 0.1, 0.15, 0.2], xf: (v) => st.fix(v * 1000, 0), yt: [0, 0.5, 1, 1.5], yf, yl: t({ de: 'Sprungantwort ω/ω_{soll}', en: 'step response ω/ω_{soll}' }), xl: 't in ms' });
      D.hline(mc, 1, C.dim);
      D.curve(mc, (x) => piClosedStep(K, TAU, VR, TN, x), 0, 0.2, C.w, 2.5);
      D.text(t({ de: 'Geschlossener Kreis', en: 'Closed loop' }), 536, 292, { size: 13, bold: true });
      D.text(`${t({ de: 'Überschwingen', en: 'overshoot' })}: ${st.fix(q.overshoot * 100, 1)} %`, 536, 316, { size: 12.5 });
      D.text(`${t({ de: 'Anstiegszeit', en: 'rise time' })}: ${q.tRise === null ? '–' : st.si(q.tRise, 's')}`, 536, 338, { size: 12.5 });
      D.circle(543, 362, 6, { fill: col });
      D.text(t(VERDICT[cls]), 557, 366, { size: 12.5, bold: true });

      st.readout(`${t({ de: 'Durchtritt', en: 'crossover' })} $ω_c$ = <b>${st.num(wc, 3)} rad/s</b> &nbsp;·&nbsp; ${t({ de: 'Phasenrand', en: 'phase margin' })} $φ_R$ = <b>${st.fix(pm, 1)}°</b> &nbsp;·&nbsp; <b>${t(VERDICT[cls])}</b>`);
    });
  },
};

export default {
  id: 'a09',
  blocks: [
    h({ de: 'Was heißt gut geregelt?', en: 'What does well controlled mean?' }),
    p({
      de: 'Gib dem Regelkreis einen Sollwertsprung und schau auf die Antwort. Drei Zahlen beschreiben seine Güte.',
      en: 'Give the loop a setpoint step and look at the response. Three numbers describe its quality.',
    }),
    table({
      head: { de: ['Größe', 'Zeichen', 'Sagt aus'], en: ['Quantity', 'Symbol', 'Tells you'] },
      rows: [
        [{ de: 'Anstiegszeit', en: 'Rise time (Anstiegszeit)' }, '$t_r$', { de: 'wie schnell der Kreis ist', en: 'how fast the loop is' }],
        [{ de: 'Überschwingweite', en: 'Overshoot (Überschwingweite)' }, '$M_p$', { de: 'wie gut er gedämpft ist', en: 'how well it is damped' }],
        [{ de: 'bleibende Regelabweichung', en: 'Steady-state error (bleibende Regelabweichung)' }, '$e(∞)$', { de: 'wie genau er am Ende ist', en: 'how accurate it is in the end' }],
      ],
    }),
    anim(piAnim),
    tryIt({
      de: [
        'Drück <b>Sollwertsprung</b>. Die Stellgröße $u$ stößt kurz an die 12-V-Grenze. Die Drehzahl schwingt leicht über und trifft dann den Sollwert genau.',
        'Schalte den <b>I-Anteil</b> aus. Jetzt bleibt die Drehzahl unter dem Sollwert hängen. Es fehlen 28 %.',
        'Schalte ihn wieder ein und leg die <b>Last</b> auf. Die Drehzahl bricht kurz ein. Der Regler erhöht $u$, bis der Fehler wieder null ist.',
        'Stell $T_N$ auf 2 ms: Die Antwort schwingt stärker. Mit 50 ms kriecht sie zum Sollwert.',
      ],
      en: [
        'Press <b>Setpoint step</b>. The controller output $u$ briefly hits the 12 V limit. The speed overshoots a little and then meets the setpoint exactly.',
        'Switch the <b>integral part</b> off. Now the speed stays stuck below the setpoint. 28 % are missing.',
        'Switch it on again and apply the <b>load</b>. The speed dips for a moment. The controller raises $u$ until the error is zero again.',
        'Set $T_N$ to 2 ms: the response swings more. With 50 ms it creeps towards the setpoint.',
      ],
    }),

    h({ de: 'P allein reicht nicht', en: 'P alone is not enough' }),
    p({
      de: 'Ein P-Regler gibt $u = V_R·e$ aus. Ohne Fehler gibt es also keine Spannung. Der Motor braucht aber Spannung, um zu drehen. Darum bleibt immer ein Rest.',
      en: 'A P controller outputs $u = V_R·e$. So without an error there is no voltage. But the motor needs voltage to turn. That is why a remainder always stays.',
    }),
    formula('$[[e(∞)|ω_{soll}]] = [[1|1 + V_R·K]]$', {
      de: [['V_R', 'Reglerverstärkung in V·s/rad'], ['K', 'Verstärkung des Motors, hier 40,6 rad/(V·s)']],
      en: [['V_R', 'controller gain in V·s/rad'], ['K', 'gain of the motor, here 40.6 rad/(V·s)']],
    }),
    p({
      de: 'Mit $V_R = 0,05$ V·s/rad bleiben 33 % Fehler. Mehr Verstärkung macht den Rest kleiner, aber nie null.',
      en: 'With $V_R = 0.05$ V·s/rad an error of 33 % remains. More gain makes the remainder smaller, but never zero.',
    }),

    h({ de: 'Der PI-Regler', en: 'The PI controller' }),
    p({
      de: 'Der I-Anteil summiert den Fehler auf. Solange ein Fehler da ist, wächst die Stellgröße weiter. Erst bei $e = 0$ kommt sie zur Ruhe. Damit ist $e(∞) = 0$.',
      en: 'The integral part sums up the error. As long as there is an error, the controller output keeps growing. Only at $e = 0$ does it come to rest. So $e(∞) = 0$.',
    }),
    formula('$G_{PI}(s) = V_R·(1 + [[1|s·T_N]])$', {
      de: [['V_R', 'Verstärkung'], ['T_N', 'Nachstellzeit in s: Ein kleiner Wert heißt starker I-Anteil']],
      en: [['V_R', 'gain'], ['T_N', 'reset time (Nachstellzeit) in s: a small value means a strong integral part']],
    }),

    h({ de: 'Auslegen durch Koeffizientenvergleich', en: 'Design by comparing coefficients' }),
    p({
      de: 'PI-Regler und Strecke $K/(1 + s·τ)$ bilden zusammen wieder ein System zweiter Ordnung. Der Nenner des geschlossenen Kreises lautet:',
      en: 'PI controller and plant $K/(1 + s·τ)$ together form a second-order system again. The denominator of the closed loop reads:',
    }),
    formula('$s^2 + [[1 + K·V_R|τ]]·s + [[K·V_R|τ·T_N]] = s^2 + 2·D·ω_0·s + ω_0^2$', {
      de: [['D', 'Dämpfung: klein heißt Überschwingen'], ['ω_0', 'Kennkreisfrequenz: groß heißt schnell']],
      en: [['D', 'damping: small means overshoot'], ['ω_0', 'natural frequency: large means fast']],
    }),
    steps({
      de: [
        'Wünsch dir eine Dämpfung $D$ und ein Tempo $ω_0$.',
        'Vergleiche die Glieder mit $s$: $V_R = (2·D·ω_0·τ − 1)/K$.',
        'Vergleiche die letzten Glieder: $T_N = K·V_R/(τ·ω_0^2)$.',
      ],
      en: [
        'Wish for a damping $D$ and a pace $ω_0$.',
        'Compare the terms with $s$: $V_R = (2·D·ω_0·τ − 1)/K$.',
        'Compare the last terms: $T_N = K·V_R/(τ·ω_0^2)$.',
      ],
    }),
    example({
      title: { de: 'PI-Regler für den Beispielmotor', en: 'PI controller for the example motor' },
      given: {
        de: ['$K = 40,61$ rad/(V·s)', '$τ = 25,38$ ms', 'Wunsch: $D = 0,7$', '$ω_0 = 100$ rad/s'],
        en: ['$K = 40.61$ rad/(V·s)', '$τ = 25.38$ ms', 'wish: $D = 0.7$', '$ω_0 = 100$ rad/s'],
      },
      steps: {
        de: [
          '$2·D·ω_0·τ = 2·0,7·100·0,02538 = 3,553$.',
          '$V_R = (3,553 − 1)/40,61 = 0,0629$ V·s/rad.',
          '$T_N = 40,61·0,0629/(0,02538·100^2) = 0,0101$ s.',
        ],
        en: [
          '$2·D·ω_0·τ = 2·0.7·100·0.02538 = 3.553$.',
          '$V_R = (3.553 − 1)/40.61 = 0.0629$ V·s/rad.',
          '$T_N = 40.61·0.0629/(0.02538·100^2) = 0.0101$ s.',
        ],
      },
      result: {
        de: '$V_R ≈ 0,063$ V·s/rad und $T_N ≈ 10$ ms. Das sind die Startwerte der Animation oben.',
        en: '$V_R ≈ 0.063$ V·s/rad and $T_N ≈ 10$ ms. These are the start values of the animation above.',
      },
    }),
    p({
      de: 'Ein reines System zweiter Ordnung mit $D = 0,7$ schwingt 4,6 % über. Hier sind es etwa 11 %. Der Grund ist die Nullstelle des Reglers bei $−1/T_N$: Sie schiebt zusätzlich an.',
      en: 'A pure second-order system with $D = 0.7$ overshoots by 4.6 %. Here it is about 11 %. The reason is the zero of the controller at $−1/T_N$: it gives an extra push.',
    }),

    h({ de: 'Auslegen im Bode-Diagramm', en: 'Design in the Bode plot' }),
    p({
      de: 'Der zweite Weg schaut auf den <b>offenen</b> Kreis $L = G_{PI}·G_S$. Die Durchtrittsfrequenz $ω_c$ ist die Stelle mit $|L| = 1$, also 0 dB. Der Phasenrand $φ_R$ ist dort der Abstand der Phase zu −180°.',
      en: 'The second way looks at the <b>open</b> loop $L = G_{PI}·G_S$. The crossover frequency (Durchtrittsfrequenz) $ω_c$ is the point with $|L| = 1$, that is 0 dB. The phase margin (Phasenrand) $φ_R$ is the distance of the phase from −180° at that point.',
    }),
    anim(bodeAnim),
    tryIt({
      de: [
        'Erhöhe $V_R$. Die Betragskurve rutscht nach oben und $ω_c$ nach rechts. Die Sprungantwort wird schneller.',
        'Verkleinere $T_N$. Der Phasenrand schrumpft und die Sprungantwort schwingt stärker über.',
        'Stell $V_R = 0,042$ V·s/rad und $T_N = 8$ ms ein. Du liest $ω_c ≈ 100$ rad/s und $φ_R ≈ 60°$ ab.',
      ],
      en: [
        'Increase $V_R$. The magnitude curve slides up and $ω_c$ moves right. The step response gets faster.',
        'Decrease $T_N$. The phase margin shrinks and the step response overshoots more.',
        'Set $V_R = 0.042$ V·s/rad and $T_N = 8$ ms. You read $ω_c ≈ 100$ rad/s and $φ_R ≈ 60°$.',
      ],
    }),
    p({
      de: 'Daraus wird ein Rezept. Du gibst $ω_c$ für das Tempo und $φ_R$ für die Dämpfung vor.',
      en: 'This turns into a recipe. You choose $ω_c$ for the pace and $φ_R$ for the damping.',
    }),
    steps({
      de: [
        'Phase der Strecke bei $ω_c$ berechnen: $φ_S = −arctan(ω_c·τ)$.',
        'Den Rest muss der Regler liefern: $φ_{PI} = φ_R − φ_S − 180°$. Der Wert muss zwischen −90° und 0° liegen.',
        'Nachstellzeit: $T_N = tan(φ_{PI} + 90°)/ω_c$.',
        '$V_R$ so wählen, dass $|L(jω_c)| = 1$ gilt: $V_R = [[ω_c·T_N·√(1 + (ω_c·τ)^2)|K·√(1 + (ω_c·T_N)^2)]]$.',
      ],
      en: [
        'Calculate the phase of the plant at $ω_c$: $φ_S = −arctan(ω_c·τ)$.',
        'The controller must deliver the rest: $φ_{PI} = φ_R − φ_S − 180°$. The value must lie between −90° and 0°.',
        'Reset time: $T_N = tan(φ_{PI} + 90°)/ω_c$.',
        'Choose $V_R$ so that $|L(jω_c)| = 1$ holds: $V_R = [[ω_c·T_N·√(1 + (ω_c·τ)^2)|K·√(1 + (ω_c·T_N)^2)]]$.',
      ],
    }),
    example({
      title: { de: 'Das Rezept mit Zahlen', en: 'The recipe with numbers' },
      given: {
        de: ['$K = 40,61$ rad/(V·s)', '$τ = 25,38$ ms', '$ω_c = 100$ rad/s', '$φ_R = 60°$'],
        en: ['$K = 40.61$ rad/(V·s)', '$τ = 25.38$ ms', '$ω_c = 100$ rad/s', '$φ_R = 60°$'],
      },
      steps: {
        de: [
          '$φ_S = −arctan(100·0,02538) = −68,5°$.',
          '$φ_{PI} = 60° + 68,5° − 180° = −51,5°$. Das liegt im erlaubten Bereich.',
          '$T_N = tan(38,5°)/100 = 7,95$ ms. Damit ist $ω_c·T_N = 0,795$.',
          '$V_R = [[0,795·2,728|40,61·1,278]] = 0,0418$ V·s/rad.',
          'Geschlossen ergibt das $D = 0,58$ und $ω_0 = 91,7$ rad/s. Die Sprungantwort schwingt etwa 16 % über.',
        ],
        en: [
          '$φ_S = −arctan(100·0.02538) = −68.5°$.',
          '$φ_{PI} = 60° + 68.5° − 180° = −51.5°$. That lies in the allowed range.',
          '$T_N = tan(38.5°)/100 = 7.95$ ms. So $ω_c·T_N = 0.795$.',
          '$V_R = [[0.795·2.728|40.61·1.278]] = 0.0418$ V·s/rad.',
          'Closed, this gives $D = 0.58$ and $ω_0 = 91.7$ rad/s. The step response overshoots by about 16 %.',
        ],
      },
      result: { de: '$V_R ≈ 0,042$ V·s/rad und $T_N ≈ 8$ ms', en: '$V_R ≈ 0.042$ V·s/rad and $T_N ≈ 8$ ms' },
    }),
    p({
      de: 'Zum Nachbessern gilt: Mehr Phasenrand heißt weniger Überschwingen. Eine höhere Durchtrittsfrequenz heißt kürzere Anstiegszeit.',
      en: 'For tuning afterwards: more phase margin means less overshoot. A higher crossover frequency means a shorter rise time.',
    }),

    h({ de: 'Grenzen der Wirklichkeit', en: 'Limits of reality' }),
    p({
      de: 'Die Formeln kennen keine Grenzen, die Elektronik schon. Mehr als 12 V kann der Steller nicht liefern: Die Stellgröße geht in die Sättigung. Dann darf der I-Anteil nicht weiter aufsummieren. Diesen Schutz nennt man Anti-Windup.',
      en: 'The formulas know no limits, the electronics do. The driver cannot deliver more than 12 V: the controller output saturates (Sättigung). Then the integral part must not keep summing up. This protection is called anti-windup.',
    }),
    note({
      de: [
        'P allein lässt einen Rest: $e(∞)/ω_{soll} = 1/(1 + V_R·K)$.',
        'Der I-Anteil macht $e(∞) = 0$. Er kostet aber Phase.',
        'Mehr Phasenrand: weniger Überschwingen. Höheres $ω_c$: schneller.',
      ],
      en: [
        'P alone leaves a remainder: $e(∞)/ω_{soll} = 1/(1 + V_R·K)$.',
        'The integral part makes $e(∞) = 0$. But it costs phase.',
        'More phase margin: less overshoot. Higher $ω_c$: faster.',
      ],
    }),
    quiz([
      {
        q: {
          de: 'Ein P-Regler mit $V_R = 0,1$ V·s/rad regelt den Beispielmotor ($K = 40,6$ rad/(V·s)). Wie viel Prozent des Sollwerts fehlen am Ende?',
          en: 'A P controller with $V_R = 0.1$ V·s/rad controls the example motor ($K = 40.6$ rad/(V·s)). How many percent of the setpoint are missing in the end?',
        },
        answer: 19.8, unit: '%', decimals: 1,
        why: { de: '$1/(1 + 0,1·40,6) = 1/5,06$.', en: '$1/(1 + 0.1·40.6) = 1/5.06$.' },
      },
      {
        q: {
          de: 'Das Rezept liefert $φ_{PI} = −45°$ bei $ω_c = 100$ rad/s. Wie groß ist $T_N$?',
          en: 'The recipe gives $φ_{PI} = −45°$ at $ω_c = 100$ rad/s. How large is $T_N$?',
        },
        answer: 10, unit: 'ms', decimals: 0,
        why: { de: '$T_N = tan(45°)/ω_c = 1/100$ s.', en: '$T_N = tan(45°)/ω_c = 1/100$ s.' },
      },
      {
        q: { de: 'Die Sprungantwort schwingt zu stark über. Was hilft?', en: 'The step response overshoots too much. What helps?' },
        options: {
          de: ['Den Phasenrand vergrößern', 'Die Durchtrittsfrequenz erhöhen', 'Den Phasenrand verkleinern'],
          en: ['Increase the phase margin', 'Raise the crossover frequency', 'Decrease the phase margin'],
        },
        correct: 0,
        why: {
          de: 'Mehr Phasenrand bedeutet mehr Dämpfung. Eine höhere Durchtrittsfrequenz macht den Kreis nur schneller.',
          en: 'More phase margin means more damping. A higher crossover frequency only makes the loop faster.',
        },
      },
    ]),
  ],
};
