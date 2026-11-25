# How to write a sheet (chapter)

One sheet = one file `js/chapters/<id>.js` (for example `a05.js`). Titles and order live in
`js/manifest.js`. Reference sheets: `a04.js` (circuit + time plots), `s02.js` (sensor + circuit),
`a01.js` (block diagram + scrolling plot). Read them before you start.

## The reader

- Learns by moving a slider and watching. Loses focus on long text.
- So: **animation first, formula second, text last.** The first animation comes within the first
  seven blocks.
- Sentences are short. One idea per sentence. Aim for 8 to 15 words; the tests fail above 26.
- Concrete numbers before the general rule.
- German and English, both complete and saying the same thing. In English, give the German exam
  term once in brackets where it helps, e.g. "back-EMF (Gegenspannung)".
- German uses the decimal comma (`0,024`), English the point (`0.024`).

## File shape

```js
import { h, p, anim, formula, tryIt, note, steps, example, quiz, table } from '../core/dsl.js';

const myAnim = { id: 'a05-kennlinie', title: { de, en }, hint: { de, en }, height: 420, build(st) { ... } };

export default {
  id: 'a05',
  blocks: [ h({ de, en }), p({ de, en }), anim(myAnim), tryIt({ de: [...], en: [...] }), ... ],
};
```

Required in every sheet: starts with `h`, at least one `anim`, one `tryIt` right after each
animation, one `note` (two or three things to remember), one `quiz` (two to four questions, at
least one numeric). A worked `example` wherever there is something to calculate.

Formula markup inside `$...$`: `U_a`, `k_{em}`, `s^2`, `10^{-3}`, `[[numerator|denominator]]`.
No nested fractions. Use Unicode for Greek and operators (ω, φ, Δ, ·, ≈, √, −). Never use
backticks or `${` inside texts.

## Colour code (fixed on every sheet)

| Quantity | Palette key |
|---|---|
| voltage | `C.U` (blue) |
| current | `C.i` (orange) |
| speed, motion, position | `C.w` (green) |
| torque, force | `C.M` (violet) |
| magnet poles | `C.N`, `C.S` |
| copper, iron | `C.cu`, `C.fe` |
| text, secondary text, faint lines | `C.ink`, `C.dim`, `C.faint` |
| status | `C.ok`, `C.warn`, `C.bad` |

Read colours from `C` at draw time (`C.ink`, never a cached copy, never a hex code): the light and
the blueprint theme swap the palette. In the readout you can colour a value with
`<span class="U">…</span>` (also `i`, `w`, `M`).

## Animations

`build(st)` creates the controls and registers one frame function with `st.loop((dt, time) => …)`.
`dt` is the frame time in seconds and is `0` while the reader has paused: integrate with `dt`,
draw every frame.

Stage (`js/core/stage.js`):

| Member | Use |
|---|---|
| `st.W` (760), `st.H` | canvas size in drawing units |
| `st.D` | drawing helpers (below) |
| `st.C` | live palette |
| `st.t({ de, en })` | pick the language for canvas text |
| `st.num(v, sig)`, `st.fix(v, dec)`, `st.si(v, 'A', sig)` | numbers in the reader's format |
| `st.slider({ label, min, max, step, value, unit, fmt, on })` | returns `{ value, set(v) }` |
| `st.select({ label, options: [{ v, label }], value, on })` | returns `{ value, set(v) }` |
| `st.toggle({ label, value, on })` | checkbox, returns `{ value, set(v) }` |
| `st.button(label, fn, 'primary')` | returns `{ label(v), click() }` |
| `st.readout(html)` | one line under the canvas; `$…$` markup allowed |
| `st.pointer({ down(x, y), move(x, y, held), up(x, y) })` | dragging on the canvas |
| `st.play()` | un-pause (call it in a "start" button) |

Labels may be `{ de, en }` and may contain `$…$`.

Drawing helpers (`js/core/draw.js`, read the JSDoc there):
`clear`, `line`, `poly`, `rect`, `circle`, `arc`, `arrow`, `arcArrow`, `text` (with `U_a` markup),
plots: `map`, `axes`, `curve`, `series`, `dot`, `hline`, `vline`, `legend`,
circuits: `wire`, `node`, `resistor`, `inductor`, `capacitor`, `diode`, `sw`, `source`, `motorSym`,
`meter`, `gnd`, `opamp`, `uArrow`, `flow` (moving dots = current),
mechanics: `spring`, `damper`, `hatch`, `pole`, `barMagnet`, `fieldMarks`, `bar`, `gauge`.
Also exported: `Trace` (scrolling plots), `clamp`, `lerp`, `niceTicks`.

### Layout rules (nobody will see your canvas before review, so be strict)

- The canvas is 760 wide; height 380 to 460. Keep 16 px free at every edge.
- Plan regions with fixed coordinates and write them down in a comment, e.g.
  `// left 20..340: circuit · right 400..740: plot`.
- A plot needs 46 px to its left for tick labels, 34 px below for the axis title and 18 px above
  for the y title. Two stacked plots need 70 px between them.
- Text is at least 12 px. A label never sits on a line, a part or another label: give every label
  its own free spot and check the worst case of every slider.
- Labels with a value change width. Right-align them or leave room for the longest value.
- One axis per plot. Two quantities with different units get two plots.
- Direct labels and a legend for two or more curves. Text is ink-coloured, the mark carries the hue.
- Motion must mean something: dots move with the current, a rotor turns with ω. Scale visual speed
  so it is watchable, and say "slow motion" in the hint when time is stretched.
- Show the live numbers in `st.readout`, with units.
- Nothing may flash faster than three times per second.

## Physics

- Put every formula into a pure function in `js/physics/<topic>.js` (no DOM, no state, SI units,
  JSDoc). The animation and the worked example both use it.
- Shared modules you may import but must not edit: `dcmotor.js` (example motor, operating point,
  `stepMotor`), `lti.js` (Bode, step responses, `simulateTF`), `control.js` (`piStep`).
- Write `tests/<topic>.test.js` with `node:test`. Every number that appears in a text, an example
  or a quiz answer must be asserted there. Cover every exported function.
- The example motor is `EXAMPLE_MOTOR` (R = 5 Ω, L = 0.4 mH, k_e = k_m = 0.024, J = 3·10⁻⁶ kg·m²,
  C_r = 3·10⁻⁶ N·m·s; at 12 V: no-load 487 rad/s and 61 mA, stall 2.4 A and 57.6 mNm,
  τ = 25.4 ms). Use it wherever a motor appears.
- Course symbols: U, i, R, L, k_e, k_m, ω, φ, M_M (motor torque), M_L (load torque), J, C_r.

## Checks before you say "done"

```
CHAPTERS=a05 node --test tests/     # your sheet: content rules + animation smoke test + physics
node --test tests/                  # everything
```

The smoke test builds each animation without a browser, moves every control to both ends, presses
every button and fails on exceptions or on NaN reaching the canvas or the readout.

## Originality

Texts, examples and drawings are written for this site. Do not copy sentences, figures or tasks
from lecture slides, textbooks or old exams. Standard formulas and standard symbols are fine.
