// A08 — Transfer function and poles: s-plane, step response, first-order lag, Bode plot.

import { h, p, anim, formula, tryIt, note, example, quiz, table } from '../core/dsl.js';
import { clamp, niceTicks } from '../core/draw.js';
import { EXAMPLE_MOTOR, poles, timeConstants, speedGain, inductanceNegligible } from '../physics/dcmotor.js';
import { pt1Step } from '../physics/lti.js';
import { lagFraction, lagResponse, motorStep } from '../physics/design.js';

// local helpers (drawing only): a slider that carries an exponent, and a symmetric-log axis
const two = (x) => Number((10 ** x).toPrecision(2));
const slog = (v) => Math.sign(v) * Math.log10(1 + Math.abs(v));

const RE_TICKS = [[-1e6, '−10^{6}'], [-1e5, '−10^{5}'], [-1e4, '−10^{4}'], [-1000, '−1000'], [-100, '−100'], [-10, '−10'], [0, '0']];
const IM_TICKS = [[-1000, '−1000'], [-100, '−100'], [-10, '−10'], [0, '0'], [10, '10'], [100, '100'], [1000, '1000']];
const RE_U = RE_TICKS.map(([v]) => slog(v));
const IM_U = IM_TICKS.map(([v]) => slog(v));

const polesAnim = {
  id: 'a08-poles',
  title: { de: 'Pole in der s-Ebene und die Sprungantwort', en: 'Poles in the s-plane and the step response' },
  hint: {
    de: 'Die Achsen der s-Ebene sind logarithmisch geteilt. Der Punkt läuft in Zeitlupe über die Sprungantwort.',
    en: 'The axes of the s-plane have a logarithmic scale. The dot runs along the step response in slow motion.',
  },
  height: 430,
  build(st) {
    const { D, C, t } = st;
    let sweep = 0;
    const lS = st.slider({ label: { de: 'Induktivität $L$', en: 'Inductance $L$' }, min: -2, max: 2, step: 0.05, value: -0.4, fmt: (x) => `${st.num(two(x), 2)} mH` });
    const jS = st.slider({ label: { de: 'Trägheit $J$', en: 'Inertia $J$' }, min: -0.7, max: 0.7, step: 0.05, value: 0, fmt: (x) => `× ${st.num(two(x), 2)}` });
    const rS = st.slider({ label: { de: 'Widerstand $R$', en: 'Resistance $R$' }, min: 2, max: 10, step: 0.5, value: 5, unit: 'Ω' });

    const cross = (x, y, col) => {
      D.line(x - 6, y - 6, x + 6, y + 6, col, 2.6);
      D.line(x - 6, y + 6, x + 6, y - 6, col, 2.6);
    };
    const fmtPole = (v) => (Math.abs(v) >= 1000 ? st.fix(v, 0) : st.num(v, 3));

    // left 62..332: s-plane (y 56..326), key at y 396 · right 420..736: step response (y 56..326), key at y 396
    st.loop((dt) => {
      const P = { ...EXAMPLE_MOTOR, L: two(lS.value) * 1e-3, J: EXAMPLE_MOTOR.J * two(jS.value), R: rS.value };
      const [pa, pb] = poles(P);
      const complex = pa[1] !== 0;
      const { tau } = timeConstants(P);
      const K = speedGain(P);
      const tEnd = 6 * Math.max(tau, -1 / Math.max(pa[0], pb[0]));
      sweep = (sweep + dt / 6) % 1;
      const tNow = Math.min(1, sweep * 1.2) * tEnd;

      D.clear();
      // --- s-plane
      const ms = D.map({ x: 62, y: 56, w: 270, h: 270, x0: -6.3, x1: 0.7, y0: -3.6, y1: 3.6 });
      D.axes(ms, {
        xt: RE_U, xf: (u) => RE_TICKS[RE_U.indexOf(u)][1],
        yt: IM_U, yf: (u) => IM_TICKS[IM_U.indexOf(u)][1],
        xl: t({ de: 'Realteil in rad/s (log. Skala)', en: 'real part in rad/s (log scale)' }),
        yl: t({ de: 'Imaginärteil in rad/s (log. Skala)', en: 'imaginary part in rad/s (log scale)' }),
      });
      const xAxis = ms.Y(0), yAxis = ms.X(0);
      D.rect(yAxis, ms.y, ms.x + ms.w - yAxis, ms.h, { fill: C.shade });
      D.hatch(yAxis, ms.y, ms.x + ms.w - yAxis, ms.h, { col: C.faint });
      D.line(yAxis, ms.y, yAxis, ms.y + ms.h, C.ink, 1.5);
      D.text(t({ de: 'links der Achse: stabil', en: 'left of the axis: stable' }), ms.x + 8, ms.y + 16, { size: 12, col: C.dim });
      D.text(complex
        ? t({ de: 'komplexes Polpaar: es schwingt', en: 'complex pole pair: it oscillates' })
        : t({ de: 'zwei reelle Pole: kein Schwingen', en: 'two real poles: no oscillation' }), ms.x + 8, ms.y + ms.h - 8, { size: 12, bold: true });
      D.circle(ms.X(slog(-1 / tau)), xAxis, 9, { stroke: C.dim, lw: 1.5, dash: [3, 3] });
      if (complex) {
        cross(ms.X(slog(pa[0])), ms.Y(slog(pa[1])), C.ink);
        cross(ms.X(slog(pb[0])), ms.Y(slog(pb[1])), C.ink);
      } else {
        const xFast = ms.X(slog(pa[0])), xSlow = ms.X(slog(pb[0]));
        cross(xFast, xAxis, C.i);
        cross(xSlow, xAxis, C.w);
        D.text(t({ de: 'schnell (elektrisch)', en: 'fast (electrical)' }), clamp(xFast, ms.x + 62, yAxis - 62), xAxis - 14, { size: 12, align: 'center' });
        D.text(t({ de: 'langsam (mechanisch)', en: 'slow (mechanical)' }), clamp(xSlow, ms.x + 68, yAxis - 68), xAxis + 28, { size: 12, align: 'center' });
      }
      cross(72, 392, C.ink);
      D.text(t({ de: 'Pol mit L', en: 'pole with L' }), 86, 396, { size: 12 });
      D.circle(190, 392, 9, { stroke: C.dim, lw: 1.5, dash: [3, 3] });
      D.text(t({ de: 'Pol ohne L', en: 'pole without L' }), 206, 396, { size: 12 });

      // --- unit step response
      const mr = D.map({ x: 420, y: 56, w: 316, h: 270, x0: 0, x1: tEnd, y0: 0, y1: 80 });
      D.axes(mr, {
        xt: niceTicks(0, tEnd * 1000, 5).map((v) => v / 1000), xf: (v) => st.num(v * 1000, 3),
        yt: [0, 20, 40, 60, 80], yl: t({ de: 'ω/U in rad/(V·s)', en: 'ω/U in rad/(V·s)' }), xl: 't in ms',
      });
      D.line(mr.X(0), mr.Y(0), mr.X(tau), mr.Y(K), C.faint, 1.2);
      D.hline(mr, K, C.dim, t({ de: 'Endwert K', en: 'final value K' }));
      D.hline(mr, lagFraction(1) * K, C.dim, '63 %');
      D.vline(mr, tau, C.dim, 'τ');
      D.curve(mr, (x) => motorStep(P, x), 0, tEnd, C.w, 3);
      D.curve(mr, (x) => pt1Step(K, tau, x), 0, tEnd, C.ink, 1.6, [6, 4]);
      D.dot(mr, tau, lagFraction(1) * K, C.ink, 3.5);
      D.dot(mr, tNow, motorStep(P, tNow), C.w, 5);
      D.line(420, 392, 436, 392, C.w, 3);
      D.text(t({ de: 'mit L', en: 'with L' }), 442, 396, { size: 12 });
      D.line(510, 392, 526, 392, C.ink, 1.6, [6, 4]);
      D.text(t({ de: 'ohne L', en: 'without L' }), 532, 396, { size: 12 });

      const poleText = complex
        ? `${fmtPole(pa[0])} ± j·${fmtPole(Math.abs(pa[1]))}`
        : `${fmtPole(pa[0])} ${t({ de: 'und', en: 'and' })} ${fmtPole(pb[0])}`;
      const verdict = inductanceNegligible(P)
        ? t({ de: '$L$ darf entfallen', en: '$L$ may be dropped' })
        : t({ de: '$L$ muss im Modell bleiben', en: '$L$ must stay in the model' });
      st.readout(`${t({ de: 'Pole', en: 'Poles' })}: <b>${poleText} rad/s</b> &nbsp;·&nbsp; <span class="w">$τ$ = <b>${st.si(tau, 's')}</b></span> &nbsp;·&nbsp; $R/L$ = ${st.num(P.R / P.L, 3)} s⁻¹, $100·C_r/J$ = ${st.num((100 * P.Cr) / P.J, 3)} s⁻¹: <b>${verdict}</b>`);
    });
  },
};

const bodeAnim = {
  id: 'a08-bode',
  title: { de: 'Ein Sinus am Verzögerungsglied: der Frequenzgang', en: 'A sine at the first-order lag: the frequency response' },
  hint: {
    de: 'Die Zeit ist gedehnt: Eine Periode dauert im Bild immer gleich lang. Der schwarze Balken unten zeigt den Verzug zwischen den Scheiteln.',
    en: 'Time is stretched: one period always takes the same time on screen. The black bar at the bottom shows the delay between the peaks.',
  },
  height: 440,
  build(st) {
    const { D, C, t } = st;
    let ph = 0; // phase of the input, in periods
    const fS = st.slider({ label: { de: 'Frequenz $ω$', en: 'Frequency $ω$' }, min: -2, max: 2, step: 0.05, value: 0, fmt: (x) => `${st.num(two(x), 2)} × 1/τ` });
    const tS = st.slider({ label: { de: 'Zeitkonstante $τ$', en: 'Time constant $τ$' }, min: 10, max: 100, step: 0.2, value: 25.4, unit: 'ms' });

    const row = (y, label, frac, col, text) => {
      D.text(label, 56, y + 10, { size: 12.5 });
      D.bar(130, y, 170, 12, frac, col);
      D.text(text, 366, y + 10, { size: 12.5, align: 'right', bold: true });
    };
    const xt = [-1, 0, 1, 2, 3, 4];
    const xf = (v) => (v >= 3 ? `10^{${v}}` : st.num(10 ** v, 1));
    const yf = (v) => st.num(v, 3);

    // left 56..366: sines over time (y 60..330), two bars (y 384..418)
    // right 470..736: magnitude (y 46..176) and phase (y 246..376) over log10(ω)
    st.loop((dt) => {
      const tau = tS.value / 1000;
      const wE = 1 / tau, w = two(fS.value) * wE;
      const g = lagResponse(tau, w);
      const lag = -g.deg / 360; // the output peak comes this share of a period later
      ph = (ph + dt * 0.4) % 1;
      const uIn = (x) => Math.sin(2 * Math.PI * (x + ph));
      const yOut = (x) => g.ratio * Math.sin(2 * Math.PI * (x + ph - lag));

      D.clear();
      // --- time plot, x in periods before "now"
      const m1 = D.map({ x: 56, y: 60, w: 310, h: 270, x0: -2.5, x1: 0, y0: -1.4, y1: 1.4 });
      D.legend([[t({ de: 'Eingang u', en: 'input u' }), C.U], [t({ de: 'Ausgang ω', en: 'output ω' }), C.w]], 56, 30);
      D.axes(m1, {
        xt: [], yt: [-1, 0, 1], yf,
        yl: t({ de: 'Amplitude (Eingang = 1)', en: 'amplitude (input = 1)' }),
        xl: `${t({ de: 'Zeit →   Periode', en: 'time →   period' })} ${st.si((2 * Math.PI) / w, 's')}`,
      });
      D.hline(m1, g.ratio, C.w);
      D.hline(m1, -g.ratio, C.w);
      D.curve(m1, uIn, -2.5, 0, C.U, 2.5);
      D.curve(m1, yOut, -2.5, 0, C.w, 2.5);
      // latest pair of peaks that is fully visible, and the delay between them
      const xi = 0.25 - ph + Math.floor(ph - 0.29 - lag), xo = xi + lag;
      const yb = m1.Y(-1.2);
      D.line(m1.X(xi), m1.Y(1), m1.X(xi), yb, C.U, 1.2, [3, 3]);
      D.line(m1.X(xo), m1.Y(g.ratio), m1.X(xo), yb, C.w, 1.2, [3, 3]);
      D.line(m1.X(xi), yb, m1.X(xo), yb, C.ink, 3);
      D.line(m1.X(xi), yb - 5, m1.X(xi), yb + 5, C.ink, 2);
      D.line(m1.X(xo), yb - 5, m1.X(xo), yb + 5, C.ink, 2);
      D.dot(m1, 0, uIn(0), C.U, 4.5);
      D.dot(m1, 0, yOut(0), C.w, 4.5);
      D.text(`${t({ de: 'Amplitude', en: 'amplitude' })} × ${st.num(g.ratio, 3)}`, m1.x + 8, m1.y + 18, { size: 12.5, bold: true });
      D.text(`${t({ de: 'Phase', en: 'phase' })} ${st.fix(g.deg, 1)}°`, m1.x + m1.w - 8, m1.y + 18, { size: 12.5, bold: true, align: 'right' });
      row(384, t({ de: 'Eingang', en: 'Input' }), 1, C.U, '100 %');
      row(406, t({ de: 'Ausgang', en: 'Output' }), g.ratio, C.w, `${st.num(g.ratio * 100, 3)} %`);

      // --- Bode plot
      const lx = Math.log10(w), lE = Math.log10(wE);
      const mm = D.map({ x: 470, y: 46, w: 266, h: 130, x0: -1, x1: 4, y0: -60, y1: 20 });
      const mp = D.map({ x: 470, y: 246, w: 266, h: 130, x0: -1, x1: 4, y0: -100, y1: 10 });
      D.axes(mm, { xt, xf, yt: [-60, -40, -20, 0, 20], yf, yl: t({ de: 'Betrag in dB · Abfall −20 dB/Dekade', en: 'magnitude in dB · slope −20 dB/decade' }), xl: 'ω in rad/s' });
      D.axes(mp, { xt, xf, yt: [-90, -45, 0], yf, yl: t({ de: 'Phase in ° · −45° bei 1/τ', en: 'phase in ° · −45° at 1/τ' }), xl: 'ω in rad/s' });
      D.curve(mm, (x) => (x < lE ? 0 : -20 * (x - lE)), -1, 4, C.faint, 1.4, [4, 4]);
      D.vline(mm, lE, C.dim, '1/τ');
      D.vline(mp, lE, C.dim);
      D.curve(mm, (x) => lagResponse(tau, 10 ** x).db, -1, 4, C.ink, 2.5);
      D.curve(mp, (x) => lagResponse(tau, 10 ** x).deg, -1, 4, C.ink, 2.5);
      D.dot(mm, lx, g.db, C.w, 5);
      D.dot(mp, lx, g.deg, C.w, 5);

      st.readout(`$ω$ = <b>${st.num(w, 3)} rad/s</b> &nbsp;·&nbsp; ${t({ de: 'Eckfrequenz', en: 'corner frequency' })} $1/τ$ = <b>${st.num(wE, 3)} rad/s</b> &nbsp;·&nbsp; ${t({ de: 'Amplitudenverhältnis', en: 'amplitude ratio' })} <b>${st.num(g.ratio, 3)}</b> = <b>${st.fix(g.db, 1)} dB</b> &nbsp;·&nbsp; ${t({ de: 'Phase', en: 'phase' })} <b>${st.fix(g.deg, 1)}°</b>`);
    });
  },
};

export default {
  id: 'a08',
  blocks: [
    h({ de: 'Vom Modell zur Übertragungsfunktion', en: 'From the model to the transfer function' }),
    p({
      de: 'Blatt A04 liefert zwei Gleichungen. Im Bildbereich wird jede Ableitung zu einem Faktor $s$. Dann lässt sich der Strom herauskürzen. Übrig bleibt ein Bruch: Drehzahl geteilt durch Spannung.',
      en: 'Sheet A04 gives two equations. In the Laplace domain every derivative becomes a factor $s$. Then the current can be eliminated. What remains is one fraction: speed divided by voltage.',
    }),
    formula('$[[Ω(s)|U(s)]] = [[k_m/(J·L)|s^2 + s·(R/L + C_r/J) + (k_e·k_m + C_r·R)/(J·L)]]$', {
      de: [['Ω, U', 'Drehzahl und Spannung im Bildbereich'], ['s', 'Laplace-Variable, steht für die Ableitung'], ['R/L', 'elektrische Eckfrequenz'], ['C_r/J', 'mechanische Eckfrequenz']],
      en: [['Ω, U', 'speed and voltage in the Laplace domain'], ['s', 'Laplace variable, stands for the derivative'], ['R/L', 'electrical corner frequency'], ['C_r/J', 'mechanical corner frequency']],
    }),
    p({
      de: 'Der Nenner enthält $s^2$: Das System ist zweiter Ordnung. Seine Nullstellen heißen <b>Pole</b>. Der Beispielmotor hat einen schnellen Pol bei −12 461 rad/s und einen langsamen bei −39,5 rad/s.',
      en: 'The denominator contains $s^2$: the system is second order. Its roots are called <b>poles</b> (Polstellen). The example motor has a fast pole at −12 461 rad/s and a slow one at −39.5 rad/s.',
    }),
    anim(polesAnim),
    tryIt({
      de: [
        'Schieb $L$ ganz nach links. Der schnelle Pol wandert weit nach links. Beide Kurven liegen aufeinander.',
        'Schieb $L$ langsam nach rechts. Bei etwa 32 mH treffen sich die Pole. Danach werden sie komplex und die Drehzahl schwingt über.',
        'Stell $L$ zurück auf 0,4 mH und verändere $J$. Nur der langsame Pol bewegt sich: Mehr Trägheit macht den Motor träger.',
      ],
      en: [
        'Move $L$ all the way to the left. The fast pole runs far to the left. Both curves lie on top of each other.',
        'Move $L$ slowly to the right. At about 32 mH the poles meet. After that they turn complex and the speed overshoots.',
        'Set $L$ back to 0.4 mH and change $J$. Only the slow pole moves: more inertia makes the motor more sluggish.',
      ],
    }),

    h({ de: 'Was ein Pol bedeutet', en: 'What a pole means' }),
    p({
      de: 'Ein Pol bei $s = −a$ steht für einen Anteil $e^{−a·t}$ in der Antwort. Dieser Anteil klingt mit der Zeitkonstante $1/a$ ab. Je weiter links der Pol liegt, desto schneller ist er vorbei.',
      en: 'A pole at $s = −a$ stands for a part $e^{−a·t}$ in the response. This part decays with the time constant $1/a$. The further left the pole lies, the sooner it is over.',
    }),
    table({
      head: { de: ['Pol', 'Zeitkonstante', 'Was dort passiert'], en: ['Pole', 'Time constant', 'What happens there'] },
      rows: [
        ['−12 461 rad/s', '80 µs', { de: 'Der Strom baut sich auf.', en: 'The current builds up.' }],
        [{ de: '−39,5 rad/s', en: '−39.5 rad/s' }, { de: '25,3 ms', en: '25.3 ms' }, { de: 'Der Rotor läuft hoch.', en: 'The rotor runs up.' }],
      ],
    }),
    p({
      de: 'Liegt ein Pol links von der imaginären Achse, klingt sein Anteil ab: Das System ist <b>stabil</b>. Ein komplexes Polpaar bedeutet eine Schwingung. Der Realteil dämpft sie, der Imaginärteil ist ihre Kreisfrequenz.',
      en: 'If a pole lies left of the imaginary axis, its part decays: the system is <b>stable</b>. A complex pole pair means an oscillation. The real part damps it, the imaginary part is its angular frequency.',
    }),

    h({ de: 'Ohne $L$: erste Ordnung', en: 'Without $L$: first order' }),
    p({
      de: 'Der schnelle Pol ist nach 0,4 ms abgeklungen. Für die Drehzahl spielt er kaum eine Rolle. Lässt du $L$ weg, bleibt ein Verzögerungsglied erster Ordnung (PT1).',
      en: 'The fast pole has died away after 0.4 ms. For the speed it hardly matters. If you drop $L$, a first-order lag (PT1-Glied) remains.',
    }),
    formula('$[[Ω(s)|U(s)]] = [[K|1 + s·τ]]$', {
      de: [['K', 'Verstärkung $k_m/(k_e·k_m + C_r·R)$'], ['τ', 'Zeitkonstante $J·R/(k_e·k_m + C_r·R)$']],
      en: [['K', 'gain $k_m/(k_e·k_m + C_r·R)$'], ['τ', 'time constant $J·R/(k_e·k_m + C_r·R)$']],
    }),
    p({
      de: 'Faustregel: $L$ darf entfallen, wenn $R/L > 100·C_r/J$ gilt. Beim Beispielmotor steht 12 500 gegen 100. Das passt.',
      en: 'Rule of thumb: $L$ may be dropped when $R/L > 100·C_r/J$. For the example motor it is 12 500 against 100. That fits.',
    }),

    h({ de: 'Die Sprungantwort', en: 'The step response' }),
    formula('$ω(t) = K·U·(1 − e^{−t/τ})$'),
    p({
      de: 'Nach einer Zeitkonstante $τ$ sind 63 % des Endwerts erreicht. Nach $3τ$ sind es 95 %, nach $5τ$ 99 %. Die Tangente im Startpunkt trifft den Endwert genau bei $t = τ$. In der Animation oben ist sie die dünne Linie.',
      en: 'After one time constant $τ$ the speed has reached 63 % of its final value. After $3τ$ it is 95 %, after $5τ$ 99 %. The tangent at the start hits the final value exactly at $t = τ$. In the animation above it is the thin line.',
    }),
    example({
      title: { de: 'Pole und Zeitkonstante des Beispielmotors', en: 'Poles and time constant of the example motor' },
      given: {
        de: ['$R = 5 Ω$', '$L = 0,4$ mH', '$k_e = k_m = 0,024$', '$J = 3·10^{-6}$ kg·m²', '$C_r = 3·10^{-6}$ N·m·s'],
        en: ['$R = 5 Ω$', '$L = 0.4$ mH', '$k_e = k_m = 0.024$', '$J = 3·10^{-6}$ kg·m²', '$C_r = 3·10^{-6}$ N·m·s'],
      },
      steps: {
        de: [
          'Mittlerer Koeffizient: $R/L + C_r/J = 12 500 + 1 = 12 501$ s⁻¹.',
          'Letzter Koeffizient: $(k_e·k_m + C_r·R)/(J·L) = 5,91·10^{-4}/(1,2·10^{-9}) = 492 500$ s⁻².',
          'Nullstellen von $s^2 + 12 501·s + 492 500$: $s_1 = −12 461$ rad/s und $s_2 = −39,5$ rad/s.',
          'Ohne $L$: $τ = J·R/(k_e·k_m + C_r·R) = 1,5·10^{-5}/(5,91·10^{-4}) = 25,4$ ms.',
          'Probe: $1/τ = 39,4$ s⁻¹. Das liegt dicht am langsamen Pol.',
          'Verstärkung: $K = 0,024/(5,91·10^{-4}) = 40,6$ rad/(V·s).',
        ],
        en: [
          'Middle coefficient: $R/L + C_r/J = 12 500 + 1 = 12 501$ s⁻¹.',
          'Last coefficient: $(k_e·k_m + C_r·R)/(J·L) = 5.91·10^{-4}/(1.2·10^{-9}) = 492 500$ s⁻².',
          'Roots of $s^2 + 12 501·s + 492 500$: $s_1 = −12 461$ rad/s and $s_2 = −39.5$ rad/s.',
          'Without $L$: $τ = J·R/(k_e·k_m + C_r·R) = 1.5·10^{-5}/(5.91·10^{-4}) = 25.4$ ms.',
          'Check: $1/τ = 39.4$ s⁻¹. That is close to the slow pole.',
          'Gain: $K = 0.024/(5.91·10^{-4}) = 40.6$ rad/(V·s).',
        ],
      },
      result: {
        de: 'Pole bei −12 461 und −39,5 rad/s. Ohne $L$: $τ = 25,4$ ms und $K = 40,6$ rad/(V·s).',
        en: 'Poles at −12 461 and −39.5 rad/s. Without $L$: $τ = 25.4$ ms and $K = 40.6$ rad/(V·s).',
      },
    }),

    h({ de: 'Stromgesteuert ist der Motor träge', en: 'Current-driven, the motor is sluggish' }),
    p({
      de: 'Eine Stromregelung (Blatt A06) gibt den Strom vor statt der Spannung. Dann fällt die bremsende Gegenspannung aus der Rechnung. Nur noch die Reibung begrenzt die Drehzahl.',
      en: 'A current controller (sheet A06) sets the current instead of the voltage. Then the braking back-EMF drops out of the calculation. Only friction still limits the speed.',
    }),
    formula('$[[Ω(s)|I(s)]] = [[k_m/J|s + C_r/J]]$'),
    p({
      de: 'Der Pol liegt bei $−C_r/J = −1$ s⁻¹. Die Zeitkonstante ist $J/C_r = 1$ s, rund vierzigmal länger als vorher. Die Verstärkung ist $k_m/C_r = 8000$ rad/(A·s).',
      en: 'The pole lies at $−C_r/J = −1$ s⁻¹. The time constant is $J/C_r = 1$ s, about forty times longer than before. The gain is $k_m/C_r = 8000$ rad/(A·s).',
    }),

    h({ de: 'Der Frequenzgang', en: 'The frequency response' }),
    p({
      de: 'Speise das Verzögerungsglied mit einem Sinus. Am Ausgang erscheint wieder ein Sinus mit derselben Frequenz. Er ist aber kleiner und kommt später.',
      en: 'Feed the lag with a sine. At the output a sine of the same frequency appears. But it is smaller and it comes later.',
    }),
    anim(bodeAnim),
    tryIt({
      de: [
        'Schieb die Frequenz ganz nach links. Der Ausgang folgt dem Eingang fast perfekt.',
        'Stell genau $1/τ$ ein. Die Amplitude fällt auf 71 %, das sind −3 dB. Die Phase ist −45°.',
        'Geh auf das Zehnfache von $1/τ$. Es bleiben 10 %, also −20 dB. Der Ausgang hinkt fast eine Viertelperiode hinterher.',
        'Vergrößere $τ$. Die Eckfrequenz $1/τ$ wandert nach links.',
      ],
      en: [
        'Move the frequency all the way to the left. The output follows the input almost perfectly.',
        'Set exactly $1/τ$. The amplitude drops to 71 %, that is −3 dB. The phase is −45°.',
        'Go to ten times $1/τ$. 10 % remain, that is −20 dB. The output lags by almost a quarter period.',
        'Increase $τ$. The corner frequency $1/τ$ moves to the left.',
      ],
    }),
    p({
      de: 'Das Bode-Diagramm zeigt beides über einer logarithmischen Frequenzachse. Bis zur Eckfrequenz $1/τ$ bleibt der Betrag flach. Danach fällt er mit 20 dB pro Dekade. Die Phase geht von 0° über −45° nach −90°.',
      en: 'The Bode plot shows both over a logarithmic frequency axis. Up to the corner frequency (Eckfrequenz) $1/τ$ the magnitude stays flat. After that it falls by 20 dB per decade. The phase goes from 0° through −45° towards −90°.',
    }),
    note({
      de: [
        'Ein Pol bei $−a$ heißt: Anteil $e^{−a·t}$, Zeitkonstante $1/a$.',
        'Links der imaginären Achse ist stabil. Komplexe Pole schwingen.',
        'Ohne $L$ ist der Motor ein PT1: 63 % nach $τ$, Eckfrequenz $1/τ$.',
      ],
      en: [
        'A pole at $−a$ means: a part $e^{−a·t}$, time constant $1/a$.',
        'Left of the imaginary axis is stable. Complex poles oscillate.',
        'Without $L$ the motor is a first-order lag: 63 % after $τ$, corner frequency $1/τ$.',
      ],
    }),
    quiz([
      {
        q: {
          de: 'Der Beispielmotor ($K = 40,6$ rad/(V·s), $τ = 25,4$ ms) bekommt einen Sprung auf 12 V. Wie schnell dreht er nach 25,4 ms?',
          en: 'The example motor ($K = 40.6$ rad/(V·s), $τ = 25.4$ ms) gets a step to 12 V. How fast does it turn after 25.4 ms?',
        },
        answer: 308, unit: 'rad/s', decimals: 0,
        why: { de: 'Der Endwert ist $K·U = 487$ rad/s. Nach einem $τ$ sind 63,2 % davon erreicht.', en: 'The final value is $K·U = 487$ rad/s. After one $τ$ 63.2 % of it is reached.' },
      },
      {
        q: { de: 'Ein PT1 hat $τ = 20$ ms. Wie groß ist seine Eckfrequenz?', en: 'A first-order lag has $τ = 20$ ms. How large is its corner frequency?' },
        answer: 50, unit: 'rad/s', decimals: 0,
        why: { de: '$1/τ = 1/(0,02$ s$)$.', en: '$1/τ = 1/(0.02$ s$)$.' },
      },
      {
        q: { de: 'Du machst $L$ zehnmal kleiner. Was passiert?', en: 'You make $L$ ten times smaller. What happens?' },
        options: {
          de: ['Der schnelle Pol wandert nach links, der Hochlauf bleibt fast gleich', 'Beide Pole wandern nach links', 'Der Motor wird instabil'],
          en: ['The fast pole moves left, the run-up stays almost the same', 'Both poles move left', 'The motor becomes unstable'],
        },
        correct: 0,
        why: { de: 'Der schnelle Pol liegt nahe $−R/L$. Der langsame hängt kaum von $L$ ab.', en: 'The fast pole lies near $−R/L$. The slow one hardly depends on $L$.' },
      },
    ]),
  ],
};
