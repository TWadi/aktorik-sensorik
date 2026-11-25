// Router and page rendering. Routes: "#/" (register of sheets) and "#/a04" (one sheet).

import { initTheme, setTheme, getTheme } from './core/theme.js';
import { initLang, setLang, getLang, onLang, tr, UI } from './core/i18n.js';
import { formula as fx } from './core/format.js';
import { renderBlocks } from './core/blocks.js';
import { mountAnim } from './core/stage.js';
import { CHAPTERS, PARTS, sheetNo, findChapter, chapterFile } from './manifest.js';

const REPO_URL = 'https://github.com/TWadi/aktorik-sensorik';
const SEEN_KEY = 'as.seen';
const app = document.getElementById('app');
let mounted = [];
let renderToken = 0;

const el = (tag, cls, html) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (html != null) node.innerHTML = html;
  return node;
};

function readSeen() {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((id) => typeof id === 'string') : [];
  } catch { return []; }
}

function markSeen(id) {
  const seen = readSeen();
  if (seen.includes(id)) return;
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, id])); } catch { /* progress just is not stored */ }
}

function teardown() {
  mounted.forEach((m) => m.destroy());
  mounted = [];
  app.innerHTML = '';
}

function paintChrome() {
  const lang = getLang();
  document.documentElement.lang = lang;
  document.querySelector('.brand-sub').textContent = tr(UI.brandSub);
  document.querySelector('[data-nav="sheets"]').textContent = tr(UI.sheets);
  document.querySelectorAll('[data-lang]').forEach((b) => {
    const on = b.dataset.lang === lang;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  const themeBtn = document.querySelector('[data-act="theme"]');
  themeBtn.setAttribute('aria-label', tr(UI.theme));
  themeBtn.title = tr(UI.theme);
  themeBtn.setAttribute('aria-pressed', String(getTheme() === 'dark'));
  document.querySelector('.foot-note').textContent = tr(UI.footer);
  const src = document.querySelector('.foot-src');
  src.textContent = tr(UI.source);
  src.href = REPO_URL;
}

// ------------------------------------------------------------------ home
function partSection(part, lang, seen) {
  const sec = el('section', 'part');
  sec.appendChild(el('header', 'part-head', `<h2>${tr(part === 'a' ? UI.partA : UI.partS, lang)}</h2><p>${tr(part === 'a' ? UI.partALead : UI.partSLead, lang)}</p>`));
  const ol = el('ol', 'register');
  CHAPTERS.filter((c) => c.part === part).forEach((c) => {
    const li = el('li');
    const done = seen.includes(c.id);
    li.innerHTML = `<a class="reg-row${done ? ' seen' : ''}" href="#/${c.id}">
      <span class="reg-no">${sheetNo(c.id)}</span>
      <span class="reg-main"><span class="reg-title">${tr(c.title, lang)}</span><span class="reg-lead">${tr(c.lead, lang)}</span></span>
      <span class="reg-meta">${done ? `<span class="tick" title="${tr(UI.seen, lang)}" aria-label="${tr(UI.seen, lang)}">✓</span>` : ''}${c.minutes} ${tr(UI.minutes, lang)}</span>
    </a>`;
    ol.appendChild(li);
  });
  sec.appendChild(ol);
  return sec;
}

async function renderHome(token) {
  const lang = getLang();
  document.title = `Aktorik & Sensorik · ${tr(UI.brandSub, lang)}`;
  const hero = el('section', 'hero');
  hero.innerHTML = `
    <p class="kicker">${lang === 'de' ? 'Aktoren · Sensoren · Regelung' : 'Actuators · sensors · control'}</p>
    <h1>${lang === 'de' ? 'Aktorik &amp; Sensorik,<br><em>bewegt erklärt.</em>' : 'Actuators &amp; sensors,<br><em>explained in motion.</em>'}</h1>
    <p class="hero-lead">${lang === 'de'
    ? `Schieb einen Regler. Sieh, was passiert. Dann erst kommt die Formel. ${CHAPTERS.length} Blätter, jedes mit einer Zeichnung, die sich bewegt.`
    : `Move a slider. Watch what happens. Only then comes the formula. ${CHAPTERS.length} sheets, each with a drawing that moves.`}</p>
    <p class="credit"><span>${tr(UI.credit, lang)}</span><span>${tr(UI.basedOn, lang)}</span></p>`;
  app.appendChild(hero);

  const stageSlot = el('div', 'hero-stage');
  app.appendChild(stageSlot);

  const legend = el('section', 'legend');
  legend.innerHTML = `<h2 class="kicker">${tr(UI.legendTitle, lang)}</h2><ul>${
    ['U', 'i', 'w', 'M'].map((k) => `<li><span class="swatch" style="background:var(--c-${k})"></span><b>${fx(k === 'w' ? '$ω$' : `$${k}$`)}</b> ${tr(UI.legend[k], lang)}</li>`).join('')}</ul>`;
  app.appendChild(legend);

  const seen = readSeen();
  PARTS.forEach((part) => app.appendChild(partSection(part, lang, seen)));

  try {
    const mod = await import(chapterFile('a01'));
    if (token !== renderToken) return;
    if (mod.heroAnim) mounted.push(mountAnim(mod.heroAnim, stageSlot, { lang }));
  } catch (err) {
    stageSlot.remove();
    // eslint-disable-next-line no-console
    console.error('[home] hero animation failed to load', err);
  }
}

// ------------------------------------------------------------------ chapter
function pager(index, lang) {
  const nav = el('nav', 'pager');
  nav.setAttribute('aria-label', lang === 'de' ? 'Blattwechsel' : 'Sheet navigation');
  const prev = CHAPTERS[index - 1];
  const next = CHAPTERS[index + 1];
  const link = (c, cls, label) => (c
    ? `<a class="${cls}" href="#/${c.id}"><span class="pg-dir">${label}</span><span class="pg-title">${sheetNo(c.id)} · ${tr(c.title, lang)}</span></a>`
    : `<a class="${cls}" href="#/"><span class="pg-dir">${label}</span><span class="pg-title">${tr(UI.sheets, lang)}</span></a>`);
  nav.innerHTML = link(prev, 'pg prev', `← ${tr(UI.prev, lang)}`) + link(next, 'pg next', `${tr(UI.next, lang)} →`);
  return nav;
}

async function renderChapter(meta, token) {
  const lang = getLang();
  const index = CHAPTERS.indexOf(meta);
  const partCount = CHAPTERS.filter((c) => c.part === meta.part).length;
  const partIndex = CHAPTERS.filter((c) => c.part === meta.part).indexOf(meta) + 1;
  document.title = `${sheetNo(meta.id)} ${tr(meta.title, lang)} · Aktorik & Sensorik`;

  const sheet = el('article', 'sheet');
  sheet.innerHTML = `
    <header class="sheet-head">
      <span class="sheet-no" aria-hidden="true">${sheetNo(meta.id)}</span>
      <div>
        <p class="kicker">${tr(meta.part === 'a' ? UI.partA : UI.partS, lang)} · ${tr(UI.sheet, lang)} ${partIndex}/${partCount}</p>
        <h1>${tr(meta.title, lang)}</h1>
        <p class="sheet-lead">${tr(meta.lead, lang)}</p>
      </div>
    </header>
    <div class="sheet-body"></div>`;
  app.appendChild(sheet);
  const body = sheet.querySelector('.sheet-body');

  let mod;
  try {
    mod = await import(chapterFile(meta.id));
  } catch (err) {
    if (token !== renderToken) return;
    // eslint-disable-next-line no-console
    console.error(`[chapter ${meta.id}]`, err);
    body.appendChild(el('p', 'wip', tr(UI.wip, lang)));
    app.appendChild(pager(index, lang));
    return;
  }
  if (token !== renderToken) return;

  try {
    mounted = renderBlocks(mod.default.blocks, body, lang);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[chapter ${meta.id}]`, err);
    body.appendChild(el('p', 'wip', tr(UI.loadError, lang)));
  }

  const stamp = el('footer', 'stamp');
  stamp.innerHTML = `<dl>
    <div><dt>${tr(UI.sheet, lang)}</dt><dd>${sheetNo(meta.id)}</dd></div>
    <div><dt>${lang === 'de' ? 'Teil' : 'Part'}</dt><dd>${lang === 'de' ? (meta.part === 'a' ? 'Aktorik' : 'Sensorik') : (meta.part === 'a' ? 'Actuators' : 'Sensors')}</dd></div>
    <div><dt>${lang === 'de' ? 'Dauer' : 'Time'}</dt><dd>≈ ${meta.minutes} ${tr(UI.minutes, lang)}</dd></div>
    <div><dt>${lang === 'de' ? 'Animationen' : 'Animations'}</dt><dd>${mounted.length}</dd></div>
  </dl>`;
  sheet.appendChild(stamp);
  app.appendChild(pager(index, lang));
  markSeen(meta.id);
}

// ------------------------------------------------------------------ routing
function route() {
  renderToken += 1;
  const token = renderToken;
  teardown();
  paintChrome();
  const id = location.hash.replace(/^#\/?/, '').toLowerCase();
  const meta = findChapter(id);
  window.scrollTo(0, 0);
  if (meta) renderChapter(meta, token); else renderHome(token);
  app.focus({ preventScroll: true });
}

function init() {
  initTheme();
  initLang();
  document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
  document.querySelector('[data-act="theme"]').addEventListener('click', () => {
    setTheme(getTheme() === 'dark' ? 'light' : 'dark');
    paintChrome();
  });
  onLang(route);
  window.addEventListener('hashchange', route);
  route();
}

init();
