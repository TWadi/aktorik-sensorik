// S02 — Strain gauge and Wheatstone bridge.

import { h, p, anim, formula, tryIt, note, example, quiz, table } from '../core/dsl.js';
import { STRAIN_GAUGE, gaugeDeltaR, bridgeOut, bridgeApprox, bridgeResistors } from '../physics/bridge.js';

const bridgeAnim = {
  id: 's02-bridge',
  title: { de: 'Biegebalken mit DMS und Brückenschaltung', en: 'Bending beam with strain gauges and bridge circuit' },
  hint: {
    de: 'Die Biegung ist stark übertrieben gezeichnet. Rot heißt gedehnt, violett heißt gestaucht.',
    en: 'The bending is drawn strongly exaggerated. Red means stretched, violet means compressed.',
  },
  height: 420,
  build(st) {
    const { D, C, t } = st;
    const { R, k } = STRAIN_GAUGE;
    let flow = 0;
    const kind = st.select({
      label: { de: 'Aktive DMS', en: 'Active gauges' }, value: 'quarter',
      options: [
        { v: 'quarter', label: { de: '1 · Viertelbrücke', en: '1 · quarter bridge' } },
        { v: 'half', label: { de: '2 · Halbbrücke', en: '2 · half bridge' } },
        { v: 'full', label: { de: '4 · Vollbrücke', en: '4 · full bridge' } },
      ],
    });
    const epsS = st.slider({ label: { de: 'Dehnung $ε$', en: 'Strain $ε$' }, min: 0, max: 2000, step: 50, value: 1000, unit: 'µm/m' });
    const ueS = st.slider({ label: { de: 'Speisung $U_e$', en: 'Supply $U_e$' }, min: 1, max: 10, step: 0.5, value: 5, unit: 'V' });

    // bridge corner points
    const T = [560, 62], B = [560, 318], A = [452, 190], Bn = [668, 190];
    const supply = [T, [560, 38], [392, 38], [392, 342], [560, 342], B];
    const gaugeCol = (sign) => (sign > 0 ? C.bad : sign < 0 ? C.M : null);
    const mark = (sign) => (sign > 0 ? ' +' : sign < 0 ? ' −' : '');

    st.loop((dt) => {
      const eps = epsS.value * 1e-6, Ue = ueS.value;
      const dR = gaugeDeltaR(R, k, eps);
      const [R1, R2, R3, R4] = bridgeResistors(kind.value, R, dR);
      const signs = [R1 - R, R2 - R, R3 - R, R4 - R].map(Math.sign);
      const ua = bridgeOut(R1, R2, R3, R4, Ue);
      const approx = bridgeApprox(R1 - R, R2 - R, R3 - R, R4 - R, R, Ue);
      flow += Ue * 9 * dt;

      D.clear();
      // --- bending beam (cantilever), deflection exaggerated
      const x0 = 52, len = 250, yMid = 120, thick = 18;
      const tip = (eps / 2e-3) * 46;
      const defl = (x) => { const s = (x - x0) / len; return tip * (1.5 * s * s - 0.5 * s * s * s); };
      const slope = (x) => { const s = (x - x0) / len; return (tip * (3 * s - 1.5 * s * s)) / len; };
      const edge = (off) => Array.from({ length: 26 }, (_, n) => {
        const x = x0 + (len * n) / 25;
        return [x - Math.sin(Math.atan(slope(x))) * off, yMid + defl(x) + off];
      });
      D.hatch(26, 60, 26, 120);
      D.line(52, 60, 52, 180, C.ink, 2.5);
      D.poly([...edge(-thick / 2), ...edge(thick / 2).reverse()], C.ink, 2, { close: true, fill: C.fe });
      const gauge = (xa, xb, top, sign, name) => {
        const off = top ? -thick / 2 - 4 : thick / 2 + 4;
        const pts = [xa, xb].map((x) => [x, yMid + defl(x) + off]);
        D.line(pts[0][0], pts[0][1], pts[1][0], pts[1][1], gaugeCol(sign) || C.dim, 7);
        D.text(`${name}${mark(sign)}`, (xa + xb) / 2, pts[0][1] + (top ? -12 : 21), { size: 12.5, align: 'center', bold: true, col: gaugeCol(sign) || C.dim });
      };
      gauge(70, 118, true, signs[0], 'R_1');
      if (kind.value !== 'quarter') gauge(70, 118, false, signs[1], 'R_2');
      if (kind.value === 'full') { gauge(136, 184, true, signs[2], 'R_3'); gauge(136, 184, false, signs[3], 'R_4'); }
      const tx = x0 + len - 6, ty = yMid + defl(tx);
      D.arrow(tx, ty - 62, tx, ty - thick / 2 - 3, C.ink, 2.5);
      D.text('F', tx + 9, ty - 44, { size: 15, bold: true });
      D.text(t({ de: 'oben: gedehnt', en: 'top: stretched' }), 200, 70, { size: 12, col: C.bad });
      D.text(t({ de: 'unten: gestaucht', en: 'bottom: compressed' }), 62, 214, { size: 12, col: C.M });

      // --- output meter
      D.gauge(120, 330, 56, ua / 0.025, { signed: true, col: C.U, label: 'U_a' });
      D.text(st.si(ua, 'V'), 205, 326, { size: 20, bold: true, col: C.U });
      D.text(t({ de: 'Zeiger: ±25 mV', en: 'needle: ±25 mV' }), 205, 348, { size: 12, col: C.dim });

      // --- bridge circuit
      D.wire(supply);
      D.source(392, 190, 16, { label: 'U_e', labelCol: C.U });
      D.flow([[392, 174], [392, 38], [560, 38], T, A, B, [560, 342], [392, 342], [392, 206]], flow, { gap: 30 });
      D.flow([T, Bn, B], flow, { gap: 30 });
      const arm = (P1, P2, name, sign, side) => D.resistor(P1[0], P1[1], P2[0], P2[1], {
        label: `${name}${mark(sign)}`, side, labelOff: 30,
        fill: gaugeCol(sign) || C.panel, labelCol: gaugeCol(sign) || C.ink,
      });
      arm(T, A, 'R_1', signs[0], -1);
      arm(A, B, 'R_2', signs[1], -1);
      arm(T, Bn, 'R_4', signs[3], 1);
      arm(Bn, B, 'R_3', signs[2], 1);
      D.line(A[0], A[1], Bn[0], Bn[1], C.ink, 2);
      D.meter(560, 190, 17, 'V', { col: C.U });
      D.node(...T); D.node(...B); D.node(...A); D.node(...Bn);
      D.uArrow(Bn[0] - 26, 216, A[0] + 26, 216, 'U_a', C.U, { off: 14 });

      const err = ua !== 0 ? ((approx - ua) / ua) * 100 : 0;
      st.readout(`$ΔR = R·k·ε$ = <b>${st.num(dR, 3)} Ω</b> ${t({ de: 'von', en: 'of' })} ${R} Ω &nbsp;·&nbsp; <span class="U">$U_a$ = <b>${st.si(ua, 'V', 4)}</b></span> &nbsp;·&nbsp; ${t({ de: 'Näherung', en: 'approximation' })}: ${st.si(approx, 'V', 4)} (${t({ de: 'Abweichung', en: 'deviation' })} ${st.fix(err, 2)} %)`);
    });
  },
};

export default {
  id: 's02',
  blocks: [
    h({ de: 'Der Dehnungsmessstreifen', en: 'The strain gauge' }),
    p({
      de: 'Ein Dehnungsmessstreifen (DMS) ist ein dünner Leiter auf einer Folie. Du klebst ihn auf ein Bauteil. Wird das Bauteil gedehnt, wird der Leiter länger und dünner. Sein Widerstand steigt.',
      en: 'A strain gauge is a thin conductor on a foil. You glue it onto a part. When the part is stretched, the conductor gets longer and thinner. Its resistance rises.',
    }),
    formula('$[[ΔR|R]] = k·ε$', {
      de: [['ε', 'Dehnung $Δl/l$, ohne Einheit'], ['k', 'k-Faktor des DMS, bei Metall etwa 2'], ['ΔR', 'Widerstandsänderung in Ω']],
      en: [['ε', 'strain $Δl/l$, no unit'], ['k', 'gauge factor, about 2 for metal'], ['ΔR', 'change of resistance in Ω']],
    }),
    p({
      de: 'Das Problem: Die Änderung ist winzig. Bei $ε = 0,001$ und $R = 350 Ω$ sind es nur $0,7 Ω$. Das sind 0,2 Prozent.',
      en: 'The problem: the change is tiny. With $ε = 0.001$ and $R = 350 Ω$ it is only $0.7 Ω$. That is 0.2 percent.',
    }),

    h({ de: 'Die Brücke macht es sichtbar', en: 'The bridge makes it visible' }),
    p({
      de: 'Die Wheatstone-Brücke besteht aus zwei Spannungsteilern. Gemessen wird die Spannung zwischen den beiden Mittelpunkten. Sind alle vier Widerstände gleich, ist $U_a = 0$. Schon eine kleine Änderung verstimmt die Brücke.',
      en: 'The Wheatstone bridge consists of two voltage dividers. You measure the voltage between the two mid points. If all four resistors are equal, $U_a = 0$. Even a small change unbalances the bridge.',
    }),
    anim(bridgeAnim),
    tryIt({
      de: [
        'Schieb die Dehnung auf 0. Die Brücke ist abgeglichen, $U_a = 0$.',
        'Stell 1000 µm/m ein und schalte von Viertel- auf Halb- auf Vollbrücke. $U_a$ verdoppelt sich jedes Mal.',
        'Achte bei der Viertelbrücke auf die Abweichung. Bei Halb- und Vollbrücke ist sie null.',
      ],
      en: [
        'Move the strain to 0. The bridge is balanced, $U_a = 0$.',
        'Set 1000 µm/m and switch from quarter to half to full bridge. $U_a$ doubles each time.',
        'Watch the deviation of the quarter bridge. For half and full bridge it is zero.',
      ],
    }),
    formula('$[[U_a|U_e]] = [[R_1|R_1 + R_2]] − [[R_4|R_3 + R_4]]$', {
      de: [['R_1, R_2', 'linker Spannungsteiler (oben, unten)'], ['R_4, R_3', 'rechter Spannungsteiler (oben, unten)']],
      en: [['R_1, R_2', 'left voltage divider (top, bottom)'], ['R_4, R_3', 'right voltage divider (top, bottom)']],
    }),
    p({
      de: 'Für kleine Änderungen gilt eine einfache Näherung. Nachbarn in der Brücke wirken mit entgegengesetztem Vorzeichen.',
      en: 'For small changes there is a simple approximation. Neighbours in the bridge act with opposite signs.',
    }),
    formula('$[[U_a|U_e]] ≈ [[1|4]]·[[ΔR_1 − ΔR_2 + ΔR_3 − ΔR_4|R]]$'),
    table({
      head: { de: ['Schaltung', 'Aktive DMS', '$U_a / U_e$'], en: ['Circuit', 'Active gauges', '$U_a / U_e$'] },
      rows: [
        [{ de: 'Viertelbrücke', en: 'Quarter bridge' }, '1', '$≈ [[1|4]]·k·ε$'],
        [{ de: 'Halbbrücke', en: 'Half bridge' }, '2', '$= [[1|2]]·k·ε$'],
        [{ de: 'Vollbrücke', en: 'Full bridge' }, '4', '$= k·ε$'],
      ],
    }),
    note({
      de: [
        'Gedehnte und gestauchte DMS gehören auf benachbarte Plätze. Dann addieren sich ihre Wirkungen.',
        'Die Vollbrücke liefert das größte Signal und ist exakt linear.',
        'Temperatur ändert alle vier Widerstände gleich. In der Brücke hebt sich das auf.',
      ],
      en: [
        'Stretched and compressed gauges belong on neighbouring positions. Then their effects add up.',
        'The full bridge gives the largest signal and is exactly linear.',
        'Temperature changes all four resistors equally. In the bridge this cancels out.',
      ],
    }),
    example({
      title: { de: 'Viertelbrücke', en: 'Quarter bridge' },
      given: { de: ['$R = 350 Ω$', '$k = 2$', '$ε = 0,001$', '$U_e = 5$ V'], en: ['$R = 350 Ω$', '$k = 2$', '$ε = 0.001$', '$U_e = 5$ V'] },
      steps: {
        de: [
          'Widerstandsänderung: $ΔR = 350·2·0,001 = 0,7 Ω$.',
          'Näherung: $U_a ≈ [[5|4]]·[[0,7|350]] = 2,5$ mV.',
          'Exakt: $U_a = 5·([[350,7|700,7]] − [[1|2]]) = 2,4975$ mV.',
        ],
        en: [
          'Change of resistance: $ΔR = 350·2·0.001 = 0.7 Ω$.',
          'Approximation: $U_a ≈ [[5|4]]·[[0.7|350]] = 2.5$ mV.',
          'Exact: $U_a = 5·([[350.7|700.7]] − [[1|2]]) = 2.4975$ mV.',
        ],
      },
      result: { de: '$U_a ≈ 2,5$ mV. Die Näherung liegt nur 0,1 % daneben.', en: '$U_a ≈ 2.5$ mV. The approximation is only 0.1 % off.' },
    }),
    quiz([
      {
        q: { de: 'Vollbrücke mit $k = 2$, $ε = 0,0005$ und $U_e = 10$ V. Wie groß ist $U_a$ in mV?', en: 'Full bridge with $k = 2$, $ε = 0.0005$ and $U_e = 10$ V. How large is $U_a$ in mV?' },
        answer: 10, unit: 'mV', decimals: 0,
        why: { de: '$U_a = k·ε·U_e = 2·0,0005·10$ V.', en: '$U_a = k·ε·U_e = 2·0.0005·10$ V.' },
      },
      {
        q: { de: 'Du setzt zwei gedehnte DMS auf $R_1$ und $R_2$. Was misst du?', en: 'You put two stretched gauges on $R_1$ and $R_2$. What do you measure?' },
        options: { de: ['Doppeltes Signal', 'Null', 'Halbes Signal'], en: ['Double signal', 'Zero', 'Half signal'] },
        correct: 1,
        why: { de: '$R_1$ und $R_2$ sind Nachbarn. Gleiche Änderungen heben sich dort auf.', en: '$R_1$ and $R_2$ are neighbours. Equal changes cancel there.' },
      },
    ]),
  ],
};
