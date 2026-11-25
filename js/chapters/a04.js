// A04 — The motor model: equivalent circuit, the two equations, switch-on transient.

import { h, p, anim, formula, tryIt, note, example, quiz } from '../core/dsl.js';
import { Trace } from '../core/draw.js';
import { EXAMPLE_MOTOR, stepMotor, steadyState } from '../physics/dcmotor.js';

const WINDOWS = {
  slow: { span: 0.25, rate: 0.05, unit: 'ms', k: 1000, ticks: [0, 50, 100, 150, 200, 250] },
  fast: { span: 0.002, rate: 0.0004, unit: 'ms', k: 1000, ticks: [0, 0.5, 1, 1.5, 2] },
};

const motorModel = {
  id: 'a04-motor-model',
  title: { de: 'Ersatzschaltbild, Maschen- und Momentenbilanz', en: 'Equivalent circuit, voltage and torque balance' },
  hint: {
    de: 'Zeitlupe: Der echte Hochlauf dauert etwa eine Zehntelsekunde. Orange Punkte zeigen den Strom.',
    en: 'Slow motion: the real run-up takes about a tenth of a second. Orange dots show the current.',
  },
  height: 450,
  build(st) {
    const { D, C, t } = st;
    const P = EXAMPLE_MOTOR;
    let state = { i: 0, w: 0, phi: 0 };
    let tSim = 0, flow = 0, spin = 0;
    const trI = new Trace(1600), trW = new Trace(1600);

    const restart = () => { state = { i: 0, w: 0, phi: 0 }; tSim = 0; trI.clear(); trW.clear(); st.play(); };
    const uS = st.slider({ label: { de: 'Spannung $U$', en: 'Voltage $U$' }, min: 0, max: 12, step: 0.5, value: 12, unit: 'V' });
    const mS = st.slider({ label: { de: 'Lastmoment $M_L$', en: 'Load torque $M_L$' }, min: 0, max: 40, step: 1, value: 0, unit: 'mNm' });
    const win = st.select({
      label: { de: 'Zeitfenster', en: 'Time window' }, value: 'slow', on: restart,
      options: [{ v: 'slow', label: '250 ms' }, { v: 'fast', label: '2 ms' }],
    });
    st.button({ de: 'Neu einschalten ▶', en: 'Switch on again ▶' }, restart, 'primary');

    const loopPts = [[50, 84], [50, 45], [270, 45], [270, 78], [270, 122], [270, 155], [50, 155], [50, 116]];

    // values far below the bar resolution are shown as zero instead of "113 nNm"
    const quiet = (v, eps) => (Math.abs(v) < eps ? 0 : v);

    const barRow = (y, label, value, full, col, text) => {
      D.text(label, 24, y + 10, { size: 13, bold: true, col });
      D.bar(84, y, 170, 12, value / full, col, { signed: true });
      D.text(text, 322, y + 10, { size: 12.5, align: 'right' });
    };

    st.loop((dt) => {
      const W = WINDOWS[win.value];
      const U = uS.value, Ml = mS.value / 1000;
      const sub = 6;
      for (let k = 0; k < sub && dt > 0; k++) {
        state = stepMotor(state, { U, Ml }, P, (dt * W.rate) / sub);
        tSim += (dt * W.rate) / sub;
        trI.push(tSim, state.i); trW.push(tSim, state.w);
      }
      flow += state.i * 70 * dt;
      spin += state.w * 0.012 * dt;
      const uR = P.R * state.i, uI = P.ke * state.w, uL = U - uR - uI;
      const mM = P.km * state.i, mF = P.Cr * state.w, mJ = mM - mF - Ml;
      const target = steadyState(P, U, Ml);

      D.clear();
      // --- equivalent circuit
      D.wire(loopPts);
      D.source(50, 100, 16, { label: 'U', labelCol: C.U });
      D.resistor(86, 45, 156, 45, { label: 'R' });
      D.inductor(170, 45, 240, 45, { label: 'L' });
      D.motorSym(270, 100, 22, spin);
      D.flow(loopPts, flow);
      D.uArrow(92, 68, 150, 68, 'U_R', C.U, { off: -13 });
      D.uArrow(176, 68, 234, 68, 'U_L', C.U, { off: -13 });
      D.uArrow(318, 80, 318, 120, 'U_i', C.U, { off: 17 });
      D.arrow(190, 170, 150, 170, C.i, 2); D.text('i', 198, 175, { size: 14, bold: true, col: C.i });
      D.arcArrow(270, 100, 34, -2.7, -0.75, C.w, 2); D.text('ω', 228, 76, { size: 14, bold: true, col: C.w });

      // --- the two balances as signed bars
      D.text(t({ de: 'Masche:  U = U_R + U_L + U_i', en: 'Mesh:  U = U_R + U_L + U_i' }), 24, 196, { size: 12.5, col: C.dim });
      barRow(206, 'U_R', uR, 12, C.U, st.si(quiet(uR, 1e-3), 'V'));
      barRow(228, 'U_L', uL, 12, C.U, st.si(quiet(uL, 1e-3), 'V'));
      barRow(250, 'U_i', uI, 12, C.U, st.si(quiet(uI, 1e-3), 'V'));
      D.text(t({ de: 'Momente:  M_M = J·dω/dt + C_r·ω + M_L', en: 'Torques:  M_M = J·dω/dt + C_r·ω + M_L' }), 24, 296, { size: 12.5, col: C.dim });
      barRow(306, 'M_M', mM, 0.06, C.M, st.si(quiet(mM, 1e-5), 'Nm'));
      barRow(328, 'J·ω̇', mJ, 0.06, C.M, st.si(quiet(mJ, 1e-5), 'Nm'));
      barRow(350, 'C_r·ω', mF, 0.06, C.M, st.si(quiet(mF, 1e-5), 'Nm'));
      barRow(372, 'M_L', Ml, 0.06, C.M, st.si(quiet(Ml, 1e-5), 'Nm'));

      // --- time plots
      const x0 = Math.max(0, tSim - W.span);
      const xt = W.ticks.map((v) => v / W.k + Math.floor(x0 / (W.span / 5)) * (W.span / 5)).filter((v) => v >= x0 - 1e-12 && v <= x0 + W.span + 1e-12);
      const xf = (v) => st.num(v * W.k, 3);
      const mi = D.map({ x: 410, y: 40, w: 322, h: 140, x0, x1: x0 + W.span, y0: -0.5, y1: 2.5 });
      const mw = D.map({ x: 410, y: 252, w: 322, h: 140, x0, x1: x0 + W.span, y0: 0, y1: 550 });
      D.axes(mi, { xt, xf, yt: [0, 1, 2], yl: t({ de: 'Strom i in A', en: 'current i in A' }), xl: 't in ms' });
      D.axes(mw, { xt, xf, yt: [0, 250, 500], yl: t({ de: 'Drehzahl ω in rad/s', en: 'speed ω in rad/s' }), xl: 't in ms' });
      D.hline(mi, target.i, C.dim, t({ de: 'Endwert', en: 'final value' }));
      D.hline(mw, target.w, C.dim, t({ de: 'Endwert', en: 'final value' }));
      D.series(mi, trI.pts, C.i, 2.5);
      D.series(mw, trW.pts, C.w, 2.5);
      D.dot(mi, tSim, state.i, C.i, 4);
      D.dot(mw, tSim, state.w, C.w, 4);

      st.readout(`<span class="i">i = <b>${st.si(state.i, 'A')}</b></span> &nbsp;·&nbsp; <span class="w">ω = <b>${st.fix(state.w, 0)} rad/s</b></span> (${st.fix((state.w * 60) / (2 * Math.PI), 0)} min⁻¹) &nbsp;·&nbsp; ${t({ de: 'Endwerte', en: 'final values' })}: ${st.si(target.i, 'A')}, ${st.fix(target.w, 0)} rad/s`);
    });
  },
};

export default {
  id: 'a04',
  blocks: [
    h({ de: 'Der Motor als Schaltung', en: 'The motor as a circuit' }),
    p({
      de: 'Elektrisch ist der Motor eine Reihenschaltung. Drei Teile: der Wicklungswiderstand $R$, die Induktivität $L$ und eine Spannungsquelle $U_i$. Diese Quelle entsteht erst durch die Drehung.',
      en: 'Electrically the motor is a series circuit. Three parts: the winding resistance $R$, the inductance $L$ and a voltage source $U_i$. This source only appears because the rotor turns.',
    }),
    anim(motorModel),
    tryIt({
      de: [
        'Drück <b>Neu einschalten</b>. Der Strom springt hoch und fällt wieder. Der Grund: $U_i$ wächst mit der Drehzahl und drückt gegen $U$.',
        'Stell $M_L$ auf 20 mNm. Die Drehzahl sinkt. Der Strom steigt, denn der Motor braucht mehr Moment.',
        'Wähle das Zeitfenster <b>2 ms</b> und schalte neu ein. Jetzt siehst du, wie $L$ den Stromanstieg bremst.',
      ],
      en: [
        'Press <b>Switch on again</b>. The current jumps up and falls again. The reason: $U_i$ grows with speed and pushes against $U$.',
        'Set $M_L$ to 20 mNm. The speed drops. The current rises, because the motor needs more torque.',
        'Choose the <b>2 ms</b> window and switch on again. Now you see how $L$ slows the rise of the current.',
      ],
    }),

    h({ de: 'Gleichung 1: die Masche', en: 'Equation 1: the mesh' }),
    p({
      de: 'Einmal im Kreis herum müssen sich alle Spannungen zu $U$ addieren. Das ist die Maschenregel.',
      en: 'Once around the loop, all voltages must add up to $U$. That is the mesh rule.',
    }),
    formula('$U = R·i + L·[[di|dt]] + k_e·ω$', {
      de: [['R·i', 'Spannung am Wicklungswiderstand'], ['L·di/dt', 'Spannung an der Induktivität, nur wenn sich der Strom ändert'], ['k_e·ω', 'induzierte Gegenspannung $U_i$'], ['k_e', 'Generatorkonstante in V·s']],
      en: [['R·i', 'voltage across the winding resistance'], ['L·di/dt', 'voltage across the inductance, only while the current changes'], ['k_e·ω', 'induced back-EMF $U_i$'], ['k_e', 'generator constant in V·s']],
    }),

    h({ de: 'Gleichung 2: die Momente', en: 'Equation 2: the torques' }),
    p({
      de: 'Der Strom erzeugt das Motormoment $M_M = k_m·i$. Davon gehen Reibung und Last ab. Was übrig bleibt, beschleunigt den Rotor.',
      en: 'The current produces the motor torque $M_M = k_m·i$. Friction and load take their share. What is left accelerates the rotor.',
    }),
    formula('$J·[[dω|dt]] = k_m·i − C_r·ω − M_L$', {
      de: [['J', 'Trägheitsmoment in kg·m²'], ['k_m', 'Drehmomentkonstante in N·m/A'], ['C_r', 'Reibkonstante in N·m·s'], ['M_L', 'Lastmoment in N·m']],
      en: [['J', 'moment of inertia in kg·m²'], ['k_m', 'torque constant in N·m/A'], ['C_r', 'friction constant in N·m·s'], ['M_L', 'load torque in N·m']],
    }),
    note({
      de: [
        'Strom macht Moment: $M_M = k_m·i$.',
        'Drehzahl macht Gegenspannung: $U_i = k_e·ω$.',
        'Im Stillstand fehlt $U_i$. Darum ist der Anlaufstrom groß: $i = U/R$.',
      ],
      en: [
        'Current makes torque: $M_M = k_m·i$.',
        'Speed makes back-EMF: $U_i = k_e·ω$.',
        'At standstill $U_i$ is missing. That is why the start-up current is large: $i = U/R$.',
      ],
    }),

    example({
      title: { de: 'Leerlauf bei 12 V', en: 'No load at 12 V' },
      given: {
        de: ['$R = 5 Ω$', '$k_e = k_m = 0,024$', '$C_r = 3·10^{-6}$ N·m·s', '$U = 12$ V', '$M_L = 0$'],
        en: ['$R = 5 Ω$', '$k_e = k_m = 0.024$', '$C_r = 3·10^{-6}$ N·m·s', '$U = 12$ V', '$M_L = 0$'],
      },
      steps: {
        de: [
          'Im Endzustand ändert sich nichts mehr. Alle Ableitungen sind null.',
          'Masche: $12 = 5·i + 0,024·ω$. Momente: $0 = 0,024·i − 3·10^{-6}·ω$.',
          'Zweite Gleichung nach $i$: $i = 1,25·10^{-4}·ω$.',
          'Einsetzen: $12 = (6,25·10^{-4} + 0,024)·ω$. Also $ω = 487$ rad/s.',
          'Zurück: $i = 1,25·10^{-4}·487 = 0,061$ A.',
        ],
        en: [
          'In the final state nothing changes any more. All derivatives are zero.',
          'Mesh: $12 = 5·i + 0.024·ω$. Torques: $0 = 0.024·i − 3·10^{-6}·ω$.',
          'Solve the second equation for $i$: $i = 1.25·10^{-4}·ω$.',
          'Insert: $12 = (6.25·10^{-4} + 0.024)·ω$. So $ω = 487$ rad/s.',
          'Back: $i = 1.25·10^{-4}·487 = 0.061$ A.',
        ],
      },
      result: { de: '$ω ≈ 487$ rad/s (4650 min⁻¹), $i ≈ 61$ mA', en: '$ω ≈ 487$ rad/s (4650 rpm), $i ≈ 61$ mA' },
    }),

    quiz([
      {
        q: { de: 'Der Rotor wird festgehalten ($ω = 0$). Wie groß ist der Strom bei $U = 12$ V und $R = 5 Ω$?', en: 'The rotor is held still ($ω = 0$). How large is the current at $U = 12$ V and $R = 5 Ω$?' },
        answer: 2.4, unit: 'A', decimals: 1,
        why: { de: 'Ohne Drehung ist $U_i = 0$. Es bleibt $i = U/R$.', en: 'Without rotation $U_i = 0$. What remains is $i = U/R$.' },
      },
      {
        q: { de: 'Der Motor läuft. Du erhöhst das Lastmoment. Was passiert?', en: 'The motor is running. You increase the load torque. What happens?' },
        options: {
          de: ['Drehzahl sinkt, Strom steigt', 'Drehzahl sinkt, Strom sinkt', 'Drehzahl bleibt, Strom steigt'],
          en: ['Speed drops, current rises', 'Speed drops, current drops', 'Speed stays, current rises'],
        },
        correct: 0,
        why: { de: 'Weniger Drehzahl heißt weniger $U_i$. Mehr Spannung bleibt für $R$, also mehr Strom.', en: 'Less speed means less $U_i$. More voltage is left for $R$, so more current.' },
      },
    ]),
  ],
};
