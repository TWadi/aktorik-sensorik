// Number formatting (German comma / English point) and the small formula markup.

const SUP = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const PREFIXES = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];

const sep = (s, lang) => (lang === 'en' ? s : s.replace('.', ','));
const minus = (s) => s.replace('-', '−');

/** Round to `sig` significant digits and drop trailing zeros. */
function sig(v, digits) {
  if (v === 0) return '0';
  const s = Number(v.toPrecision(digits));
  const a = Math.abs(s);
  const decimals = Math.max(0, digits - 1 - Math.floor(Math.log10(a)));
  return s.toFixed(Math.min(decimals, 10)).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

/**
 * Plain number with `digits` significant digits, e.g. num(0.02345, 3, 'de') -> "0,0235".
 * Very large / very small values use ·10ⁿ (unicode superscripts, safe for canvas and HTML).
 */
export function num(v, digits = 3, lang = 'de') {
  if (!Number.isFinite(v)) return '–';
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e6 || a < 1e-3)) {
    const e = Math.floor(Math.log10(a));
    const m = sig(v / 10 ** e, digits);
    const exp = String(e).split('').map((ch) => SUP[ch]).join('');
    return `${minus(sep(m, lang))}·10${exp}`;
  }
  return minus(sep(sig(v, digits), lang));
}

/** Fixed decimals, e.g. fix(3.14159, 2, 'de') -> "3,14". */
export function fix(v, decimals = 1, lang = 'de') {
  if (!Number.isFinite(v)) return '–';
  const r = v.toFixed(decimals);
  return minus(sep(Number(r) === 0 ? (0).toFixed(decimals) : r, lang));
}

/** Value with SI prefix and unit, e.g. si(0.0125, 'A') -> "12,5 mA". */
export function si(v, unit, digits = 3, lang = 'de') {
  if (!Number.isFinite(v)) return '–';
  if (v === 0) return `0 ${unit}`;
  const a = Math.abs(v);
  const [f, p] = PREFIXES.find(([k]) => a >= k * 0.9995) || PREFIXES[PREFIXES.length - 1];
  return `${minus(sep(sig(v / f, digits), lang))} ${p}${unit}`;
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Split "a_{bc}" style markup into runs: [{ t, sub, sup }]. Shared by HTML and canvas text. */
export function runs(str) {
  const out = [];
  let i = 0, buf = '';
  const flush = () => { if (buf) { out.push({ t: buf }); buf = ''; } };
  while (i < str.length) {
    const ch = str[i];
    if ((ch === '_' || ch === '^') && i + 1 < str.length) {
      flush();
      let body;
      if (str[i + 1] === '{') {
        const end = str.indexOf('}', i + 2);
        body = str.slice(i + 2, end < 0 ? str.length : end);
        i = end < 0 ? str.length : end + 1;
      } else {
        body = str[i + 1];
        i += 2;
      }
      out.push(ch === '_' ? { t: body, sub: true } : { t: body, sup: true });
    } else {
      buf += ch;
      i += 1;
    }
  }
  flush();
  return out;
}

function mathInner(src) {
  // fractions [[a|b]] first (they may contain sub/sup markup, but not other fractions)
  const parts = src.split(/(\[\[[^\]]*?\|[^\]]*?\]\])/g);
  return parts.map((part) => {
    const m = /^\[\[([^\]]*?)\|([^\]]*?)\]\]$/.exec(part);
    if (m) return `<span class="frac"><span>${mathRuns(m[1])}</span><span>${mathRuns(m[2])}</span></span>`;
    return mathRuns(part);
  }).join('');
}

function mathRuns(src) {
  return runs(src).map((r) => {
    const body = italics(esc(r.t));
    if (r.sub) return `<sub>${body}</sub>`;
    if (r.sup) return `<sup>${body}</sup>`;
    return body;
  }).join('');
}

// single latin letters are variables (italic); words like sin, max, dt stay upright
const italics = (s) => s.replace(/(^|[^A-Za-z&;])([A-Za-z])(?![A-Za-z;])/g, '$1<i>$2</i>');

/**
 * Formula markup -> HTML. Text outside $...$ is passed through unchanged (it may contain HTML).
 * Inside $...$: x_a, x_{ab}, x^2, x^{-1}, [[numerator|denominator]].
 */
export function formula(str) {
  if (str == null) return '';
  return String(str).replace(/\$([^$]+)\$/g, (_, body) => `<span class="math">${mathInner(body)}</span>`);
}
