// Language state (German / English). Every text in the site is a { de, en } pair.

const KEY = 'as.lang';
const LANGS = ['de', 'en'];
const listeners = new Set();
let lang = 'de';

export const getLang = () => lang;

export function initLang() {
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { /* no storage */ }
  const fromUrl = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('lang') : null;
  const nav = typeof navigator !== 'undefined' && navigator.language ? navigator.language.slice(0, 2) : 'de';
  const pick = [fromUrl, saved, nav].find((l) => LANGS.includes(l));
  lang = pick || 'de';
  return lang;
}

export function setLang(next) {
  if (!LANGS.includes(next) || next === lang) return;
  lang = next;
  try { localStorage.setItem(KEY, lang); } catch { /* choice does not persist */ }
  listeners.forEach((fn) => fn(lang));
}

export const onLang = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

/** Pick the current language out of a { de, en } pair. Plain strings pass through. */
export function tr(v, l = lang) {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v;
  return v[l] ?? v.de ?? v.en ?? '';
}

export const UI = {
  brandSub: { de: 'bewegt erklärt', en: 'explained in motion' },
  sheets: { de: 'Alle Blätter', en: 'All sheets' },
  sheet: { de: 'Blatt', en: 'Sheet' },
  partA: { de: 'Teil A · Aktorik', en: 'Part A · Actuators' },
  partS: { de: 'Teil S · Sensorik', en: 'Part S · Sensors' },
  partALead: { de: 'Strom wird Bewegung.', en: 'Current becomes motion.' },
  partSLead: { de: 'Die Welt wird Spannung.', en: 'The world becomes a voltage.' },
  prev: { de: 'Zurück', en: 'Back' },
  next: { de: 'Weiter', en: 'Next' },
  minutes: { de: 'min', en: 'min' },
  animations: { de: 'Animationen', en: 'animations' },
  animation: { de: 'Animation', en: 'Animation' },
  play: { de: 'Abspielen', en: 'Play' },
  pause: { de: 'Anhalten', en: 'Pause' },
  reset: { de: 'Zurücksetzen', en: 'Reset' },
  tryIt: { de: 'Probier es aus', en: 'Try it' },
  remember: { de: 'Merke', en: 'Remember' },
  example: { de: 'Rechenbeispiel', en: 'Worked example' },
  given: { de: 'Gegeben', en: 'Given' },
  result: { de: 'Ergebnis', en: 'Result' },
  quiz: { de: 'Kurz geprüft', en: 'Quick check' },
  check: { de: 'Prüfen', en: 'Check' },
  right: { de: 'Richtig.', en: 'Correct.' },
  wrong: { de: 'Noch nicht.', en: 'Not yet.' },
  answer: { de: 'Antwort', en: 'Answer' },
  yourAnswer: { de: 'Deine Zahl', en: 'Your number' },
  needNumber: { de: 'Bitte eine Zahl eingeben.', en: 'Please type a number.' },
  wip: { de: 'Dieses Blatt wird gerade gezeichnet.', en: 'This sheet is still being drawn.' },
  loadError: { de: 'Das Blatt konnte nicht geladen werden.', en: 'This sheet could not be loaded.' },
  animError: { de: 'Diese Animation konnte nicht starten.', en: 'This animation could not start.' },
  seen: { de: 'angesehen', en: 'visited' },
  theme: { de: 'Hell / Blaupause', en: 'Light / blueprint' },
  scrollHint: { de: 'Zeichnung seitlich verschieben', en: 'Swipe the drawing sideways' },
  legendTitle: { de: 'Farbcode auf allen Blättern', en: 'Colour code on every sheet' },
  legend: {
    U: { de: 'Spannung', en: 'voltage' }, i: { de: 'Strom', en: 'current' },
    w: { de: 'Drehzahl, Bewegung', en: 'speed, motion' }, M: { de: 'Moment, Kraft', en: 'torque, force' },
  },
  footer: {
    de: 'Eigene Texte und Zeichnungen. Kein offizielles Kursmaterial. Ohne Gewähr.',
    en: 'Original texts and drawings. Not official course material. No warranty.',
  },
  credit: { de: 'Gestaltet und entwickelt von <b>Wadi Touil</b>', en: 'Designed and developed by <b>Wadi Touil</b>' },
  basedOn: { de: 'Basiert auf Vorlesung und Folien von Prof. Dr.-Ing. Francisco Morales Serrano', en: 'Based on the lecture and slides by Prof. Dr.-Ing. Francisco Morales Serrano' },
  source: { de: 'Quelltext auf GitHub', en: 'Source on GitHub' },
};
