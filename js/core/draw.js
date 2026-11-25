// Drawing toolkit for the animation canvases. `makeDraw(ctx, C, W, H)` returns helpers bound to
// one canvas. Colours come from the live palette `C` (see theme.js), so read them at draw time.

import { runs } from './format.js';

export const FONT = '"Bahnschrift", "DIN Alternate", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", sans-serif';
const TAU = Math.PI * 2;

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, f) => a + (b - a) * f;

/** "Nice" axis ticks between a and b (about n of them). */
export function niceTicks(a, b, n = 5) {
  const span = b - a;
  if (!(span > 0) || !Number.isFinite(span)) return [a];
  const raw = span / Math.max(1, n);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw) || raw;
  const out = [];
  for (let v = Math.ceil(a / step - 1e-9) * step; v <= b + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)));
  return out;
}

/** Fixed-length buffer of points for scrolling time plots. */
export class Trace {
  constructor(max = 600) { this.max = max; this.pts = []; }
  push(x, y) { this.pts.push([x, y]); if (this.pts.length > this.max) this.pts.shift(); }
  clear() { this.pts.length = 0; }
  get last() { return this.pts[this.pts.length - 1]; }
}

export function makeDraw(ctx, C, W, H) {
  const D = {};

  const stroke = (col, lw, dash) => { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.setLineDash(dash || []); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; };

  // ---------------------------------------------------------------- basics
  /** Paper background with a faint millimetre grid. Pass { grid: false } for plain paper. */
  D.clear = (o = {}) => {
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, W, H);
    if (o.grid === false) return;
    ctx.lineWidth = 1;
    for (let pass = 0; pass < 2; pass++) {
      const step = pass ? 50 : 10;
      ctx.strokeStyle = pass ? C.gridBold : C.grid;
      ctx.beginPath();
      for (let x = step; x < W; x += step) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
      for (let y = step; y < H; y += step) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
      ctx.stroke();
    }
  };

  D.line = (x1, y1, x2, y2, col = C.ink, lw = 1.5, dash) => {
    stroke(col, lw, dash);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.setLineDash([]);
  };

  /** Polyline through [[x, y], ...]. Options: close, fill, dash. */
  D.poly = (pts, col = C.ink, lw = 1.5, o = {}) => {
    if (!pts.length) return;
    ctx.beginPath();
    pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    if (o.close) ctx.closePath();
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
    if (col && lw > 0) { stroke(col, lw, o.dash); ctx.stroke(); ctx.setLineDash([]); }
  };

  D.rect = (x, y, w, h, o = {}) => {
    ctx.beginPath();
    if (o.r && ctx.roundRect) ctx.roundRect(x, y, w, h, o.r); else ctx.rect(x, y, w, h);
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
    if (o.stroke) { stroke(o.stroke, o.lw || 1.5, o.dash); ctx.stroke(); ctx.setLineDash([]); }
  };

  D.circle = (x, y, r, o = {}) => {
    ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU);
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
    if (o.stroke) { stroke(o.stroke, o.lw || 1.5, o.dash); ctx.stroke(); ctx.setLineDash([]); }
  };

  D.arc = (x, y, r, a0, a1, col = C.ink, lw = 1.5, ccw = false) => {
    stroke(col, lw);
    ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), a0, a1, ccw); ctx.stroke();
  };

  const head = (x, y, ang, col, size) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - size * Math.cos(ang - 0.42), y - size * Math.sin(ang - 0.42));
    ctx.lineTo(x - size * Math.cos(ang + 0.42), y - size * Math.sin(ang + 0.42));
    ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  };

  /** Straight arrow. Nothing is drawn when it is shorter than 3 px. */
  D.arrow = (x1, y1, x2, y2, col = C.ink, lw = 2) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (!(len >= 3)) return;
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const size = Math.min(7 + lw * 2, len * 0.7);
    D.line(x1, y1, x2 - Math.cos(ang) * size * 0.7, y2 - Math.sin(ang) * size * 0.7, col, lw);
    head(x2, y2, ang, col, size);
  };

  /** Curved arrow on a circle from angle a0 to a1 (radians, canvas direction: clockwise positive). */
  D.arcArrow = (x, y, r, a0, a1, col = C.ink, lw = 2) => {
    if (Math.abs(a1 - a0) < 0.08 || r <= 0) return;
    const ccw = a1 < a0;
    D.arc(x, y, r, a0, a1, col, lw, ccw);
    const tx = x + r * Math.cos(a1), ty = y + r * Math.sin(a1);
    head(tx, ty, a1 + (ccw ? -1 : 1) * Math.PI / 2, col, 7 + lw * 2);
  };

  // ---------------------------------------------------------------- text
  const setFont = (size, o) => { ctx.font = `${o.italic ? 'italic ' : ''}${o.bold ? '700' : '400'} ${size}px ${FONT}`; };

  const measure = (parts, size, o) => parts.reduce((w, r) => {
    setFont(r.sub || r.sup ? size * 0.72 : size, o);
    return w + ctx.measureText(r.t).width;
  }, 0);

  /**
   * Text with sub/superscript markup: "U_a", "k_{e}", "s^2", "10^{-3}".
   * Options: size (13), col, align (left|center|right), base (alphabetic|middle|top), bold, italic,
   * bg (colour of a rounded box behind the text). Returns the text width.
   */
  D.text = (s, x, y, o = {}) => {
    const size = o.size || 13;
    const parts = runs(String(s));
    const width = measure(parts, size, o);
    let px = x - (o.align === 'center' ? width / 2 : o.align === 'right' ? width : 0);
    const base = o.base || 'alphabetic';
    const y0 = base === 'middle' ? y + size * 0.35 : base === 'top' ? y + size * 0.8 : y;
    if (o.bg) D.rect(px - 5, y0 - size * 0.95, width + 10, size * 1.4, { fill: o.bg, r: 4 });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = (o.col && C.tint[o.col]) || o.col || C.ink;
    for (const r of parts) {
      const small = r.sub || r.sup;
      setFont(small ? size * 0.72 : size, o);
      ctx.fillText(r.t, px, y0 + (r.sub ? size * 0.28 : r.sup ? -size * 0.42 : 0));
      px += ctx.measureText(r.t).width;
    }
    return width;
  };

  // ---------------------------------------------------------------- plots
  /**
   * Plot rectangle -> mapping. r = { x, y, w, h, x0, x1, y0, y1 } (pixels, then data ranges).
   * Returns { X(v), Y(v), ix(px), iy(py), ...r }.
   */
  D.map = (r) => ({
    ...r,
    X: (v) => r.x + ((v - r.x0) / (r.x1 - r.x0)) * r.w,
    Y: (v) => r.y + r.h - ((v - r.y0) / (r.y1 - r.y0)) * r.h,
    ix: (px) => r.x0 + ((px - r.x) / r.w) * (r.x1 - r.x0),
    iy: (py) => r.y0 + ((r.y + r.h - py) / r.h) * (r.y1 - r.y0),
  });

  /**
   * Plot frame: opaque panel, grid lines, tick labels, axis titles.
   * o = { xt, yt (tick arrays; omitted -> automatic), xf, yf (tick formatters), xl, yl (axis titles),
   *       zero (draw the y = 0 line, default true) }.
   * Leave about 46 px left of and 34 px below the rectangle for labels.
   */
  D.axes = (m, o = {}) => {
    const xt = o.xt || niceTicks(m.x0, m.x1, 5);
    const yt = o.yt || niceTicks(m.y0, m.y1, 4);
    const xf = o.xf || ((v) => String(v));
    const yf = o.yf || ((v) => String(v));
    D.rect(m.x, m.y, m.w, m.h, { fill: C.panel });
    ctx.lineWidth = 1; ctx.strokeStyle = C.gridBold; ctx.setLineDash([]);
    ctx.beginPath();
    xt.forEach((v) => { const x = Math.round(m.X(v)) + 0.5; ctx.moveTo(x, m.y); ctx.lineTo(x, m.y + m.h); });
    yt.forEach((v) => { const y = Math.round(m.Y(v)) + 0.5; ctx.moveTo(m.x, y); ctx.lineTo(m.x + m.w, y); });
    ctx.stroke();
    D.rect(m.x, m.y, m.w, m.h, { stroke: C.faint, lw: 1 });
    if (o.zero !== false && m.y0 < 0 && m.y1 > 0) D.line(m.x, m.Y(0), m.x + m.w, m.Y(0), C.dim, 1);
    D.line(m.x, m.y, m.x, m.y + m.h, C.ink, 1.5);
    D.line(m.x, m.y + m.h, m.x + m.w, m.y + m.h, C.ink, 1.5);
    xt.forEach((v) => D.text(xf(v), m.X(v), m.y + m.h + 15, { size: 11.5, col: C.dim, align: 'center' }));
    yt.forEach((v) => D.text(yf(v), m.x - 7, m.Y(v), { size: 11.5, col: C.dim, align: 'right', base: 'middle' }));
    if (o.xl) D.text(o.xl, m.x + m.w, m.y + m.h + 31, { size: 12.5, align: 'right', bold: true });
    if (o.yl) D.text(o.yl, m.x, m.y - 8, { size: 12.5, bold: true });
  };

  const clipTo = (m, fn) => {
    ctx.save();
    ctx.beginPath(); ctx.rect(m.x, m.y - 1, m.w + 1, m.h + 2); ctx.clip();
    fn();
    ctx.restore();
  };

  /** y = fn(x) for x in [a, b], clipped to the plot. */
  D.curve = (m, fn, a, b, col = C.ink, lw = 2, dash) => {
    clipTo(m, () => {
      stroke(col, lw, dash);
      ctx.beginPath();
      const n = 200;
      let pen = false;
      for (let k = 0; k <= n; k++) {
        const x = a + ((b - a) * k) / n;
        const y = fn(x);
        if (!Number.isFinite(y)) { pen = false; continue; }
        const px = m.X(x), py = clamp(m.Y(y), m.y - 50, m.y + m.h + 50);
        if (pen) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        pen = true;
      }
      ctx.stroke(); ctx.setLineDash([]);
    });
  };

  /** Line through data points [[x, y], ...] (for example a Trace), clipped to the plot. */
  D.series = (m, pts, col = C.ink, lw = 2, dash) => {
    if (!pts || pts.length < 2) return;
    clipTo(m, () => {
      stroke(col, lw, dash);
      ctx.beginPath();
      pts.forEach(([x, y], k) => {
        const px = m.X(x), py = clamp(m.Y(y), m.y - 50, m.y + m.h + 50);
        if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      });
      ctx.stroke(); ctx.setLineDash([]);
    });
  };

  /** Marker at a data point, with a paper-coloured ring so it stays visible on any line. */
  D.dot = (m, x, y, col = C.ink, r = 5) => {
    const px = m.X(x), py = m.Y(y);
    if (px < m.x - 1 || px > m.x + m.w + 1 || py < m.y - 1 || py > m.y + m.h + 1) return;
    D.circle(px, py, r + 2, { fill: C.panel });
    D.circle(px, py, r, { fill: col });
  };

  /** Horizontal helper line at data value y, optional label at the right end. */
  D.hline = (m, y, col = C.dim, label, dash = [5, 4]) => {
    const py = m.Y(y);
    if (py < m.y || py > m.y + m.h) return;
    D.line(m.x, py, m.x + m.w, py, col, 1.2, dash);
    if (label) D.text(label, m.x + m.w - 4, py - 5, { size: 11.5, col, align: 'right' });
  };

  /** Vertical helper line at data value x, optional label at the top. */
  D.vline = (m, x, col = C.dim, label, dash = [5, 4]) => {
    const px = m.X(x);
    if (px < m.x || px > m.x + m.w) return;
    D.line(px, m.y, px, m.y + m.h, col, 1.2, dash);
    if (label) D.text(label, px + 4, m.y + 13, { size: 11.5, col });
  };

  /** Legend row: [[label, colour], ...] drawn left to right starting at (x, y). */
  D.legend = (items, x, y) => {
    let px = x;
    items.forEach(([label, col]) => {
      D.line(px, y - 4, px + 16, y - 4, col, 3);
      px += 21;
      px += D.text(label, px, y, { size: 12 }) + 14;
    });
  };

  // ---------------------------------------------------------------- circuit symbols
  /** Wire through points [[x, y], ...]. */
  D.wire = (pts, col = C.ink, lw = 2) => D.poly(pts, col, lw);

  D.node = (x, y, col = C.ink) => D.circle(x, y, 3.2, { fill: col });

  // Draws a two-terminal part between two points: leads + a body painted in a rotated frame.
  const twoPin = (x1, y1, x2, y2, bodyLen, paint, o = {}) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const col = o.col || C.ink;
    ctx.save();
    ctx.translate(x1, y1); ctx.rotate(ang);
    const a = (len - bodyLen) / 2;
    D.line(0, 0, a, 0, col, 2); D.line(a + bodyLen, 0, len, 0, col, 2);
    paint(a, bodyLen, col);
    ctx.restore();
    if (o.label) {
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const off = o.labelOff ?? 20;
      const nx = -Math.sin(ang), ny = Math.cos(ang);
      const side = o.side === -1 ? -1 : 1;
      D.text(o.label, mx - nx * off * side, my - ny * off * side, { size: 13, align: 'center', base: 'middle', col: o.labelCol || C.ink, bold: true });
    }
  };

  /** Resistor (IEC box). Options: label, side (1 | -1), col, fill. */
  D.resistor = (x1, y1, x2, y2, o = {}) => twoPin(x1, y1, x2, y2, 44, (a, b, col) => {
    D.rect(a, -9, b, 18, { fill: o.fill || C.panel, stroke: col, lw: 2 });
  }, o);

  /** Inductor (four humps). */
  D.inductor = (x1, y1, x2, y2, o = {}) => twoPin(x1, y1, x2, y2, 48, (a, b, col) => {
    stroke(col, 2);
    ctx.beginPath();
    for (let k = 0; k < 4; k++) ctx.arc(a + 6 + k * 12, 0, 6, Math.PI, 0);
    ctx.stroke();
  }, o);

  /** Capacitor (two plates). */
  D.capacitor = (x1, y1, x2, y2, o = {}) => twoPin(x1, y1, x2, y2, 8, (a, b, col) => {
    D.line(a, -12, a, 12, col, 2.5); D.line(a + b, -12, a + b, 12, col, 2.5);
  }, o);

  /** Diode pointing from (x1, y1) to (x2, y2). */
  D.diode = (x1, y1, x2, y2, o = {}) => twoPin(x1, y1, x2, y2, 16, (a, b, col) => {
    D.poly([[a, -8], [a + b, 0], [a, 8]], col, 2, { close: true, fill: o.fill || C.panel });
    D.line(a + b, -9, a + b, 9, col, 2.5);
  }, o);

  /** Switch between two points. closed = true connects them. */
  D.sw = (x1, y1, x2, y2, closed, o = {}) => twoPin(x1, y1, x2, y2, 30, (a, b, col) => {
    D.circle(a, 0, 3, { fill: col }); D.circle(a + b, 0, 3, { fill: col });
    if (closed) D.line(a, 0, a + b, 0, o.onCol || col, 3);
    else D.line(a, 0, a + b * 0.85, -13, col, 2.5);
  }, o);

  /** Ideal voltage source: circle with the wire running through. Terminals lie on the circle. */
  D.source = (x, y, r = 16, o = {}) => {
    D.circle(x, y, r, { fill: C.panel, stroke: o.col || C.ink, lw: 2 });
    if (o.horizontal) D.line(x - r, y, x + r, y, o.col || C.ink, 2); else D.line(x, y - r, x, y + r, o.col || C.ink, 2);
    if (o.label) D.text(o.label, x - r - 8, y, { size: 13, align: 'right', base: 'middle', bold: true, col: o.labelCol || C.ink });
  };

  /** Motor symbol: circle with "M" and a mark that turns with `angle` (rad). */
  D.motorSym = (x, y, r = 22, angle = 0, o = {}) => {
    D.circle(x, y, r, { fill: C.panel, stroke: o.col || C.ink, lw: 2 });
    D.text(o.letter || 'M', x, y, { size: r * 0.8, align: 'center', base: 'middle', bold: true });
    D.circle(x + (r - 5) * Math.cos(angle), y + (r - 5) * Math.sin(angle), 3, { fill: C.w });
  };

  /** Round meter with a letter ("V", "A"). */
  D.meter = (x, y, r = 15, letter = 'V', o = {}) => {
    D.circle(x, y, r, { fill: C.panel, stroke: o.col || C.ink, lw: 2 });
    D.text(letter, x, y, { size: r, align: 'center', base: 'middle', bold: true, col: o.col || C.ink });
  };

  D.gnd = (x, y, col = C.ink) => {
    D.line(x, y, x, y + 8, col, 2);
    D.line(x - 11, y + 8, x + 11, y + 8, col, 2); D.line(x - 7, y + 12, x + 7, y + 12, col, 2); D.line(x - 3, y + 16, x + 3, y + 16, col, 2);
  };

  /** Op-amp triangle. (x, y) is the tip (output); inputs are at (x - s, y - s/4) "−" and (x - s, y + s/4) "+". */
  D.opamp = (x, y, s = 60, o = {}) => {
    D.poly([[x - s, y - s * 0.55], [x, y], [x - s, y + s * 0.55]], o.col || C.ink, 2, { close: true, fill: C.panel });
    const flip = o.plusTop ? -1 : 1;
    D.text('−', x - s + 7, y - flip * s * 0.25, { size: 14, base: 'middle', bold: true });
    D.text('+', x - s + 7, y + flip * s * 0.25, { size: 14, base: 'middle', bold: true });
  };

  /** Voltage arrow (Zählpfeil) beside a part, with label. */
  D.uArrow = (x1, y1, x2, y2, label, col = C.U, o = {}) => {
    D.arrow(x1, y1, x2, y2, col, 1.6);
    if (!label) return;
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const off = o.off ?? 13;
    D.text(label, (x1 + x2) / 2 + Math.sin(ang) * off, (y1 + y2) / 2 - Math.cos(ang) * off, { size: 13, col, align: 'center', base: 'middle', bold: true });
  };

  /**
   * Moving dots along a polyline: the standard picture for a current.
   * phase: add (current · factor · dt) every frame; negative values run backwards.
   */
  D.flow = (pts, phase, o = {}) => {
    const gap = o.gap || 26, r = o.r || 3.2, col = o.col || C.i;
    const segs = [];
    let total = 0;
    for (let k = 1; k < pts.length; k++) {
      const len = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
      if (len > 0) { segs.push([pts[k - 1], pts[k], len, total]); total += len; }
    }
    if (!segs.length) return;
    const start = ((phase % gap) + gap) % gap;
    ctx.fillStyle = col;
    for (let d = start; d < total; d += gap) {
      const s = segs.find((g) => d <= g[3] + g[2]) || segs[segs.length - 1];
      const f = clamp((d - s[3]) / s[2], 0, 1);
      ctx.beginPath(); ctx.arc(lerp(s[0][0], s[1][0], f), lerp(s[0][1], s[1][1], f), r, 0, TAU); ctx.fill();
    }
  };

  // ---------------------------------------------------------------- mechanics and physics props
  /** Zig-zag spring between two points. */
  D.spring = (x1, y1, x2, y2, o = {}) => {
    const n = o.coils || 8, amp = o.amp || 9, lead = o.lead ?? 10;
    const len = Math.hypot(x2 - x1, y2 - y1);
    const ang = Math.atan2(y2 - y1, x2 - x1);
    ctx.save(); ctx.translate(x1, y1); ctx.rotate(ang);
    const pts = [[0, 0], [lead, 0]];
    const body = Math.max(0, len - 2 * lead);
    for (let k = 0; k < n * 2; k++) pts.push([lead + (body * (k + 0.5)) / (n * 2), k % 2 ? amp : -amp]);
    pts.push([len - lead, 0], [len, 0]);
    D.poly(pts, o.col || C.ink, o.lw || 2);
    ctx.restore();
  };

  /** Dashpot between two points. */
  D.damper = (x1, y1, x2, y2, o = {}) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const col = o.col || C.ink, w = o.w || 10, pot = Math.min(34, len * 0.5);
    ctx.save(); ctx.translate(x1, y1); ctx.rotate(ang);
    const a = clamp(len * 0.5, pot * 0.4, len - 6);
    D.line(0, 0, a - pot / 2, 0, col, 2);
    D.poly([[a + pot / 2, -w], [a - pot / 2, -w], [a - pot / 2, w], [a + pot / 2, w]], col, 2);
    D.line(a, -w + 3, a, w - 3, col, 3);
    D.line(a, 0, len, 0, col, 2);
    ctx.restore();
  };

  /** Hatching for a fixed wall (as in a technical drawing). side: which side is solid ('l' | 'r' | 't' | 'b'). */
  D.hatch = (x, y, w, h, o = {}) => {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    stroke(o.col || C.dim, 1);
    ctx.beginPath();
    for (let d = -h; d < w + h; d += 7) { ctx.moveTo(x + d, y + h); ctx.lineTo(x + d + h, y); }
    ctx.stroke();
    ctx.restore();
  };

  /** Magnet pole block with its letter. pole: 'N' | 'S'. */
  D.pole = (x, y, w, h, pole, o = {}) => {
    D.rect(x, y, w, h, { fill: pole === 'N' ? C.N : C.S, stroke: C.ink, lw: 1.5, r: o.r || 0 });
    D.text(pole, x + w / 2, y + h / 2, { size: o.size || Math.min(22, Math.min(w, h) * 0.6), align: 'center', base: 'middle', bold: true, col: C.white });
  };

  /** Bar magnet centred at (cx, cy), rotated by angle. The N half points along +x before rotation. */
  D.barMagnet = (cx, cy, w, h, angle = 0) => {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle);
    D.rect(0, -h / 2, w / 2, h, { fill: C.N, stroke: C.ink, lw: 1.5 });
    D.rect(-w / 2, -h / 2, w / 2, h, { fill: C.S, stroke: C.ink, lw: 1.5 });
    ctx.restore();
    const dx = Math.cos(angle) * w / 4, dy = Math.sin(angle) * w / 4;
    D.text('N', cx + dx, cy + dy, { size: Math.min(18, h * 0.6), align: 'center', base: 'middle', bold: true, col: C.white });
    D.text('S', cx - dx, cy - dy, { size: Math.min(18, h * 0.6), align: 'center', base: 'middle', bold: true, col: C.white });
  };

  /** Field direction marks: dots (out of the page) or crosses (into the page) on a grid inside a rectangle. */
  D.fieldMarks = (x, y, w, h, into = true, o = {}) => {
    const step = o.step || 36, col = o.col || C.faint;
    for (let px = x + step / 2; px < x + w; px += step) {
      for (let py = y + step / 2; py < y + h; py += step) {
        if (into) { D.line(px - 4, py - 4, px + 4, py + 4, col, 1.3); D.line(px - 4, py + 4, px + 4, py - 4, col, 1.3); }
        else { D.circle(px, py, 5, { stroke: col, lw: 1.2 }); D.circle(px, py, 1.6, { fill: col }); }
      }
    }
  };

  /** Horizontal value bar. frac in [-1, 1] (negative grows to the left of the centre when o.signed). */
  D.bar = (x, y, w, h, frac, col, o = {}) => {
    D.rect(x, y, w, h, { fill: C.shade, r: 3 });
    const f = clamp(frac, o.signed ? -1 : 0, 1);
    if (o.signed) D.rect(x + w / 2 + Math.min(0, f) * w / 2, y, Math.abs(f) * w / 2, h, { fill: col, r: 3 });
    else D.rect(x, y, f * w, h, { fill: col, r: 3 });
    if (o.signed) D.line(x + w / 2, y - 2, x + w / 2, y + h + 2, C.dim, 1);
    if (o.label) D.text(o.label, x, y - 6, { size: 12, col: C.dim });
    if (o.value) D.text(o.value, x + w, y - 6, { size: 12.5, align: 'right', bold: true });
  };

  /** Needle instrument. frac in [0, 1] (or [-1, 1] with o.signed) sweeps the scale. */
  D.gauge = (cx, cy, r, frac, o = {}) => {
    const a0 = Math.PI * 1.15, a1 = Math.PI * 1.85;
    const f = o.signed ? (clamp(frac, -1, 1) + 1) / 2 : clamp(frac, 0, 1);
    D.rect(cx - r - 8, cy - r - 10, 2 * r + 16, r + 34, { fill: C.panel, stroke: C.ink, lw: 1.5, r: 6 });
    D.arc(cx, cy, r, a0, a1, C.dim, 1.5);
    for (let k = 0; k <= 10; k++) {
      const a = lerp(a0, a1, k / 10), len = k % 5 ? 4 : 8;
      D.line(cx + (r - len) * Math.cos(a), cy + (r - len) * Math.sin(a), cx + r * Math.cos(a), cy + r * Math.sin(a), C.dim, 1.2);
    }
    const an = lerp(a0, a1, f);
    D.line(cx, cy, cx + (r - 3) * Math.cos(an), cy + (r - 3) * Math.sin(an), o.col || C.bad, 2.2);
    D.circle(cx, cy, 3.5, { fill: C.ink });
    if (o.label) D.text(o.label, cx, cy + 17, { size: 12.5, align: 'center', bold: true });
  };

  return D;
}
