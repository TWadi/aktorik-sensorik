// S03 — Measuring position: the potentiometer (loading error) and the LVDT.

import { h, p, anim, formula, tryIt, note, example, quiz } from '../core/dsl.js';
import { clamp } from '../core/draw.js';
import {
  EXAMPLE_POT, EXAMPLE_LVDT, potIdeal, potLoaded, potError, potLoadCurrent, potWorstError,
  lvdtSecondaries, lvdtOutput,
} from '../physics/position.js';

const RM_SERIES = [1e3, 2e3, 5e3, 1e4, 2e4, 5e4, 1e5, 2e5, 5e5, 1e6]; // log scale in 1-2-5 steps

const potAnim = {
  id: 's03-pot',
  title: { de: 'Poti als Spannungsteiler, mit und ohne Last', en: 'Pot as a voltage divider, with and without load' },
  hint: {
    de: 'Zieh den grünen Schleifer oder nimm den Regler. Orange Punkte zeigen den Strom durch $R_m$, nicht maßstäblich.',
    en: 'Drag the green wiper or use the slider. Orange dots show the current through $R_m$, not to scale.',
  },
  height: 420,
  build(st) {
    const { D, C, t } = st;
    const { R } = EXAMPLE_POT;
    // region plan (760 × 420)
    //   left 16..352: circuit · source x = 58 · track x = 150, y 80..310 (x = 1 at the top)
    //                 wiper bus x = 236 · meter box 250..352 × 130..352 · values below at y 376..395
    //   right 414..736 × 50..330: plot U_a over x; legend, error and worst case in the free top-left corner
    const TX = 150, TOP = 80, BOT = 310, BUS = 236, OUT = 150, RAIL = 340;
    const yOf = (x) => BOT - x * (BOT - TOP);
    const rmOf = (v) => RM_SERIES[clamp(Math.round(v), 0, RM_SERIES.length - 1)];
    let flow = 0, drag = false;

    const xS = st.slider({ label: { de: 'Schleifer $x$', en: 'Wiper $x$' }, min: 0, max: 1, step: 0.01, value: 0.5 });
    const rmS = st.slider({
      label: { de: 'Messgerät $R_m$', en: 'Meter $R_m$' }, min: 0, max: RM_SERIES.length - 1, step: 1, value: 6,
      fmt: (v) => st.si(rmOf(v), 'Ω'),
    });
    const ueS = st.slider({ label: { de: 'Speisung $U_e$', en: 'Supply $U_e$' }, min: 5, max: 10, step: 0.5, value: 10, unit: 'V' });

    const grab = (py) => xS.set(clamp(Math.round(((BOT - py) / (BOT - TOP)) * 100) / 100, 0, 1));
    st.pointer({
      down(px, py) { drag = px < 250; if (drag) grab(py); },
      move(px, py, held) { if (drag && held) grab(py); },
      up() { drag = false; },
    });

    st.loop((dt) => {
      const x = clamp(xS.value, 0, 1), Rm = rmOf(rmS.value), Ue = ueS.value;
      const ideal = potIdeal(x, Ue), real = potLoaded(x, Ue, R, Rm);
      const err = potError(x, R, Rm);
      const im = potLoadCurrent(x, Ue, R, Rm);
      const worst = potWorstError(R, Rm);
      flow += Math.sqrt(im / 1e-3) * 60 * dt; // compressed: four times the current, twice the speed
      const yw = yOf(x);

      D.clear();
      // --- supply and track
      D.wire([[58, 179], [58, 52], [TX, 52], [TX, TOP]]);
      D.wire([[TX, BOT], [TX, RAIL], [58, RAIL], [58, 211]]);
      D.source(58, 195, 16, { label: 'U_e', labelCol: C.U });
      D.text(`R = ${st.si(R, 'Ω')}`, 104, 42, { size: 12.5, align: 'center' });
      D.rect(TX - 11, TOP, 22, BOT - TOP, { fill: C.panel });
      D.rect(TX - 11, yw, 22, BOT - yw, { fill: C.hi });
      D.rect(TX - 11, TOP, 22, BOT - TOP, { stroke: C.ink, lw: 2 });
      [0, 0.5, 1].forEach((v) => {
        D.line(TX - 17, yOf(v), TX - 11, yOf(v), C.dim, 1.5);
        D.text(st.num(v, 2), TX - 21, yOf(v), { size: 12, col: C.dim, align: 'right', base: 'middle' });
      });
      if (BOT - yw >= 34) D.text('R_x', TX + 18, (yw + BOT) / 2, { size: 12.5, base: 'middle' });

      // --- meter with its input resistance
      D.rect(250, 130, 102, 222, { stroke: C.dim, lw: 1.2, dash: [5, 4], r: 6 });
      D.text(t({ de: 'Messgerät', en: 'meter' }), 301, 122, { size: 12, col: C.dim, align: 'center' });
      D.wire([[BUS, yw], [BUS, OUT], [328, OUT], [328, 230]]);
      D.wire([[328, 260], [328, RAIL], [TX, RAIL]]);
      D.resistor(268, OUT, 268, RAIL, { label: 'R_m', labelOff: 26 });
      D.meter(328, 245, 15, 'V', { col: C.U });
      D.node(268, OUT); D.node(268, RAIL); D.node(TX, RAIL);
      D.gnd(TX, RAIL);
      D.flow([[TX + 13, yw], [BUS, yw], [BUS, OUT], [268, OUT], [268, RAIL], [TX, RAIL]], flow);

      // --- wiper
      D.arrow(BUS, yw, TX + 13, yw, C.w, 3);
      D.circle(BUS, yw, 6, { fill: C.w });
      D.text(`x = ${st.fix(x, 2)}`, 199, yw - 10, { size: 13, bold: true, col: C.w, align: 'center' });

      D.text(`U_a = ${st.fix(real, 2)} V`, 301, 376, { size: 15, bold: true, col: C.U, align: 'center' });
      D.text(`${t({ de: 'ideal', en: 'ideal' })}: ${st.fix(ideal, 2)} V`, 301, 395, { size: 12.5, col: C.dim, align: 'center' });
      D.text(`${t({ de: 'Strom durch R_m', en: 'current through R_m' })}: ${st.si(im, 'A')}`, 24, 386, { size: 12.5, col: C.i });

      // --- U_a over x
      const m = D.map({ x: 414, y: 50, w: 322, h: 280, x0: 0, x1: 1, y0: 0, y1: 10 });
      D.axes(m, {
        xt: [0, 0.25, 0.5, 0.75, 1], xf: (v) => st.num(v, 2), yt: [0, 2, 4, 6, 8, 10],
        yl: 'U_a in V', xl: t({ de: 'Schleiferstellung x', en: 'wiper position x' }),
      });
      D.vline(m, worst.x, C.faint);
      D.curve(m, (v) => potIdeal(v, Ue), 0, 1, C.dim, 1.6, [6, 5]);
      D.curve(m, (v) => potLoaded(v, Ue, R, Rm), 0, 1, C.U, 2.6);
      D.line(m.X(x), m.Y(ideal), m.X(x), m.Y(real), C.bad, 3.5);
      D.circle(m.X(x), m.Y(ideal), 4.5, { fill: C.panel, stroke: C.dim, lw: 2 });
      D.dot(m, x, real, C.U, 5);
      D.legend([[t({ de: 'ideal', en: 'ideal' }), C.dim], [t({ de: 'mit R_m', en: 'with R_m' }), C.U]], 426, 70);
      D.legend([[`${t({ de: 'Fehler', en: 'error' })}: ${st.fix(real - ideal, 3)} V`, C.bad]], 426, 92);
      D.text(`${t({ de: 'größter Fehler bei', en: 'largest error at' })} x ≈ ${st.fix(worst.x, 2)}`, 426, 114, { size: 12, col: C.dim });

      st.readout(`${t({ de: 'ideal', en: 'ideal' })}: $U_a$ = <b>${st.fix(ideal, 3)} V</b> &nbsp;·&nbsp; <span class="U">${t({ de: 'mit $R_m$', en: 'with $R_m$' })}: $U_a$ = <b>${st.fix(real, 3)} V</b></span> &nbsp;·&nbsp; ${t({ de: 'Fehler', en: 'error' })}: <b>${st.fix(real - ideal, 3)} V</b> = ${st.fix(err * 100, 2)} % ${t({ de: 'von', en: 'of' })} $U_e$ &nbsp;·&nbsp; <span class="i">${t({ de: 'Strom durch $R_m$', en: 'current through $R_m$' })}: ${st.si(im, 'A')}</span>`);
    });
  },
};

const lvdtAnim = {
  id: 's03-lvdt',
  title: { de: 'LVDT: zwei Sekundärspulen gegeneinander', en: 'LVDT: two secondary coils against each other' },
  hint: {
    de: 'Zeitlupe: Echte LVDT arbeiten mit einigen Kilohertz. Die Kopplung ist hier ideal linear gerechnet.',
    en: 'Slow motion: real LVDTs work at a few kilohertz. The coupling is modelled as ideally linear here.',
  },
  height: 440,
  build(st) {
    const { D, C, t } = st;
    const { Up, k, stroke } = EXAMPLE_LVDT;
    const MM = stroke * 1000; // stroke to each side in mm
    // region plan (760 × 440)
    //   top 40..202: LVDT in section · coils S1 110..250, P 250..390, S2 390..530 (upper 62..92, lower 128..158)
    //                core 240 px long in the tube 95..125, travel ±50 px · push rod with pointer on the scale 550..650
    //                amplitude bars 168..178 below the secondaries, values at y 197
    //   bottom left 62..352 × 240..380: scope · bottom right 446..736 × 240..380: output over x
    const CX = 320, CW = 140, TRAVEL = 50;
    const F = 0.5, SPAN = 4; // drawn carrier: 0.5 Hz, the scope shows two periods
    let time = 0;

    const xS = st.slider({ label: { de: 'Kernstellung $x$', en: 'Core position $x$' }, min: -MM, max: MM, step: 0.5, value: 4, unit: 'mm' });

    const signed = (v, dec) => `${Number(v.toFixed(dec)) > 0 ? '+' : ''}${st.fix(v, dec)}`;
    const tick = (v) => st.num(v, 2);

    const coil = (x0, label) => {
      [62, 128].forEach((y0) => {
        D.rect(x0, y0, CW, 30, { fill: C.panel, stroke: C.ink, lw: 1.5 });
        for (let r = 0; r < 3; r++) for (let c = 0; c < 14; c++) D.circle(x0 + 5 + c * 10, y0 + 5 + r * 10, 3.6, { fill: C.cu });
      });
      D.text(label, x0 + CW / 2, 52, { size: 12.5, align: 'center', bold: true });
    };

    st.loop((dt) => {
      time += dt;
      const mm = clamp(xS.value, -MM, MM), xn = mm / MM;
      const { u1, u2 } = lvdtSecondaries(xn, Up, k);
      const out = lvdtOutput(xn, Up, k);
      const full = k * Up;

      D.clear();
      // --- LVDT in section
      coil(CX - CW * 1.5, t({ de: 'Sekundär 1', en: 'Secondary 1' }));
      coil(CX - CW / 2, t({ de: 'Primär ~', en: 'Primary ~' }));
      coil(CX + CW / 2, t({ de: 'Sekundär 2', en: 'Secondary 2' }));
      D.poly([[536, 95], [104, 95], [104, 125], [536, 125]], C.ink, 1.5);
      const cc = CX + xn * TRAVEL, tip = 600 + xn * TRAVEL;
      D.line(cc + 120, 110, tip, 110, C.ink, 4);
      D.line(tip, 98, tip, 122, C.ink, 4);
      D.rect(cc - 120, 100, 240, 20, { fill: C.fe, stroke: C.ink, lw: 1.5, r: 3 });
      D.text(t({ de: 'Eisenkern', en: 'iron core' }), cc, 110, { size: 12, align: 'center', base: 'middle', bg: C.panel });
      // position scale under the rod end
      D.line(550, 140, 650, 140, C.dim, 1.5);
      [-1, -0.5, 0, 0.5, 1].forEach((v) => D.line(600 + v * TRAVEL, 140, 600 + v * TRAVEL, Number.isInteger(v) ? 149 : 145, C.dim, 1.5));
      [-1, 0, 1].forEach((v) => D.text(signed(v * MM, 0), 600 + v * TRAVEL, 162, { size: 12, col: C.dim, align: 'center' }));
      D.text('mm', 670, 162, { size: 12, col: C.dim });
      D.poly([[tip, 137], [tip - 6, 126], [tip + 6, 126]], null, 0, { close: true, fill: C.w });
      D.text(`x = ${signed(mm, 1)} mm`, 600, 84, { size: 14, bold: true, col: C.w, align: 'center' });
      // amplitudes of the two secondaries and their difference
      D.bar(CX - CW * 1.5, 168, CW, 10, u1 / full, C.U);
      D.bar(CX + CW / 2, 168, CW, 10, u2 / full, C.U);
      D.text(`U_1 = ${st.fix(u1, 2)} V`, CX - CW, 197, { size: 12.5, align: 'center' });
      D.text(`U_2 = ${st.fix(u2, 2)} V`, CX + CW, 197, { size: 12.5, align: 'center' });
      D.text('U_a = U_2 − U_1', CX, 180, { size: 13, bold: true, col: C.U, align: 'center' });
      D.text(`${signed(out.signed, 2)} V`, CX, 197, { size: 13, bold: true, col: C.U, align: 'center' });

      // --- scope: primary (thin) and output (bold), running
      const wt = (tt) => 2 * Math.PI * F * tt;
      const ms = D.map({ x: 62, y: 240, w: 290, h: 140, x0: time - SPAN, x1: time, y0: -6, y1: 6 });
      D.axes(ms, { xt: [], yt: [-4, 0, 4], yf: tick, yl: t({ de: 'Spannung in V', en: 'voltage in V' }), xl: t({ de: 'Zeit →', en: 'time →' }) });
      D.curve(ms, (tt) => Up * Math.sin(wt(tt)), ms.x0, ms.x1, C.dim, 1.3);
      D.curve(ms, (tt) => out.signed * Math.sin(wt(tt)), ms.x0, ms.x1, C.U, 2.8);
      D.dot(ms, time, out.signed * Math.sin(wt(time)), C.U, 4);
      D.legend([['U_p', C.dim], ['U_a', C.U]], 262, 232);
      const phaseMsg = out.phase === null
        ? t({ de: 'Kern in der Mitte: U_a = 0', en: 'core centred: U_a = 0' })
        : out.phase === 0
          ? t({ de: 'U_a schwingt mit U_p: Phase 0°', en: 'U_a swings with U_p: phase 0°' })
          : t({ de: 'U_a schwingt gegen U_p: Phase 180°', en: 'U_a swings against U_p: phase 180°' });
      D.text(phaseMsg, 62, 411, { size: 12.5, bold: true });

      // --- output over the core position
      const mp = D.map({ x: 446, y: 240, w: 290, h: 140, x0: -MM, x1: MM, y0: -5, y1: 5 });
      D.axes(mp, {
        xt: [-10, -5, 0, 5, 10], xf: tick, yt: [-4, -2, 0, 2, 4], yf: tick,
        yl: t({ de: 'Ausgang in V', en: 'output in V' }), xl: t({ de: 'Kernstellung x in mm', en: 'core position x in mm' }),
      });
      D.vline(mp, mm, C.w);
      D.curve(mp, (v) => lvdtOutput(v / MM, Up, k).signed, -MM, MM, C.U, 3);
      D.curve(mp, (v) => lvdtOutput(v / MM, Up, k).amp, -MM, MM, C.ink, 1.6, [4, 6]);
      D.dot(mp, mm, out.amp, C.ink, 3);
      D.dot(mp, mm, out.signed, C.U, 5);
      D.legend([[t({ de: 'Betrag', en: 'magnitude' }), C.ink], [t({ de: 'mit Vorzeichen', en: 'signed' }), C.U]], 552, 232);

      st.readout(`<span class="w">$x$ = <b>${signed(mm, 1)} mm</b></span> &nbsp;·&nbsp; <span class="U">${t({ de: 'Amplitude von $U_a$', en: 'amplitude of $U_a$' })}: <b>${st.fix(out.amp, 2)} V</b></span> &nbsp;·&nbsp; ${t({ de: 'Phase', en: 'phase' })}: <b>${out.phase === null ? '–' : `${out.phase}°`}</b> &nbsp;·&nbsp; ${t({ de: 'demoduliert', en: 'demodulated' })}: <b>${signed(out.signed, 2)} V</b>`);
    });
  },
};

export default {
  id: 's03',
  blocks: [
    h({ de: 'Das Poti als Wegsensor', en: 'The pot as a position sensor' }),
    p({
      de: 'Ein Potentiometer ist eine Widerstandsbahn mit einem Schleifer. Der Schleifer fährt mit dem Messobjekt mit und greift einen Teil der Spannung ab. Das ist ein verschiebbarer Spannungsteiler.',
      en: 'A potentiometer is a resistive track with a sliding contact, the wiper (Schleifer). The wiper moves with the object and taps a part of the voltage. It is a voltage divider that you can shift.',
    }),
    anim(potAnim),
    tryIt({
      de: [
        'Zieh den Schleifer von unten nach oben. $U_a$ wächst mit der Stellung $x$.',
        'Stell $x = 0,5$ und $R_m = 100$ kΩ ein. Das Messgerät zeigt 4,88 V statt 5 V.',
        'Schieb $R_m$ auf 1 kΩ. Die Kurve hängt weit durch, es bleiben nur 1,43 V.',
        'Fahr jetzt an beide Enden der Bahn. Dort stimmt der Wert trotzdem.',
        'Stell $R_m = 1$ MΩ ein. Die Punkte stehen fast still, und der Fehler verschwindet.',
      ],
      en: [
        'Drag the wiper from the bottom to the top. $U_a$ grows with the position $x$.',
        'Set $x = 0.5$ and $R_m = 100$ kΩ. The meter shows 4.88 V instead of 5 V.',
        'Move $R_m$ to 1 kΩ. The curve sags a lot, only 1.43 V are left.',
        'Now go to both ends of the track. There the value is right anyway.',
        'Set $R_m = 1$ MΩ. The dots almost stand still, and the error vanishes.',
      ],
    }),
    formula('$U_a = U_e·x$', {
      de: [['x', 'Schleiferstellung von 0 bis 1, gleich $R_x/R$'], ['U_e', 'Speisespannung in V'], ['U_a', 'Spannung am Schleifer in V']],
      en: [['x', 'wiper position from 0 to 1, equal to $R_x/R$'], ['U_e', 'supply voltage in V'], ['U_a', 'voltage at the wiper in V']],
    }),
    p({
      de: 'Das gilt nur ohne Last. In echt hängt am Schleifer ein Messgerät oder ein AD-Wandler. Sein Eingangswiderstand $R_m$ liegt parallel zum unteren Teil der Bahn. Er zieht Strom ab, und $U_a$ sinkt.',
      en: 'This only holds without a load. In real life a meter or an ADC hangs on the wiper. Its input resistance $R_m$ (Eingangswiderstand) lies in parallel with the lower part of the track. It draws current, and $U_a$ drops.',
    }),
    formula('$[[U_a|U_e]] = [[x|1 + x·(1 − x)·R/R_m]]$', {
      de: [['R', 'Widerstand der ganzen Bahn in Ω'], ['R_m', 'Eingangswiderstand des Messgeräts in Ω']],
      en: [['R', 'resistance of the whole track in Ω'], ['R_m', 'input resistance of the meter in Ω']],
    }),
    p({
      de: 'An beiden Enden ist der Fehler null. Am größten ist er bei etwa $x = 2/3$. Mit $R_m = 10·R$ fehlen dort 1,45 % von $U_e$. Die Regel: $R_m$ muss viel größer sein als $R$.',
      en: 'At both ends the error is zero. It is largest at about $x = 2/3$. With $R_m = 10·R$, 1.45 % of $U_e$ are missing there. The rule: $R_m$ must be much larger than $R$.',
    }),
    example({
      title: { de: 'Belastetes Poti in Mittelstellung', en: 'Loaded pot at mid position' },
      given: {
        de: ['$R = 10$ kΩ', '$R_m = 100$ kΩ', '$x = 0,5$', '$U_e = 10$ V'],
        en: ['$R = 10$ kΩ', '$R_m = 100$ kΩ', '$x = 0.5$', '$U_e = 10$ V'],
      },
      steps: {
        de: [
          'Ohne Last: $U_a = 10·0,5 = 5$ V.',
          'Nenner mit Last: $1 + 0,5·0,5·[[10|100]] = 1,025$.',
          'Mit Last: $U_a = 10·[[0,5|1,025]] = 4,878$ V.',
          'Es fehlen 0,122 V. Das sind 2,4 % des idealen Werts oder 1,2 % von $U_e$.',
        ],
        en: [
          'Without load: $U_a = 10·0.5 = 5$ V.',
          'Denominator with load: $1 + 0.5·0.5·[[10|100]] = 1.025$.',
          'With load: $U_a = 10·[[0.5|1.025]] = 4.878$ V.',
          '0.122 V are missing. That is 2.4 % of the ideal value or 1.2 % of $U_e$.',
        ],
      },
      result: { de: '$U_a ≈ 4,88$ V statt 5 V, also −2,4 %.', en: '$U_a ≈ 4.88$ V instead of 5 V, so −2.4 %.' },
    }),
    p({
      de: 'Das Poti ist einfach und billig und liefert ein großes Signal. Sein Nachteil: Der Schleifer reibt auf der Bahn. Das bringt Verschleiß und Rauschen.',
      en: 'The pot is simple and cheap and gives a large signal. Its drawback: the wiper rubs on the track. That brings wear and noise.',
    }),

    h({ de: 'Ohne Berührung: Spule mit Eisenkern', en: 'No contact: a coil with an iron core' }),
    p({
      de: 'Eine Spule mit beweglichem Eisenkern misst ohne Reibung. Je tiefer der Kern eintaucht, desto größer wird die Induktivität $L$. Leider wächst $L$ nicht linear mit dem Weg.',
      en: 'A coil with a movable iron core measures without friction. The deeper the core dips in, the larger the inductance $L$. Unfortunately $L$ does not grow linearly with the position.',
    }),
    formula('$L = [[N^2·A·μ_0·μ_r|l]]$', {
      de: [['N', 'Windungszahl'], ['A', 'Querschnitt der Spule in m²'], ['l', 'Länge der Spule in m'], ['μ_r', 'Permeabilitätszahl: groß, wo Eisen in der Spule steckt']],
      en: [['N', 'number of turns'], ['A', 'coil cross-section in m²'], ['l', 'coil length in m'], ['μ_r', 'relative permeability: large where iron sits inside']],
    }),
    p({
      de: 'Der Ausweg heißt Differenzprinzip: zwei Spulen und ein Kern. Wandert der Kern, wächst die eine Induktivität und die andere sinkt. Die Differenz ist fast linear.',
      en: 'The way out is the differential principle: two coils and one core. When the core moves, one inductance grows and the other one drops. The difference is almost linear.',
    }),

    h({ de: 'Der Differentialtransformator (LVDT)', en: 'The differential transformer (LVDT)' }),
    p({
      de: 'Der LVDT hat drei Spulen und einen Eisenkern. Die Primärspule in der Mitte bekommt eine Wechselspannung $U_p$. Die zwei Sekundärspulen sind gegeneinander geschaltet. Am Ausgang liegt also die Differenz $U_a = U_2 − U_1$.',
      en: 'The LVDT (Differentialtransformator) has three coils and an iron core. The primary coil in the middle is fed with an AC voltage $U_p$. The two secondary coils are wired against each other. So the output is the difference $U_a = U_2 − U_1$.',
    }),
    anim(lvdtAnim),
    tryIt({
      de: [
        'Stell $x = 0$ ein. Beide Sekundärspulen liefern gleich viel, die Differenz ist null.',
        'Schieb den Kern auf +5 mm. $U_2$ wächst auf 3 V, $U_1$ sinkt auf 1 V. Die Amplitude von $U_a$ ist 2 V.',
        'Schieb auf −5 mm. Die Amplitude ist wieder 2 V. Aber $U_a$ schwingt jetzt gegen $U_p$.',
      ],
      en: [
        'Set $x = 0$. Both secondary coils deliver the same, the difference is zero.',
        'Move the core to +5 mm. $U_2$ grows to 3 V, $U_1$ drops to 1 V. The amplitude of $U_a$ is 2 V.',
        'Move to −5 mm. The amplitude is 2 V again. But now $U_a$ swings against $U_p$.',
      ],
    }),
    p({
      de: 'Die Amplitude zeigt nur, wie weit der Kern von der Mitte weg ist. Die Seite steckt in der Phase: 0° oder 180° gegen $U_p$. Ein phasenempfindlicher Gleichrichter macht daraus eine Spannung mit Vorzeichen.',
      en: 'The amplitude only shows how far the core is from the centre. The side is in the phase: 0° or 180° against $U_p$. A phase-sensitive rectifier turns this into a voltage with a sign.',
    }),
    p({
      de: 'Die Animation rechnet mit einer ideal linearen Kopplung. Echte Spulen sind nur um die Mitte herum linear. Dafür misst der LVDT berührungslos, ohne Verschleiß und mit sehr feiner Auflösung.',
      en: 'The animation uses an ideally linear coupling. Real coils are linear only around the centre. In return the LVDT measures without contact, without wear and with very fine resolution.',
    }),
    p({
      de: 'Auch der Wirbelstromsensor arbeitet mit einer Spule. Ihr Wechselfeld erzeugt Wirbelströme in einem nahen Metallteil. Je kleiner der Abstand, desto stärker ändert sich die Impedanz der Spule. Das klappt nur mit leitenden Zielen.',
      en: 'The eddy-current sensor (Wirbelstromsensor) also works with a coil. Its AC field induces eddy currents in a nearby metal part. The smaller the distance, the more the impedance of the coil changes. This only works with conducting targets.',
    }),
    note({
      de: [
        'Poti: $U_a = U_e·x$ gilt nur, wenn $R_m$ viel größer ist als $R$.',
        'LVDT: Kern in der Mitte heißt $U_a = 0$. Die Amplitude zeigt den Abstand, die Phase die Seite.',
        'Induktive Sensoren messen berührungslos. Nichts reibt, nichts nutzt sich ab.',
      ],
      en: [
        'Pot: $U_a = U_e·x$ only holds if $R_m$ is much larger than $R$.',
        'LVDT: core in the centre means $U_a = 0$. The amplitude shows the distance, the phase shows the side.',
        'Inductive sensors measure without contact. Nothing rubs, nothing wears out.',
      ],
    }),
    quiz([
      {
        q: {
          de: 'Ein Poti mit $R = 10$ kΩ steht in Mittelstellung, $U_e = 10$ V. Das Messgerät hat $R_m = 40$ kΩ. Wie groß ist $U_a$?',
          en: 'A pot with $R = 10$ kΩ is at mid position, $U_e = 10$ V. The meter has $R_m = 40$ kΩ. How large is $U_a$?',
        },
        answer: 4.71, unit: 'V', decimals: 2,
        why: {
          de: 'Nenner: $1 + 0,5·0,5·[[10|40]] = 1,0625$. Also $U_a = 5/1,0625$ V.',
          en: 'Denominator: $1 + 0.5·0.5·[[10|40]] = 1.0625$. So $U_a = 5/1.0625$ V.',
        },
      },
      {
        q: {
          de: 'Der LVDT-Kern steht 3 mm rechts der Mitte. Du schiebst ihn auf 3 mm links der Mitte. Was ändert sich an $U_a$?',
          en: 'The LVDT core is 3 mm right of the centre. You move it to 3 mm left of the centre. What changes in $U_a$?',
        },
        options: {
          de: ['Nur die Phase: Sie springt um 180°', 'Nur die Amplitude: Sie verdoppelt sich', 'Gar nichts'],
          en: ['Only the phase: it jumps by 180°', 'Only the amplitude: it doubles', 'Nothing at all'],
        },
        correct: 0,
        why: {
          de: 'Die Amplitude hängt nur vom Abstand zur Mitte ab. Die Seite steckt in der Phase.',
          en: 'The amplitude depends only on the distance from the centre. The side is in the phase.',
        },
      },
      {
        q: { de: 'Welches Ziel kann ein Wirbelstromsensor erfassen?', en: 'Which target can an eddy-current sensor detect?' },
        options: {
          de: ['Eine Aluminiumplatte', 'Eine Glasscheibe', 'Ein Kunststoffteil'],
          en: ['An aluminium plate', 'A glass pane', 'A plastic part'],
        },
        correct: 0,
        why: { de: 'Wirbelströme fließen nur in leitendem Material.', en: 'Eddy currents only flow in conducting material.' },
      },
    ]),
  ],
};
