// Theme: one live palette object `C` that every animation reads at draw time.
// Light = drafting paper, dark = blueprint. Entity colours are fixed across the site:
// voltage blue, current orange, speed green, torque/force violet.

const LIGHT = Object.freeze({
  paper: '#f6f3ec', panel: '#fcfaf5', ink: '#17212e', dim: '#56616f', faint: '#a9b0b8',
  grid: 'rgba(42,84,140,0.07)', gridBold: 'rgba(42,84,140,0.14)',
  U: '#2a78d6', i: '#d9541e', w: '#0f9667', M: '#7541aa',
  N: '#cf6a5c', S: '#6fae8a', cu: '#b87333', fe: '#8c96a3', pcb: '#dfe6da',
  ok: '#0f9667', warn: '#b7791f', bad: '#c2372f',
  hi: 'rgba(255,205,60,0.38)', shade: 'rgba(23,33,46,0.08)', white: '#ffffff',
  tint: Object.freeze({}), // text colour per mark colour (only needed on dark)
});

const DARK = Object.freeze({
  paper: '#132c4d', panel: '#0f2542', ink: '#e9f1fb', dim: '#b4c6dc', faint: '#5f7da3',
  grid: 'rgba(190,215,245,0.06)', gridBold: 'rgba(190,215,245,0.12)',
  U: '#4c93ec', i: '#e2652e', w: '#1fae7c', M: '#8155e7',
  N: '#c9675b', S: '#5e9e7c', cu: '#d08a4a', fe: '#8fa3bd', pcb: '#1d3d63',
  ok: '#1fae7c', warn: '#e0a640', bad: '#f0766d',
  hi: 'rgba(255,214,90,0.26)', shade: 'rgba(233,241,251,0.09)', white: '#ffffff',
  // lighter steps for TEXT in an entity colour: the mark colours are too dark for small letters
  tint: Object.freeze({ '#4c93ec': '#7fb4f7', '#e2652e': '#f59468', '#1fae7c': '#4fd3a3', '#8155e7': '#b99cff' }),
});

const KEY = 'as.theme';
const listeners = new Set();

/** Live palette. Never cache its values across frames: read `C.ink` when you draw. */
export const C = { ...LIGHT };

let current = 'light';

export const getTheme = () => current;

export function applyTheme(name) {
  current = name === 'dark' ? 'dark' : 'light';
  Object.assign(C, current === 'dark' ? DARK : LIGHT);
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = current;
  listeners.forEach((fn) => fn(current));
}

export function setTheme(name) {
  applyTheme(name);
  try { localStorage.setItem(KEY, current); } catch { /* private mode: the choice just does not persist */ }
}

export function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { /* no storage */ }
  const prefersDark = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
}

export const onTheme = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export const PALETTES = { light: LIGHT, dark: DARK };
