// A02 — Force and induction: force on a wire, induced voltage, and the bridge to the motor.

import { h, p, anim, formula, tryIt, note, example, quiz, table } from '../core/dsl.js';
import { Trace, clamp } from '../core/draw.js';
import { wireForce, lagStep, MAGNET_COIL, coilFlux, magnetVoltage } from '../physics/emag.js';

const TAU = 2 * Math.PI;

/** Wire in cross-section: dot = current towards the viewer, cross = away, empty = no current. */
function wireSection(D, C, x, y, r, i) {
  const k = r * 0.55;
  D.circle(x, y, r, { fill: C.panel, stroke: C.i, lw: 3 });
  if (i > 0) D.circle(x, y, r * 0.28, { fill: C.i });
  if (i < 0) { D.line(x - k, y - k, x + k, y + k, C.i, 3); D.line(x - k, y + k, x + k, y - k, C.i, 3); }
}

// ------------------------------------------------------------------ force on a wire
// Regions (760 x 420):
//   left 24..520: ceiling y 24..38, B label y 58, poles x 40..110 and 450..520 (y 70..370),
//     wire at x 280, rest y 220, travel ±50, radius 20, force arrow up to 80 -> y 68..372 · state text y 402
//   right 560..744: tripod (title y 40, origin 630/130, arms 62 -> y 68..192) · value bars y 238..374
const LZ = { cx: 280, cy: 220, r: 20, fMax: 0.5, travel: 50, arrow: 80, tau: 0.25 };

const lorentz = {
  id: 'a02-lorentz',
  title: { de: 'Kraft auf einen Leiter im Magnetfeld', en: 'Force on a wire in a magnetic field' },
  hint: {
    de: 'Du schaust auf das Ende des Leiters. Punkt: Strom kommt auf dich zu. Kreuz: Strom fließt weg.',
    en: 'You look at the end of the wire. Dot: current comes towards you. Cross: current flows away.',
  },
  height: 420,
  build(st) {
    const { D, C, t } = st;
    const iS = st.slider({ label: { de: 'Strom $i$', en: 'Current $i$' }, min: -5, max: 5, step: 0.5, value: 4, unit: 'A' });
    const bS = st.slider({ label: { de: 'Flussdichte $B$', en: 'Flux density $B$' }, min: 0, max: 1, step: 0.05, value: 0.8, unit: 'T' });
    const lS = st.slider({ label: { de: 'Länge im Feld $l$', en: 'Length in the field $l$' }, min: 1, max: 10, step: 1, value: 8, unit: 'cm' });
    let lift = 0; // shown deflection in px, up positive

    const barRow = (y, label, frac, col, text, signed) => {
      D.text(label, 560, y + 10, { size: 13.5, bold: true, col });
      D.bar(582, y, 84, 12, frac, col, { signed });
      D.text(text, 744, y + 10, { size: 12.5, align: 'right' });
    };

    const drawField = (B) => {
      D.pole(40, 70, 70, 300, 'N', { size: 24 });
      D.pole(450, 70, 70, 300, 'S', { size: 24 });
      const lines = Math.round(B * 8);
      for (let k = 0; k < lines; k++) {
        const y = 70 + (300 * (k + 0.5)) / lines;
        D.arrow(118, y, 440, y, C.faint, 1.4);
      }
      D.text('B', 130, 58, { size: 14, bold: true });
      D.arrow(146, 53, 186, 53, C.ink, 2);
    };

    const drawTripod = (i, B, dir) => {
      D.text(t({ de: 'Richtungen', en: 'directions' }), 560, 40, { size: 13, bold: true, col: C.dim });
      if (B > 0) { D.arrow(642, 130, 702, 130, C.ink, 2.5); D.text('B', 710, 135, { size: 15, bold: true }); }
      if (dir !== 0) {
        D.arrow(630, 130 - dir * 12, 630, 130 - dir * 62, C.M, 2.5);
        D.text('F', 641, 130 - dir * 50, { size: 15, bold: true, col: C.M, base: 'middle' });
      } else D.text(t({ de: 'keine Kraft', en: 'no force' }), 630, 180, { size: 13, align: 'center', col: C.dim });
      wireSection(D, C, 630, 130, 11, i);
      D.text('i', 606, 135, { size: 15, bold: true, col: C.i, align: 'right' });
    };

    st.loop((dt) => {
      const i = iS.value, B = bS.value, l = lS.value / 100;
      const F = wireForce(B, i, l) || 0;
      lift = lagStep(lift, (F / LZ.fMax) * LZ.travel, LZ.tau, dt);
      const wy = LZ.cy - lift, dir = Math.sign(F), len = (Math.abs(F) / LZ.fMax) * LZ.arrow;

      D.clear();
      drawField(B);

      // --- wire on soft springs
      D.hatch(215, 24, 130, 14);
      D.line(215, 38, 345, 38, C.ink, 2);
      [225, 335].forEach((x) => D.spring(x, 38, x, wy, { coils: 9, amp: 7, col: C.dim, lw: 1.6 }));
      D.line(225, wy, 335, wy, C.dim, 2.5);
      wireSection(D, C, LZ.cx, wy, LZ.r, i);
      if (dir !== 0) {
        const y0 = wy - dir * (LZ.r + 2), y1 = y0 - dir * len;
        D.arrow(LZ.cx, y0, LZ.cx, y1, C.M, 4);
        D.text('F', LZ.cx + 18, (y0 + y1) / 2 - dir * 10, { size: 15, bold: true, col: C.M, base: 'middle', bg: C.paper });
      }
      const flow = { de: i > 0 ? 'Strom kommt auf dich zu' : i < 0 ? 'Strom fließt von dir weg' : 'kein Strom', en: i > 0 ? 'current comes towards you' : i < 0 ? 'current flows away from you' : 'no current' };
      D.text(t(flow), LZ.cx, 402, { size: 13, align: 'center', col: C.dim });

      drawTripod(i, B, dir);

      // --- values
      D.text('F = B·i·l', 560, 238, { size: 14, bold: true });
      barRow(260, 'i', i / 5, C.i, `${st.fix(i, 1)} A`, true);
      barRow(294, 'B', B, C.dim, `${st.fix(B, 2)} T`, false);
      barRow(328, 'l', l / 0.1, C.dim, `${st.fix(l * 100, 0)} cm`, false);
      barRow(362, 'F', F / LZ.fMax, C.M, `${st.num(F * 1000, 3)} mN`, true);

      const word = { de: dir > 0 ? 'nach oben ↑' : dir < 0 ? 'nach unten ↓' : 'keine Kraft', en: dir > 0 ? 'upwards ↑' : dir < 0 ? 'downwards ↓' : 'no force' };
      st.readout(`$F = B·i·l$ = ${st.fix(B, 2)} T · ${st.fix(i, 1)} A · ${st.fix(l, 2)} m &nbsp;→&nbsp; <span class="M">|F| = <b>${st.num(Math.abs(F) * 1000, 3)} mN</b></span> &nbsp;·&nbsp; ${t(word)}`);
    });
  },
};

// ------------------------------------------------------------------ induction
// Regions (760 x 460):
//   top left 60..480: magnet path y 96 (±153 px around x 270, half length 55), coil x 232..308, y 54..138
//     v arrow y 36 · turns label right-aligned at x 224, y 158 · drag hint x 24, y 158 · leads y 160 and 174
//   top right 580..700: voltmeter box y 50..136, scale numbers y 43
//   plots x 70..740: Φ(t) y 210..276 · U(t) y 346..408 (time title y 439)
const IN = { cx: 270, cy: 96, scale: 1700, amp: 0.09, vMax: 0.6, follow: 0.08, uMax: 0.5, span: 6 };

const induction = {
  id: 'a02-induction',
  title: { de: 'Ein Magnet fährt durch eine Spule', en: 'A magnet moves through a coil' },
  hint: {
    de: 'Auto: Der Magnet pendelt von selbst. Hand: Zieh den Magneten mit Maus oder Finger.',
    en: 'Auto: the magnet swings by itself. Hand: drag the magnet with mouse or finger.',
  },
  height: 460,
  build(st) {
    const { D, C, t } = st;
    const { phi0, a } = MAGNET_COIL;
    const trPhi = new Trace(600), trU = new Trace(600);
    let x = -IN.amp, v = 0, phase = -Math.PI / 2, target = x, dragging = false, tSim = 0;

    const toMode = (m) => {
      if (m === 'hand') { target = x; v = 0; } else { phase = Math.asin(clamp(x / IN.amp, -1, 1)); dragging = false; }
    };
    const mode = st.select({
      label: { de: 'Modus', en: 'Mode' }, value: 'auto', on: toMode,
      options: [{ v: 'auto', label: { de: 'Auto', en: 'Auto' } }, { v: 'hand', label: { de: 'Hand', en: 'Hand' } }],
    });
    const fS = st.slider({ label: { de: 'Tempo (Auto)', en: 'Pace (auto)' }, min: 0, max: 1, step: 0.1, value: 0.5, unit: 'Hz' });
    const nS = st.slider({ label: { de: 'Windungen $N$', en: 'Turns $N$' }, min: 50, max: 500, step: 50, value: 400 });

    const aim = (px) => { target = clamp((px - IN.cx) / IN.scale, -IN.amp, IN.amp); };
    st.pointer({
      down(px, py) {
        if (py > 180) return;
        if (mode.value !== 'hand') { mode.set('hand'); toMode('hand'); }
        dragging = true; st.play(); aim(px);
      },
      move(px, py, held) { if (held && dragging) aim(px); },
      up() { dragging = false; },
    });

    const advance = (dt) => {
      if (mode.value === 'auto') {
        const w = TAU * fS.value;
        phase = (phase + w * dt) % TAU;
        x = IN.amp * Math.sin(phase);
        v = IN.amp * w * Math.cos(phase);
        return;
      }
      if (!(dt > 0)) return;
      v = clamp((target - x) / IN.follow, -IN.vMax, IN.vMax);
      if (Math.abs(v) < 1e-3) { x = target; v = 0; } else x += v * dt;
    };

    // one half of every turn: side −1 = front, +1 = back
    const halfTurns = (n, side, lw) => {
      for (let j = 0; j < n; j++) {
        const xj = 240 + (60 * j) / (n - 1);
        const pts = Array.from({ length: 13 }, (_, k) => {
          const b = -Math.PI / 2 + (Math.PI * k) / 12;
          return [xj + side * 8 * Math.cos(b), IN.cy + 42 * Math.sin(b)];
        });
        D.poly(pts, C.cu, lw);
      }
    };

    const drawSetup = (N, U) => {
      const mx = IN.cx + x * IN.scale, vLen = v * 110, turns = 3 + Math.round(N / 80);
      D.wire([[240, 138], [240, 174], [660, 174], [660, 136]]);
      D.wire([[300, 138], [300, 160], [620, 160], [620, 136]]);
      halfTurns(turns, 1, 1.5);
      D.barMagnet(mx, IN.cy, 110, 30);
      halfTurns(turns, -1, 2.5);
      D.text(`N = ${N}`, 224, 158, { size: 13, align: 'right', bold: true });
      if (mode.value === 'hand') D.text(t({ de: '↔ Magnet ziehen', en: '↔ drag the magnet' }), 24, 158, { size: 12.5, col: C.dim });
      if (Math.abs(vLen) >= 4) {
        D.arrow(mx, 36, mx + vLen, 36, C.w, 2.5);
        D.text('v', mx - Math.sign(v) * 12, 40, { size: 14, bold: true, col: C.w, align: 'center' });
      }
      D.gauge(640, 112, 52, U / IN.uMax, { signed: true, col: C.U, label: 'U in mV' });
      D.text('−500', 574, 43, { size: 12, col: C.dim });
      D.text('0', 640, 43, { size: 12, col: C.dim, align: 'center' });
      D.text('+500', 706, 43, { size: 12, col: C.dim, align: 'right' });
    };

    const drawPlots = (Phi, U) => {
      const x0 = Math.max(0, tSim - IN.span);
      const xt = Array.from({ length: IN.span + 1 }, (_, k) => Math.ceil(x0) + k).filter((s) => s <= x0 + IN.span);
      const mp = D.map({ x: 70, y: 210, w: 670, h: 66, x0, x1: x0 + IN.span, y0: 0, y1: 60 });
      const mu = D.map({ x: 70, y: 346, w: 670, h: 62, x0, x1: x0 + IN.span, y0: -500, y1: 500 });
      const yf = (k) => st.fix(k, 0);
      D.axes(mp, { xt, yt: [0, 25, 50], yf, yl: t({ de: 'Fluss Φ in µWb', en: 'flux Φ in µWb' }) });
      D.axes(mu, { xt, yt: [-500, 0, 500], yf, yl: t({ de: 'Spannung U in mV', en: 'voltage U in mV' }), xl: 't in s' });
      D.series(mp, trPhi.pts, C.ink, 2.2);
      D.series(mu, trU.pts, C.U, 2.5);
      D.dot(mp, tSim, Phi * 1e6, C.ink, 4);
      D.dot(mu, tSim, U * 1000, C.U, 4);
    };

    st.loop((dt) => {
      advance(dt);
      const Phi = coilFlux(x, phi0, a), U = magnetVoltage(nS.value, x, v, phi0, a) || 0;
      if (dt > 0) { tSim += dt; trPhi.push(tSim, Phi * 1e6); trU.push(tSim, U * 1000); }

      D.clear();
      drawSetup(nS.value, U);
      drawPlots(Phi, U);

      const mV = Math.round(U * 1000) || 0, vShown = Math.round(v * 100) / 100 || 0;
      st.readout(`$Φ$ = <b>${st.fix(Phi * 1e6, 1)} µWb</b> &nbsp;·&nbsp; <span class="w">v = <b>${st.fix(vShown, 2)} m/s</b></span> &nbsp;·&nbsp; <span class="U">U = <b>${st.fix(mV, 0)} mV</b></span>`);
    });
  },
};

export default {
  id: 'a02',
  blocks: [
    h({ de: 'Strom im Feld spürt eine Kraft', en: 'Current in a field feels a force' }),
    p({
      de: 'Ein Leiter hängt zwischen zwei Magnetpolen. Fließt Strom, drückt das Feld ihn nach oben oder unten. Das ist die Lorentzkraft.',
      en: 'A wire hangs between two magnet poles. When current flows, the field pushes it up or down. This is the Lorentz force (Lorentzkraft).',
    }),
    anim(lorentz),
    tryIt({
      de: [
        'Zieh $i$ langsam von +5 A nach −5 A. Die Kraft wird kleiner, null und dreht dann um.',
        'Setz $i$ = 5 A, $B$ = 1 T, $l$ = 10 cm. Das ist das Maximum: 500 mN.',
        'Halbiere nur $l$ auf 5 cm. Die Kraft halbiert sich auch.',
      ],
      en: [
        'Drag $i$ slowly from +5 A to −5 A. The force shrinks, reaches zero and then flips.',
        'Set $i$ = 5 A, $B$ = 1 T, $l$ = 10 cm. This is the maximum: 500 mN.',
        'Halve only $l$ to 5 cm. The force halves as well.',
      ],
    }),
    formula('$F = B·i·l$', {
      de: [['F', 'Kraft in N'], ['B', 'Flussdichte in T'], ['i', 'Strom in A'], ['l', 'Leiterlänge im Feld, senkrecht zum Feld']],
      en: [['F', 'force in N'], ['B', 'flux density in T'], ['i', 'current in A'], ['l', 'wire length in the field, perpendicular to it']],
    }),
    p({
      de: 'Die Richtung zeigt die rechte Hand. Daumen: Strom. Zeigefinger: Feld. Mittelfinger: Kraft. Dreht Strom <b>oder</b> Feld um, dreht auch die Kraft.',
      en: 'The right hand shows the direction. Thumb: current. Index finger: field. Middle finger: force. If current <b>or</b> field reverses, the force reverses too.',
    }),
    example({
      title: { de: 'Kraft auf 5 cm Draht', en: 'Force on 5 cm of wire' },
      given: {
        de: ['$i = 2$ A', '$l = 5$ cm', '$B = 0,5$ T', 'Leiter senkrecht zum Feld'],
        en: ['$i = 2$ A', '$l = 5$ cm', '$B = 0.5$ T', 'wire perpendicular to the field'],
      },
      steps: {
        de: ['Länge in Meter: $l = 0,05$ m.', 'Einsetzen: $F = B·i·l = 0,5·2·0,05$.', 'Ergebnis: $F = 0,05$ N.'],
        en: ['Length in metres: $l = 0.05$ m.', 'Insert: $F = B·i·l = 0.5·2·0.05$.', 'Result: $F = 0.05$ N.'],
      },
      result: { de: '$F = 0,05$ N $= 50$ mN', en: '$F = 0.05$ N $= 50$ mN' },
    }),

    h({ de: 'Fluss, der sich ändert, macht Spannung', en: 'Changing flux makes voltage' }),
    p({
      de: 'Jetzt der umgekehrte Weg. Ein Magnet bewegt sich, und an der Spule entsteht Spannung.',
      en: 'Now the other way round. A magnet moves, and a voltage appears at the coil.',
    }),
    anim(induction),
    tryIt({
      de: [
        'Stell das Tempo auf 0. Der Magnet steht still, und $U$ ist null.',
        'Wähle <b>Hand</b> und fahr durch die Mitte. Dort ist $Φ$ am größten und $U$ wechselt das Vorzeichen.',
        'Verdopple $N$ oder das Tempo. Beides verdoppelt die höchste Spannung.',
      ],
      en: [
        'Set the pace to 0. The magnet stands still, and $U$ is zero.',
        'Choose <b>Hand</b> and move through the centre. There $Φ$ is largest and $U$ changes sign.',
        'Double $N$ or the pace. Both double the peak voltage.',
      ],
    }),
    formula('$U = −N·[[dΦ|dt]]$', {
      de: [['U', 'induzierte Spannung in V'], ['N', 'Windungszahl'], ['dΦ/dt', 'Änderung des Flusses pro Zeit, in Wb/s = V']],
      en: [['U', 'induced voltage in V'], ['N', 'number of turns'], ['dΦ/dt', 'change of flux per time, in Wb/s = V']],
    }),
    p({
      de: 'Das Minus ist die <b>Lenzsche Regel</b>: Die Wirkung bremst ihre Ursache. Schließt du die Spule kurz, bremst ihr Strom den Magneten.',
      en: 'The minus sign is <b>Lenz’s rule</b> (Lenzsche Regel): the effect opposes its cause. If you short the coil, its current brakes the magnet.',
    }),

    h({ de: 'Vier Effekte im Motor', en: 'Four effects in a motor' }),
    table({
      head: { de: ['Effekt', 'Formel', 'Beispiel'], en: ['Effect', 'Formula', 'Example'] },
      rows: [
        [{ de: 'Strom macht ein Feld', en: 'Current makes a field' }, '$B = [[μ_0·i|2π·r]]$', { de: '10 A in 1 cm Abstand: 0,2 mT', en: '10 A at 1 cm distance: 0.2 mT' }],
        [{ de: 'Flussänderung macht Spannung', en: 'Changing flux makes voltage' }, '$U = −N·[[dΦ|dt]]$', { de: '200 Windungen, 50 µWb in 0,1 s: Betrag 0,1 V', en: '200 turns, 50 µWb in 0.1 s: magnitude 0.1 V' }],
        [{ de: 'Strom im Feld spürt eine Kraft', en: 'Current in a field feels a force' }, '$F = B·i·l$', { de: '2 A, 5 cm, 0,5 T: 0,05 N', en: '2 A, 5 cm, 0.5 T: 0.05 N' }],
        [{ de: 'Eisen wird gezogen: Der Luftspalt soll kleiner werden', en: 'Iron is pulled to shrink the air gap' }, '$F = [[1|2]]·i^2·[[dL|dx]]$', { de: '1 A und 0,5 H/m: 0,25 N', en: '1 A and 0.5 H/m: 0.25 N' }],
      ],
    }),

    h({ de: 'Die Brücke zum Motor', en: 'The bridge to the motor' }),
    p({
      de: 'Wickle den Draht auf einen Rotor. Aus der Kraft wird ein Moment. Aus der Bewegung wird eine Spannung.',
      en: 'Wind the wire onto a rotor. The force becomes a torque. The motion becomes a voltage.',
    }),
    formula('$M_M = k_m·i$ &nbsp;&nbsp; $U_i = k_e·ω$', {
      de: [['M_M', 'Motormoment'], ['k_m', 'Drehmomentkonstante'], ['U_i', 'induzierte Spannung'], ['k_e', 'Generatorkonstante'], ['ω', 'Winkelgeschwindigkeit']],
      en: [['M_M', 'motor torque'], ['k_m', 'torque constant'], ['U_i', 'induced voltage'], ['k_e', 'generator constant'], ['ω', 'angular speed']],
    }),
    note({
      de: [
        'Strom im Feld macht Kraft: $F = B·i·l$.',
        'Änderung des Flusses macht Spannung: $U = −N·dΦ/dt$. Ohne Änderung keine Spannung.',
        'Beides passiert im Motor gleichzeitig.',
      ],
      en: [
        'Current in a field makes force: $F = B·i·l$.',
        'Changing flux makes voltage: $U = −N·dΦ/dt$. No change, no voltage.',
        'In a motor both happen at the same time.',
      ],
    }),
    quiz([
      {
        q: { de: 'Ein Leiter führt 4 A. 10 cm davon liegen senkrecht in einem Feld von 0,2 T. Wie groß ist $F$?', en: 'A wire carries 4 A. 10 cm of it lie perpendicular in a field of 0.2 T. How large is $F$?' },
        answer: 80, unit: 'mN', decimals: 0,
        why: { de: '$F = 0,2·4·0,1 = 0,08$ N, also 80 mN.', en: '$F = 0.2·4·0.1 = 0.08$ N, that is 80 mN.' },
      },
      {
        q: { de: 'Du drehst Strom <b>und</b> Feld um. Was macht die Kraft?', en: 'You reverse current <b>and</b> field. What does the force do?' },
        options: { de: ['Sie dreht um', 'Sie bleibt gleich', 'Sie wird null'], en: ['It reverses', 'It stays the same', 'It becomes zero'] },
        correct: 1,
        why: { de: 'Zweimal umdrehen hebt sich auf: $(−B)·(−i) = B·i$.', en: 'Two reversals cancel: $(−B)·(−i) = B·i$.' },
      },
      {
        q: { de: 'Der Fluss in 400 Windungen steigt in 0,1 s gleichmäßig um 50 µWb. Wie groß ist der Betrag von $U$?', en: 'The flux in 400 turns rises evenly by 50 µWb in 0.1 s. What is the magnitude of $U$?' },
        answer: 0.2, unit: 'V', decimals: 1,
        why: { de: '$400·50·10^{-6} / 0,1 = 0,2$ V.', en: '$400·50·10^{-6} / 0.1 = 0.2$ V.' },
      },
      {
        q: { de: 'Ein starker Magnet liegt ruhig in der Spule. Welche Spannung misst du?', en: 'A strong magnet rests inside the coil. What voltage do you measure?' },
        options: { de: ['Die größte', 'Null', 'Eine kleine konstante'], en: ['The largest', 'Zero', 'A small constant one'] },
        correct: 1,
        why: { de: 'Der Fluss ist groß, aber er ändert sich nicht.', en: 'The flux is large, but it does not change.' },
      },
    ]),
  ],
};
