// A03 — The DC motor: one loop, the commutator, several coils, and why k_e equals k_m.
//
// Rotor angle θ everywhere on this sheet: clockwise from the vertical neutral axis (the axis
// perpendicular to the field) to conductor a. θ = 0: conductor a is at the top. Field points right.

import { h, p, anim, formula, tryIt, note, example, quiz, table } from '../core/dsl.js';
import {
  DEMO_LOOP, loopTorque, loopMeanTorque, loopCurrentSign, stepLoopRotor, wrapAngle,
  coilAngle, coilTorque, multiCoilTorque, torqueRipple,
} from '../physics/emag.js';

const TAU = 2 * Math.PI;
const DEG = 180 / Math.PI;

/** Point at radius r and angle th (clockwise from the top) around (cx, cy). */
const polar = (cx, cy, r, th) => [cx + r * Math.sin(th), cy - r * Math.cos(th)];

/** Conductor cross-section. dir > 0: away from the viewer (cross), dir < 0: towards (dot), 0: no current. */
function conductor(D, C, x, y, r, dir, ring = C.ink) {
  const k = r * 0.5;
  D.circle(x, y, r, { fill: C.panel, stroke: ring, lw: 2.5 });
  if (dir > 0) { D.line(x - k, y - k, x + k, y + k, C.i, 2.2); D.line(x - k, y + k, x + k, y - k, C.i, 2.2); }
  if (dir < 0) D.circle(x, y, r * 0.32, { fill: C.i });
}

/** Magnet poles left and right of a rotor plus faint field arrows between them. */
function stator(D, C, g) {
  D.pole(g.xN, g.y, g.w, g.h, 'N', { size: 22 });
  D.pole(g.xS, g.y, g.w, g.h, 'S', { size: 22 });
  for (let k = 0; k < 5; k++) {
    const y = g.y + (g.h * (k + 0.5)) / 5;
    D.arrow(g.xN + g.w + 6, y, g.xS - 6, y, C.faint, 1.3);
  }
}

/** Ring segment around angle `mid` (clockwise from the top). */
function segment(D, cx, cy, r, mid, half, col, lw) {
  const c = mid - Math.PI / 2; // canvas angle
  D.arc(cx, cy, r, c - half, c + half, col, lw);
}

/** Two fixed brushes left (−) and right (+) of a ring. inL / inR: inner edge distance from the centre. */
function brushes(D, C, cx, cy, inL, inR, out) {
  D.rect(cx + inR, cy - 9, out - inR, 18, { fill: C.ink, r: 2 });
  D.rect(cx - out, cy - 9, out - inL, 18, { fill: C.ink, r: 2 });
  D.text('+', cx + out - 8, cy, { size: 14, bold: true, align: 'center', base: 'middle', col: C.paper });
  D.text('−', cx - out + 8, cy, { size: 14, bold: true, align: 'center', base: 'middle', col: C.paper });
}

// ------------------------------------------------------------------ one loop, commutator on / off
// Regions (760 x 430):
//   left 24..416: angle text x 24, y 34 · poles x 24..84 and 356..416 (y 105..305) · rotor centre 220/205,
//     conductors on radius 95, force arrows up to 45 px -> y 54..356 · state lines y 388 and 410
//   right 440..740: plot x 482..736, y 60..310 (axis title y 341) · legend y 372
const ST1 = { xN: 24, xS: 356, w: 60, h: 200, y: 105 };
const LP = { cx: 220, cy: 205, R: 95, iMax: 3, wMax: 9, push: 2.5, start: Math.PI / 3 };

const commutator = {
  id: 'a03-commutator',
  title: { de: 'Eine Schleife, mit und ohne Kommutator', en: 'One loop, with and without commutator' },
  hint: {
    de: 'Zeitlupe. Grüner Ring: Leiter a. Kreuz: Strom fließt von dir weg. Punkt: Strom kommt auf dich zu.',
    en: 'Slow motion. Green ring: conductor a. Cross: current flows away from you. Dot: current comes towards you.',
  },
  height: 430,
  build(st) {
    const { D, C, t } = st;
    let state = { theta: LP.start, w: 0 };
    const comm = st.toggle({ label: { de: 'Kommutator (aus: Schleifringe)', en: 'Commutator (off: slip rings)' }, value: true });
    const iS = st.slider({ label: { de: 'Strom $i$', en: 'Current $i$' }, min: 0, max: LP.iMax, step: 0.1, value: 1.5, unit: 'A' });
    st.button({ de: 'anstoßen', en: 'push' }, () => {
      state = { ...state, w: Math.min(LP.wMax, state.w + LP.push) };
      st.play();
    }, 'primary');
    st.button({ de: 'Auf den Totpunkt', en: 'To the dead point' }, () => { state = { theta: 0, w: 0 }; });

    const drawRings = (th, on) => {
      const { cx, cy } = LP;
      if (on) {
        segment(D, cx, cy, 31, th, Math.PI / 2 - 0.14, C.cu, 9);
        segment(D, cx, cy, 31, th + Math.PI, Math.PI / 2 - 0.14, C.dim, 9);
        brushes(D, C, cx, cy, 37, 37, 56);
      } else {
        D.circle(cx, cy, 31, { stroke: C.cu, lw: 8 });
        D.circle(cx, cy, 17, { stroke: C.dim, lw: 8 });
        brushes(D, C, cx, cy, 22, 36, 56);
      }
    };

    const drawMotor = (th, i, on) => {
      const { cx, cy, R } = LP;
      stator(D, C, ST1);
      D.circle(cx, cy, R, { stroke: C.faint, lw: 1.3, dash: [4, 5] });
      D.line(cx, cy - 118, cx, cy + 118, C.dim, 1.2, [6, 5]);
      const A = polar(cx, cy, R, th), B = polar(cx, cy, R, th + Math.PI);
      D.line(A[0], A[1], ...polar(cx, cy, on ? 35 : 31, th), C.cu, 4);
      D.line(B[0], B[1], ...polar(cx, cy, on ? 35 : 17, th + Math.PI), C.dim, 4);
      drawRings(th, on);
      if (th > 0.7 && th < 5.6) {
        D.arcArrow(cx, cy, 66, -Math.PI / 2, th - Math.PI / 2, C.w, 1.6);
        const [lx, ly] = polar(cx, cy, 80, th / 2);
        D.text('θ', lx, ly, { size: 14, bold: true, col: C.w, align: 'center', base: 'middle' });
      }
      // field to the right, current away from the viewer: force points down
      const dirA = i > 0 ? loopCurrentSign(th, on) : 0;
      const force = ([x, y], dir) => {
        if (dir === 0) return;
        const len = 45 * (i / LP.iMax);
        D.arrow(x, y + dir * 12, x, y + dir * (12 + len), C.M, 3.5);
        if (len > 14) D.text('F', x + 9, y + dir * (12 + len * 0.6), { size: 13, bold: true, col: C.M, base: 'middle' });
      };
      force(A, dirA); force(B, -dirA);
      conductor(D, C, A[0], A[1], 11, dirA, C.w);
      conductor(D, C, B[0], B[1], 11, -dirA, C.ink);
      D.text(`θ = ${st.fix(th * DEG, 0)}°`, 24, 34, { size: 14, bold: true, col: C.w });
      return dirA;
    };

    const drawPlot = (th, i, on, M, mean) => {
      const m = D.map({ x: 482, y: 60, w: 254, h: 250, x0: 0, x1: 360, y0: -3.2, y1: 3.2 });
      D.axes(m, { xt: [0, 90, 180, 270, 360], yt: [-3, -2, -1, 0, 1, 2, 3], yf: (v) => st.fix(v, 0), yl: t({ de: 'Moment M in mNm', en: 'torque M in mNm' }), xl: t({ de: 'Winkel θ in °', en: 'angle θ in °' }) });
      D.curve(m, (d) => loopTorque(d / DEG, DEMO_LOOP, i, !on) * 1000, 0, 360, C.dim, 1.4, [4, 5]);
      D.curve(m, (d) => loopTorque(d / DEG, DEMO_LOOP, i, on) * 1000, 0, 360, C.M, 2.8);
      D.hline(m, mean * 1000, C.M, '', [2, 5]);
      D.text(`${t({ de: 'Mittel', en: 'mean' })} ${st.fix(mean * 1000, 2)} mNm`, m.X(10), m.Y(-2.5), { size: 12, col: C.dim, base: 'middle', bg: C.panel });
      D.dot(m, th * DEG, M * 1000, C.M, 6);
      const names = [t({ de: 'mit Kommutator', en: 'with commutator' }), t({ de: 'ohne', en: 'without' })];
      D.legend(on ? [[names[0], C.M], [names[1], C.dim]] : [[names[1], C.M], [names[0], C.dim]], 482, 372);
    };

    st.loop((dt) => {
      const on = comm.value, i = iS.value;
      state = stepLoopRotor(state, DEMO_LOOP, i, on, dt);
      state = { theta: wrapAngle(state.theta), w: Math.max(-LP.wMax, Math.min(LP.wMax, state.w)) };
      const th = state.theta;
      const M = loopTorque(th, DEMO_LOOP, i, on) || 0, mean = loopMeanTorque(DEMO_LOOP, i, on) || 0;

      D.clear();
      const dirA = drawMotor(th, i, on);
      const still = Math.abs(state.w) < 0.05 && Math.abs(Math.sin(th)) < 0.06;
      const flow = dirA > 0 ? { de: 'Leiter a: Strom fließt von dir weg', en: 'conductor a: current flows away from you' }
        : dirA < 0 ? { de: 'Leiter a: Strom kommt auf dich zu', en: 'conductor a: current comes towards you' }
          : { de: 'kein Strom', en: 'no current' };
      D.text(t(flow), LP.cx, 388, { size: 13, align: 'center', col: C.dim });
      if (still) D.text(t({ de: 'Totpunkt: kein Hebel, kein Moment', en: 'dead point: no lever, no torque' }), LP.cx, 410, { size: 13, align: 'center', bold: true });
      drawPlot(th, i, on, M, mean);

      const shown = Math.round(M * 1e5) / 100 || 0;
      const speed = Math.round(state.w * 10) / 10 || 0;
      st.readout(`θ = <b>${st.fix(th * DEG, 0)}°</b> &nbsp;·&nbsp; <span class="M">M = <b>${st.fix(shown, 2)} mNm</b></span> &nbsp;·&nbsp; <span class="M">${t({ de: 'Mittel über eine Drehung', en: 'mean over one turn' })} = <b>${st.fix(mean * 1000, 2)} mNm</b></span> &nbsp;·&nbsp; <span class="w">ω = ${st.fix(speed, 1)} rad/s</span>`);
    });
  },
};

// ------------------------------------------------------------------ more coils, less ripple
// Regions (760 x 400):
//   left 24..346: poles x 24..74 and 296..346 (y 100..280) · rotor centre 185/190, conductors on radius 84
//     -> y 97..283 · caption y 336
//   right 366..740: plot x 412..740, y 60..290 (axis title y 321) · legend y 350 · low/high text y 376
const ST2 = { xN: 24, xS: 296, w: 50, h: 180, y: 100 };
const RP = { cx: 185, cy: 190, R: 84, w: 1.2 };

const ripple = {
  id: 'a03-ripple',
  title: { de: 'Mehr Spulen, weniger Welligkeit', en: 'More coils, less ripple' },
  hint: {
    de: 'Zeitlupe. Der Rotor dreht gleichmäßig. Der Streifen zeigt, wie stark das Moment schwankt.',
    en: 'Slow motion. The rotor turns steadily. The band shows how much the torque varies.',
  },
  height: 400,
  build(st) {
    const { D, C, t } = st;
    let theta = 0.4;
    const nS = st.select({ label: { de: 'Spulen', en: 'Coils' }, value: 1, options: [1, 2, 3, 6].map((v) => ({ v, label: String(v) })) });

    const drawRotor = (n) => {
      const { cx, cy, R } = RP;
      stator(D, C, ST2);
      D.circle(cx, cy, R, { stroke: C.faint, lw: 1.5 });
      const half = Math.PI / (2 * n) - (n > 3 ? 0.07 : 0.12);
      for (let k = 0; k < n; k++) {
        const a = coilAngle(theta, n, k), col = k === 0 ? C.w : C.cu;
        [a, a + Math.PI].forEach((ang) => {
          D.line(...polar(cx, cy, 34, ang), ...polar(cx, cy, R, ang), col, 2);
          segment(D, cx, cy, 30, ang, half, C.cu, 8);
          const [x, y] = polar(cx, cy, R, ang);
          conductor(D, C, x, y, 9, Math.sin(ang) >= 0 ? 1 : -1, k === 0 ? C.w : C.ink);
        });
      }
      brushes(D, C, cx, cy, 36, 36, 54);
      const cap = n === 1 ? { de: '1 Spule · 2 Leiter · 2 Lamellen', en: '1 coil · 2 conductors · 2 segments' }
        : { de: `${n} Spulen · ${2 * n} Leiter · ${2 * n} Lamellen`, en: `${n} coils · ${2 * n} conductors · ${2 * n} segments` };
      D.text(t(cap), cx, 336, { size: 13, align: 'center', bold: true });
    };

    const drawPlot = (n, r) => {
      const m = D.map({ x: 412, y: 60, w: 328, h: 230, x0: 0, x1: 360, y0: 0, y1: 180 });
      const pc = (v) => (v / r.mean) * 100;
      D.axes(m, { xt: [0, 90, 180, 270, 360], yt: [0, 50, 100, 150], yf: (v) => st.fix(v, 0), yl: t({ de: 'Moment in % des Mittelwerts', en: 'torque in % of the mean' }), xl: t({ de: 'Winkel θ in °', en: 'angle θ in °' }) });
      const top = m.Y(pc(r.max)), low = m.Y(pc(r.min));
      D.rect(m.x + 1, top, m.w - 1, Math.max(1, low - top), { fill: C.shade });
      for (let k = 0; k < n; k++) D.curve(m, (d) => pc(coilTorque(d / DEG, n, k)), 0, 360, k === 0 ? C.w : C.faint, k === 0 ? 1.8 : 1.2);
      D.hline(m, 100, C.dim);
      D.curve(m, (d) => pc(multiCoilTorque(d / DEG, n)), 0, 360, C.M, 2.8);
      D.dot(m, theta * DEG, pc(multiCoilTorque(theta, n)), C.M, 5.5);
      D.legend([[t({ de: 'Summe', en: 'total' }), C.M], [t({ de: 'Spule 1', en: 'coil 1' }), C.w], [t({ de: 'Mittelwert', en: 'mean' }), C.dim]], 412, 350);
      D.text(t({
        de: `tiefster Wert ${st.fix(pc(r.min), 0)} % · höchster ${st.fix(pc(r.max), 0)} %`,
        en: `lowest ${st.fix(pc(r.min), 0)} % · highest ${st.fix(pc(r.max), 0)} %`,
      }), 412, 376, { size: 13 });
    };

    st.loop((dt) => {
      theta = wrapAngle(theta + RP.w * dt);
      const n = Number(nS.value), r = torqueRipple(n);
      D.clear();
      drawRotor(n);
      drawPlot(n, r);
      st.readout(`<span class="M">${t({ de: 'Mittelwert', en: 'mean' })} = <b>${st.fix(r.mean, 2)} · $M_0$</b></span> &nbsp;·&nbsp; ${t({ de: 'Welligkeit', en: 'ripple' })} = <b>${st.fix(r.ripple * 100, 1)} %</b> &nbsp;·&nbsp; ${t({ de: '$M_0$: Spitzenmoment einer Spule', en: '$M_0$: peak torque of one coil' })}`);
    });
  },
};

export default {
  id: 'a03',
  blocks: [
    h({ de: 'Eine Schleife zwischen zwei Magneten', en: 'One loop between two magnets' }),
    p({
      de: 'Außen stehen Magnete: der <b>Stator</b>. Innen dreht sich eine Wicklung: der <b>Rotor</b>. Zwei feste <b>Bürsten</b> schleifen auf einem geteilten Ring. Dieser Ring ist der <b>Kommutator</b>.',
      en: 'Magnets stand on the outside: the <b>stator</b>. A winding turns inside: the <b>rotor</b>. Two fixed <b>brushes</b> (Bürsten) slide on a split ring. This ring is the <b>commutator</b>.',
    }),
    anim(commutator),
    tryIt({
      de: [
        'Schalte den Kommutator aus. Der Rotor pendelt und bleibt bei 180° stehen.',
        'Schalte ihn wieder ein und drück <b>anstoßen</b>. Jetzt dreht er weiter.',
        'Drück <b>Auf den Totpunkt</b>. Nichts startet von selbst. Erst ein Stoß hilft.',
        'Beobachte den Wechsel bei 0° und 180°. Punkt und Kreuz tauschen die Plätze.',
      ],
      en: [
        'Switch the commutator off. The rotor swings and stops at 180°.',
        'Switch it on again and press <b>push</b>. Now it keeps turning.',
        'Press <b>To the dead point</b>. Nothing starts by itself. Only a push helps.',
        'Watch the change at 0° and 180°. Dot and cross swap places.',
      ],
    }),

    h({ de: 'Das Moment der Schleife', en: 'The torque of the loop' }),
    p({
      de: 'Auf jeden der zwei Leiter wirkt $F = B·i·l$. Der Hebel ist $r·sin θ$. Bei $θ = 0$ liegen beide Leiter auf der neutralen Achse: Der Hebel fehlt.',
      en: 'On each of the two conductors acts $F = B·i·l$. The lever is $r·sin θ$. At $θ = 0$ both conductors lie on the neutral axis: the lever is missing.',
    }),
    formula('$M = 2·r·l·B·i·sin θ$', {
      de: [['r', 'Abstand Leiter zur Achse in m'], ['l', 'Leiterlänge im Feld in m'], ['θ', 'Winkel ab der neutralen Achse, senkrecht zum Feld']],
      en: [['r', 'distance from conductor to axis in m'], ['l', 'conductor length in the field in m'], ['θ', 'angle from the neutral axis, perpendicular to the field']],
    }),
    p({
      de: 'Ohne Kommutator wechselt $M$ jede halbe Drehung das Vorzeichen. Der Mittelwert ist null. Der Kommutator tauscht jede halbe Drehung die Stromrichtung. Dann gilt $M ∝ |sin θ|$.',
      en: 'Without a commutator $M$ changes sign every half turn. The mean is zero. The commutator swaps the current direction every half turn. Then $M ∝ |sin θ|$.',
    }),
    example({
      title: { de: 'Moment einer Schleife', en: 'Torque of one loop' },
      given: {
        de: ['$r = 2$ cm', '$l = 5$ cm', '$B = 0,5$ T', '$i = 2$ A'],
        en: ['$r = 2$ cm', '$l = 5$ cm', '$B = 0.5$ T', '$i = 2$ A'],
      },
      steps: {
        de: [
          'Spitzenwert bei 90°: $M_0 = 2·r·l·B·i = 2·0,02·0,05·0,5·2 = 0,002$ N·m.',
          'Bei 30° ist $sin θ = 0,5$. Also $M = 1$ mNm.',
          'Mittel mit Kommutator: $[[2|π]]·M_0 ≈ 0,64·M_0 = 1,27$ mNm.',
        ],
        en: [
          'Peak at 90°: $M_0 = 2·r·l·B·i = 2·0.02·0.05·0.5·2 = 0.002$ N·m.',
          'At 30° we have $sin θ = 0.5$. So $M = 1$ mNm.',
          'Mean with commutator: $[[2|π]]·M_0 ≈ 0.64·M_0 = 1.27$ mNm.',
        ],
      },
      result: { de: '$M_0 = 2$ mNm, Mittel $≈ 1,27$ mNm', en: '$M_0 = 2$ mNm, mean $≈ 1.27$ mNm' },
    }),

    h({ de: 'Mehr Spulen glätten das Moment', en: 'More coils smooth the torque' }),
    anim(ripple),
    tryIt({
      de: [
        'Beginne mit <b>1</b>. Das Moment fällt zweimal pro Drehung auf null.',
        'Wähle <b>2</b>, dann <b>3</b>. Wenn eine Spule schwach ist, hilft eine andere.',
        'Wähle <b>6</b>. Die Kurve ist fast eine Gerade.',
      ],
      en: [
        'Start with <b>1</b>. The torque drops to zero twice per turn.',
        'Choose <b>2</b>, then <b>3</b>. When one coil is weak, another one helps.',
        'Choose <b>6</b>. The curve is almost a straight line.',
      ],
    }),
    table({
      head: { de: ['Spulen', 'tiefster Wert', 'höchster Wert', 'Welligkeit'], en: ['Coils', 'lowest value', 'highest value', 'Ripple'] },
      rows: [
        ['1', '0 %', '157 %', '157 %'],
        ['2', '79 %', '111 %', { de: '32,5 %', en: '32.5 %' }],
        ['3', '91 %', '105 %', { de: '14,0 %', en: '14.0 %' }],
      ],
    }),
    p({
      de: 'Alle Werte beziehen sich auf den Mittelwert. Welligkeit heißt: (höchster − tiefster Wert) / Mittelwert.',
      en: 'All values refer to the mean. Ripple (Welligkeit) means: (highest − lowest value) / mean.',
    }),

    h({ de: 'Zwei Konstanten, eine Zahl', en: 'Two constants, one number' }),
    p({
      de: 'Mit vielen Spulen hängt das Moment nur noch vom Strom ab. Die Drehung induziert zugleich eine Spannung.',
      en: 'With many coils the torque depends only on the current. At the same time the rotation induces a voltage.',
    }),
    formula('$M_M = k_m·i$ &nbsp;&nbsp; $U_i = k_e·ω$', {
      de: [['k_m', 'Drehmomentkonstante in N·m/A'], ['k_e', 'Generatorkonstante in V·s']],
      en: [['k_m', 'torque constant in N·m/A'], ['k_e', 'generator constant in V·s']],
    }),
    p({
      de: 'Die elektrische Leistung wird mechanisch: $U_i·i = M_M·ω$. Einsetzen gibt $k_e·ω·i = k_m·i·ω$. Also $k_e = k_m$ in SI-Einheiten.',
      en: 'The electrical power becomes mechanical: $U_i·i = M_M·ω$. Inserting gives $k_e·ω·i = k_m·i·ω$. So $k_e = k_m$ in SI units.',
    }),
    p({
      de: 'Beispiel mit 0,024: 1 A gibt 24 mNm. 100 rad/s geben 2,4 V. Beide Leistungen sind 2,4 W.',
      en: 'Example with 0.024: 1 A gives 24 mNm. 100 rad/s give 2.4 V. Both powers are 2.4 W.',
    }),
    table({
      head: { de: ['Kommutator: Vorteile', 'Kommutator: Nachteile'], en: ['Commutator: pros', 'Commutator: cons'] },
      rows: [
        [{ de: 'läuft direkt an Gleichspannung', en: 'runs directly from DC voltage' }, { de: 'Bürsten nutzen sich ab', en: 'brushes wear out' }],
        [{ de: 'schaltet mechanisch, ganz ohne Elektronik', en: 'switches mechanically, with no electronics' }, { de: 'Funken und Funkstörungen', en: 'sparks and radio interference' }],
        [{ de: 'einfach zu steuern: $M_M = k_m·i$', en: 'easy to control: $M_M = k_m·i$' }, { de: 'Reibung, und die Wärme entsteht im Rotor', en: 'friction, and the heat arises in the rotor' }],
      ],
    }),
    p({
      de: 'Es geht auch ohne Bürsten. Dann schaltet Elektronik den Strom um. Das zeigt Blatt A11.',
      en: 'It also works without brushes. Then electronics switch the current. Sheet A11 shows how.',
    }),
    note({
      de: [
        'Der Kommutator tauscht jede halbe Drehung die Stromrichtung. So bleibt das Moment gleich gerichtet.',
        'Mehr Spulen machen das Moment glatter.',
        '$M_M = k_m·i$, $U_i = k_e·ω$ und in SI-Einheiten $k_e = k_m$.',
      ],
      en: [
        'The commutator swaps the current direction every half turn. So the torque keeps its direction.',
        'More coils make the torque smoother.',
        '$M_M = k_m·i$, $U_i = k_e·ω$ and in SI units $k_e = k_m$.',
      ],
    }),
    quiz([
      {
        q: { de: 'Schleife mit $r = 3$ cm, $l = 4$ cm, $B = 0,4$ T, $i = 5$ A. Wie groß ist $M$ bei $θ = 30°$?', en: 'Loop with $r = 3$ cm, $l = 4$ cm, $B = 0.4$ T, $i = 5$ A. How large is $M$ at $θ = 30°$?' },
        answer: 2.4, unit: 'mNm', decimals: 1,
        why: { de: '$2·0,03·0,04·0,4·5·0,5 = 0,0024$ N·m, also 2,4 mNm.', en: '$2·0.03·0.04·0.4·5·0.5 = 0.0024$ N·m, that is 2.4 mNm.' },
      },
      {
        q: { de: 'Du ersetzt den Kommutator durch zwei Schleifringe. Was macht der Rotor bei Gleichstrom?', en: 'You replace the commutator by two slip rings. What does the rotor do with direct current?' },
        options: { de: ['Er dreht schneller', 'Er pendelt und bleibt stehen', 'Er dreht rückwärts'], en: ['It turns faster', 'It swings and stops', 'It turns backwards'] },
        correct: 1,
        why: { de: 'Das Moment wechselt jede halbe Drehung das Vorzeichen. Im Mittel ist es null.', en: 'The torque changes sign every half turn. Its mean is zero.' },
      },
      {
        q: { de: 'Ein Motor hat $k_m = 0,024$ N·m/A. Welche Spannung induziert er bei 100 rad/s?', en: 'A motor has $k_m = 0.024$ N·m/A. What voltage does it induce at 100 rad/s?' },
        answer: 2.4, unit: 'V', decimals: 1,
        why: { de: '$k_e = k_m$, also $U_i = 0,024·100 = 2,4$ V.', en: '$k_e = k_m$, so $U_i = 0.024·100 = 2.4$ V.' },
      },
      {
        q: { de: 'Warum hat ein echter Motor viele Spulen?', en: 'Why does a real motor have many coils?' },
        options: { de: ['Für ein glattes Moment ohne Totpunkt', 'Damit keine Spannung induziert wird', 'Damit die Bürsten wegfallen'], en: ['For smooth torque without a dead point', 'So that no voltage is induced', 'So that the brushes disappear'] },
        correct: 0,
        why: { de: 'Irgendeine Spule hat immer einen guten Hebel.', en: 'Some coil always has a good lever.' },
      },
    ]),
  ],
};
