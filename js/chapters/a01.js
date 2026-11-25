// A01 — Actuator, sensor, control loop. Its animation is also the hero of the home page.

import { h, p, anim, formula, tryIt, note, quiz, table } from '../core/dsl.js';
import { Trace } from '../core/draw.js';
import { EXAMPLE_MOTOR, stepMotorNoL, speedGain, toRpm, fromRpm } from '../physics/dcmotor.js';
import { piStep } from '../physics/control.js';

// the example motor with a flywheel, so the run-up takes about half a second in real time
const DRIVE = Object.freeze({ ...EXAMPLE_MOTOR, J: 60e-6 });
const PI_CFG = Object.freeze({ kp: 0.06, ti: 0.5, uMin: 0, uMax: 12 });
const LOAD = 0.01; // N·m
const SPAN = 8; // seconds shown in the plot

export const heroAnim = {
  id: 'a01-loop',
  title: { de: 'Steuern oder regeln: ein Motor soll seine Drehzahl halten', en: 'Open or closed loop: a motor has to hold its speed' },
  hint: {
    de: 'Leg die Last auf. Öffne dann den Regelkreis und vergleiche.',
    en: 'Apply the load. Then open the loop and compare.',
  },
  height: 400,
  build(st) {
    const { D, C, t } = st;
    const RPM = t({ de: 'min⁻¹', en: 'rpm' });
    const RPM_CV = t({ de: 'min^{−1}', en: 'rpm' }); // canvas text markup
    let state = { i: 0, w: 0, phi: 0 };
    let ctrl = { integ: 0 };
    let u = 0, time = 0, loadOn = false, spin = 0;
    const trSet = new Trace(1200), trAct = new Trace(1200);

    const setS = st.slider({ label: { de: 'Soll-Drehzahl', en: 'Speed setpoint' }, min: 500, max: 3500, step: 100, value: 2500, unit: RPM });
    const closed = st.toggle({ label: { de: 'Regelkreis geschlossen (Sensor wirkt zurück)', en: 'Loop closed (sensor feeds back)' }, value: true, on: () => { ctrl = { integ: 0 }; } });
    const loadBtn = st.button({ de: 'Last auflegen', en: 'Apply load' }, () => {
      loadOn = !loadOn;
      loadBtn.label(loadOn ? { de: 'Last wegnehmen', en: 'Remove load' } : { de: 'Last auflegen', en: 'Apply load' });
    }, 'primary');

    const SUM = [120, 80];
    const box = (x, y, w, hh, label, sub) => {
      D.rect(x, y, w, hh, { fill: C.panel, stroke: C.ink, lw: 2 });
      D.text(label, x + w / 2, y + (sub ? hh / 2 - 7 : hh / 2), { size: 14, align: 'center', base: 'middle', bold: true });
      if (sub) D.text(sub, x + w / 2, y + hh / 2 + 10, { size: 11.5, align: 'center', base: 'middle', col: C.dim });
    };

    st.loop((dt) => {
      const wSet = fromRpm(setS.value);
      const Ml = loadOn ? LOAD : 0;
      const n = 4;
      for (let k = 0; k < n && dt > 0; k++) {
        const h2 = dt / n;
        if (closed.value) {
          const out = piStep(ctrl, wSet - state.w, PI_CFG, h2);
          ctrl = { integ: out.integ };
          u = out.u;
        } else {
          u = Math.min(12, wSet / speedGain(DRIVE)); // calibrated once, without load
        }
        state = stepMotorNoL(state, { U: u, Ml }, DRIVE, h2);
      }
      time += dt;
      spin += state.w * 0.02 * dt;
      if (dt > 0) { trSet.push(time, toRpm(wSet)); trAct.push(time, toRpm(state.w)); }
      const e = wSet - state.w;

      D.clear();
      // --- forward path
      D.text(t({ de: 'Sollwert', en: 'setpoint' }), 22, 64, { size: 12.5, col: C.dim });
      D.arrow(22, 80, SUM[0] - 14, 80, C.ink, 2);
      D.circle(SUM[0], SUM[1], 13, { fill: C.panel, stroke: C.ink, lw: 2 });
      D.text('+', SUM[0] - 24, 72, { size: 13, bold: true });
      D.text('−', SUM[0] - 22, 104, { size: 14, bold: true, col: closed.value ? C.ink : C.faint });
      D.arrow(SUM[0] + 13, 80, 176, 80, C.ink, 2);
      D.text('e', 150, 70, { size: 14, bold: true, align: 'center' });
      box(176, 56, 108, 48, t({ de: 'Regler', en: 'Controller' }), t({ de: 'entscheidet', en: 'decides' }));
      D.arrow(284, 80, 346, 80, C.U, 2.5);
      D.text(`u = ${st.fix(u, 1)} V`, 315, 68, { size: 13, bold: true, col: C.U, align: 'center' });
      box(346, 56, 108, 48, t({ de: 'Motor', en: 'Motor' }), t({ de: 'Aktor: handelt', en: 'actuator: acts' }));
      D.line(454, 80, 512, 80, C.ink, 5);

      // --- flywheel with encoder marks
      const cx = 556, cy = 80, r = 44;
      D.circle(cx, cy, r, { fill: C.panel, stroke: C.ink, lw: 2.5 });
      for (let k = 0; k < 12; k++) {
        const a = spin + (k * Math.PI) / 6;
        D.line(cx + (r - 12) * Math.cos(a), cy + (r - 12) * Math.sin(a), cx + (r - 3) * Math.cos(a), cy + (r - 3) * Math.sin(a), k ? C.dim : C.w, k ? 2 : 4);
      }
      D.circle(cx, cy, 6, { fill: C.ink });
      D.arcArrow(cx, cy, r + 9, -2.2, -0.9, C.w, 2.5);
      D.text(`${st.fix(toRpm(state.w), 0)} ${RPM_CV}`, cx + r + 20, cy - 26, { size: 15, bold: true, col: C.w });
      if (loadOn) {
        D.rect(cx + r + 2, cy - 4, 26, 30, { fill: C.M, r: 3 });
        D.arrow(cx + r + 62, cy + 11, cx + r + 30, cy + 11, C.M, 2.5);
        D.text(t({ de: 'Last 10 mNm', en: 'load 10 mNm' }), cx + r + 34, cy + 44, { size: 12.5, bold: true, col: C.M });
      }

      // --- feedback path through the sensor
      const fbCol = closed.value ? C.ink : C.faint;
      D.line(cx, cy + r, cx, 150, C.ink, 2);
      box(496, 150, 120, 40, t({ de: 'Drehgeber', en: 'Encoder' }), t({ de: 'Sensor: misst', en: 'sensor: measures' }));
      if (closed.value) {
        D.wire([[496, 170], [SUM[0], 170], [SUM[0], 96]], fbCol, 2);
        D.arrow(SUM[0], 110, SUM[0], 93, fbCol, 2);
        D.flow([[496, 170], [SUM[0], 170], [SUM[0], 96]], time * 46, { col: C.w, r: 2.6, gap: 24 });
      } else {
        D.poly([[496, 170], [330, 170]], fbCol, 2, { dash: [6, 6] });
        D.poly([[290, 170], [SUM[0], 170], [SUM[0], 96]], fbCol, 2, { dash: [6, 6] });
        D.text('✕', 310, 175, { size: 18, bold: true, col: C.bad, align: 'center' });
      }
      D.text(t({ de: 'Istwert', en: 'measured value' }), 300, 162, { size: 12.5, col: closed.value ? C.w : C.faint, align: 'center', bg: closed.value ? null : C.paper });

      // --- speed over time
      const x0 = Math.max(0, time - SPAN);
      const m = D.map({ x: 62, y: 232, w: 672, h: 120, x0, x1: x0 + SPAN, y0: 0, y1: 4000 });
      D.axes(m, { yt: [0, 1000, 2000, 3000, 4000], xt: [], yl: t({ de: 'Drehzahl in min^{−1}', en: 'speed in rpm' }), xl: t({ de: 'Zeit →', en: 'time →' }) });
      D.series(m, trSet.pts, C.dim, 1.6, [6, 5]);
      D.series(m, trAct.pts, C.w, 2.8);
      D.legend([[t({ de: 'Soll', en: 'setpoint' }), C.dim], [t({ de: 'Ist', en: 'actual' }), C.w]], 560, 224);

      const off = Math.abs(toRpm(e)) > 25;
      const msg = closed.value
        ? (u >= 11.99 ? t({ de: 'Der Regler ist am Anschlag: mehr als 12 V gibt es nicht.', en: 'The controller is at its limit: there is no more than 12 V.' })
          : t({ de: 'Der Regler sieht den Fehler und gleicht ihn aus.', en: 'The controller sees the error and removes it.' }))
        : (off ? t({ de: 'Ohne Rückführung bemerkt niemand den Fehler.', en: 'Without feedback nobody notices the error.' })
          : t({ de: 'Ohne Last passt die Steuerung. Leg die Last auf.', en: 'Without load the open loop fits. Apply the load.' }));
      st.readout(`${t({ de: 'Abweichung', en: 'error' })} $e$ = <b>${st.fix(toRpm(e), 0)} ${RPM}</b> &nbsp;·&nbsp; <span class="U">$u$ = <b>${st.fix(u, 1)} V</b></span> &nbsp;·&nbsp; ${msg}`);
    });
  },
};

export default {
  id: 'a01',
  blocks: [
    h({ de: 'Zwei Bausteine', en: 'Two building blocks' }),
    p({
      de: 'Ein <b>Aktor</b> macht aus einem elektrischen Signal eine Wirkung. Zum Beispiel eine Drehung. Ein <b>Sensor</b> macht es umgekehrt: Er macht aus einer physikalischen Größe ein elektrisches Signal.',
      en: 'An <b>actuator</b> turns an electrical signal into an effect. A rotation, for example. A <b>sensor</b> does the opposite: it turns a physical quantity into an electrical signal.',
    }),
    table({
      head: { de: ['', 'Eingang', 'Ausgang', 'Beispiel'], en: ['', 'Input', 'Output', 'Example'] },
      rows: [
        [{ de: 'Aktor', en: 'Actuator' }, { de: 'elektrisches Signal', en: 'electrical signal' }, { de: 'Bewegung, Kraft, Wärme', en: 'motion, force, heat' }, { de: 'Gleichstrommotor', en: 'DC motor' }],
        [{ de: 'Sensor', en: 'Sensor' }, { de: 'physikalische Größe', en: 'physical quantity' }, { de: 'elektrisches Signal', en: 'electrical signal' }, { de: 'Drehgeber', en: 'rotary encoder' }],
      ],
    }),

    h({ de: 'Steuern oder regeln?', en: 'Open loop or closed loop?' }),
    p({
      de: 'Beim <b>Steuern</b> gibst du eine Spannung vor und hoffst. Beim <b>Regeln</b> misst ein Sensor das Ergebnis. Der Regler vergleicht es mit dem Sollwert und korrigiert.',
      en: 'In <b>open loop</b> you set a voltage and hope. In <b>closed loop</b> a sensor measures the result. The controller compares it with the setpoint and corrects.',
    }),
    anim(heroAnim),
    tryIt({
      de: [
        'Leg die Last auf. Die Drehzahl bricht kurz ein. Dann holt der Regler sie zurück.',
        'Öffne den Regelkreis (Haken entfernen). Leg die Last wieder auf. Jetzt bleibt die Drehzahl zu niedrig.',
        'Stell 3500 min⁻¹ mit Last ein. Beobachte die Stellgröße $u$.',
      ],
      en: [
        'Apply the load. The speed dips for a moment. Then the controller brings it back.',
        'Open the loop (remove the tick). Apply the load again. Now the speed stays too low.',
        'Set 3500 rpm with load. Watch the control signal $u$.',
      ],
    }),
    formula('$e = ω_{soll} − ω_{ist}$', {
      de: [['e', 'Regelabweichung'], ['ω_{soll}', 'Sollwert (Führungsgröße)'], ['ω_{ist}', 'Istwert (Regelgröße), vom Sensor gemessen']],
      en: [['e', 'control error'], ['ω_{soll}', 'setpoint (reference)'], ['ω_{ist}', 'measured value (controlled variable), from the sensor']],
    }),

    h({ de: 'Die Wörter im Regelkreis', en: 'The words in the loop' }),
    table({
      head: { de: ['Begriff', 'Im Beispiel'], en: ['Term (German exam word)', 'In the example'] },
      rows: [
        [{ de: 'Sollwert', en: 'Setpoint (Sollwert)' }, { de: 'gewünschte Drehzahl', en: 'desired speed' }],
        [{ de: 'Regelabweichung $e$', en: 'Control error $e$ (Regelabweichung)' }, { de: 'Soll minus Ist', en: 'setpoint minus measured value' }],
        [{ de: 'Regler', en: 'Controller (Regler)' }, { de: 'berechnet aus $e$ die Spannung', en: 'computes the voltage from $e$' }],
        [{ de: 'Stellgröße $u$', en: 'Control signal $u$ (Stellgröße)' }, { de: 'Motorspannung', en: 'motor voltage' }],
        [{ de: 'Regelstrecke', en: 'Plant (Regelstrecke)' }, { de: 'Motor mit Schwungrad', en: 'motor with flywheel' }],
        [{ de: 'Störgröße', en: 'Disturbance (Störgröße)' }, { de: 'Lastmoment', en: 'load torque' }],
        [{ de: 'Messglied', en: 'Measuring element (Messglied)' }, { de: 'Drehgeber', en: 'rotary encoder' }],
      ],
    }),
    note({
      de: [
        'Aktor: Signal wird Wirkung. Sensor: Größe wird Signal.',
        'Regeln heißt: messen, vergleichen, korrigieren. Immer wieder.',
        'Ohne Sensor gibt es keine Regelung.',
      ],
      en: [
        'Actuator: signal becomes effect. Sensor: quantity becomes signal.',
        'Closed-loop control means: measure, compare, correct. Again and again.',
        'Without a sensor there is no closed-loop control.',
      ],
    }),
    quiz([
      {
        q: { de: 'Ein Temperaturfühler meldet 21 °C als Spannung an einen Mikrocontroller. Was ist der Fühler?', en: 'A temperature probe reports 21 °C as a voltage to a microcontroller. What is the probe?' },
        options: { de: ['Aktor', 'Sensor', 'Regler'], en: ['Actuator', 'Sensor', 'Controller'] },
        correct: 1,
        why: { de: 'Er macht aus einer physikalischen Größe ein elektrisches Signal.', en: 'It turns a physical quantity into an electrical signal.' },
      },
      {
        q: { de: 'Soll: 2500 min⁻¹. Ist: 2350 min⁻¹. Wie groß ist die Regelabweichung $e$?', en: 'Setpoint: 2500 rpm. Measured: 2350 rpm. How large is the control error $e$?' },
        answer: 150, unit: { de: 'min⁻¹', en: 'rpm' }, decimals: 0,
        why: { de: '$e$ ist Soll minus Ist.', en: '$e$ is setpoint minus measured value.' },
      },
    ]),
  ],
};
