// Renders chapter blocks (see dsl.js) into DOM nodes.

import { tr, UI } from './i18n.js';
import { formula as fx, fix } from './format.js';
import { mountAnim } from './stage.js';

const el = (tag, cls, html) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (html != null) node.innerHTML = html;
  return node;
};

const list = (v, lang) => {
  const items = tr(v, lang);
  return Array.isArray(items) ? items : [items];
};

/** Parse "0,48" or "0.48" (also "4,8e-3"). Returns NaN when it is not a number. */
export function parseNumber(text) {
  const s = String(text).trim().replace(/\s/g, '').replace(',', '.').replace('−', '-');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
  return Number(s);
}

/** True when `value` is within the relative tolerance of `answer`. */
export function isClose(value, answer, tol = 0.02) {
  if (!Number.isFinite(value)) return false;
  return Math.abs(value - answer) <= Math.max(Math.abs(answer) * tol, 1e-12);
}

function renderQuiz(block, lang) {
  const t = (v) => fx(tr(v, lang));
  const box = el('section', 'quiz');
  box.appendChild(el('h3', 'kicker', tr(UI.quiz, lang)));
  block.questions.forEach((q, n) => {
    const item = el('div', 'quiz-q');
    item.appendChild(el('p', 'quiz-text', `<span class="quiz-n">${n + 1}</span>${t(q.q)}`));
    const verdict = el('p', 'quiz-verdict');
    verdict.setAttribute('aria-live', 'polite');
    const show = (ok, extra = '') => {
      verdict.className = `quiz-verdict ${ok ? 'ok' : 'no'}`;
      verdict.innerHTML = `<b>${tr(ok ? UI.right : UI.wrong, lang)}</b> ${extra}${q.why ? ` ${t(q.why)}` : ''}`;
    };
    if (Array.isArray(tr(q.options, lang)) && q.options) {
      const row = el('div', 'quiz-opts');
      tr(q.options, lang).forEach((opt, k) => {
        const b = el('button', 'opt', fx(opt));
        b.type = 'button';
        b.addEventListener('click', () => {
          const ok = k === q.correct;
          [...row.children].forEach((c) => c.classList.remove('picked-ok', 'picked-no'));
          b.classList.add(ok ? 'picked-ok' : 'picked-no');
          if (ok) show(true); else { verdict.className = 'quiz-verdict no'; verdict.innerHTML = `<b>${tr(UI.wrong, lang)}</b>`; }
        });
        row.appendChild(b);
      });
      item.appendChild(row);
    } else {
      const row = el('form', 'quiz-num');
      row.innerHTML = `<input type="text" inputmode="decimal" autocomplete="off" aria-label="${tr(UI.yourAnswer, lang)}" placeholder="${tr(UI.yourAnswer, lang)}">
        <span class="unit">${tr(q.unit, lang)}</span><button type="submit" class="btn sm">${tr(UI.check, lang)}</button>`;
      row.addEventListener('submit', (e) => {
        e.preventDefault();
        const v = parseNumber(row.querySelector('input').value);
        if (Number.isNaN(v)) { verdict.className = 'quiz-verdict no'; verdict.textContent = tr(UI.needNumber, lang); return; }
        const ok = isClose(v, q.answer, q.tol ?? 0.02);
        const shown = `${tr(UI.answer, lang)}: ${fix(q.answer, q.decimals ?? 2, lang)}${q.unit ? ` ${tr(q.unit, lang)}` : ''}.`;
        show(ok, shown);
      });
      item.appendChild(row);
    }
    item.appendChild(verdict);
    box.appendChild(item);
  });
  return box;
}

/**
 * Render all blocks of a chapter into `host`.
 * @returns {Array<{destroy: () => void}>} mounted animations (destroy them on navigation)
 */
export function renderBlocks(blocks, host, lang) {
  const t = (v) => fx(tr(v, lang));
  const mounted = [];
  for (const b of blocks) {
    switch (b.type) {
      case 'h': host.appendChild(el('h2', '', t(b.text))); break;
      case 'p': host.appendChild(el('p', 'para', t(b.text))); break;
      case 'anim': {
        const slot = el('div', 'anim-slot');
        host.appendChild(slot);
        mounted.push(mountAnim(b.def, slot, { lang }));
        break;
      }
      case 'formula': {
        const box = el('div', 'formula');
        box.appendChild(el('div', 'formula-main', t(b.f)));
        if (b.where) {
          const dl = el('dl', 'formula-where');
          list(b.where, lang).forEach(([sym, text]) => {
            dl.appendChild(el('dt', '', fx(`$${sym}$`)));
            dl.appendChild(el('dd', '', fx(text)));
          });
          box.appendChild(dl);
        }
        host.appendChild(box);
        break;
      }
      case 'try': {
        const box = el('aside', 'try');
        box.appendChild(el('h3', 'kicker', tr(UI.tryIt, lang)));
        const ol = el('ol');
        list(b.items, lang).forEach((item) => ol.appendChild(el('li', '', fx(item))));
        box.appendChild(ol);
        host.appendChild(box);
        break;
      }
      case 'note': {
        const box = el('aside', 'note');
        box.appendChild(el('h3', 'kicker', tr(UI.remember, lang)));
        const ul = el('ul');
        list(b.items, lang).forEach((item) => ul.appendChild(el('li', '', fx(item))));
        box.appendChild(ul);
        host.appendChild(box);
        break;
      }
      case 'steps': {
        const ol = el('ol', 'steps');
        list(b.items, lang).forEach((item) => ol.appendChild(el('li', '', fx(item))));
        host.appendChild(ol);
        break;
      }
      case 'example': {
        const box = el('section', 'example');
        box.appendChild(el('h3', 'kicker', `${tr(UI.example, lang)}${b.title ? ` · ${t(b.title)}` : ''}`));
        if (b.given) {
          box.appendChild(el('p', 'ex-label', tr(UI.given, lang)));
          const ul = el('ul', 'ex-given');
          list(b.given, lang).forEach((item) => ul.appendChild(el('li', '', fx(item))));
          box.appendChild(ul);
        }
        if (b.steps) {
          const ol = el('ol', 'ex-steps');
          list(b.steps, lang).forEach((item) => ol.appendChild(el('li', '', fx(item))));
          box.appendChild(ol);
        }
        if (b.result) box.appendChild(el('p', 'ex-result', `<span>${tr(UI.result, lang)}</span> ${t(b.result)}`));
        host.appendChild(box);
        break;
      }
      case 'table': {
        const wrap = el('div', 'table-wrap');
        const head = b.head ? `<thead><tr>${list(b.head, lang).map((c) => `<th>${fx(c)}</th>`).join('')}</tr></thead>` : '';
        const rows = b.rows.map((r) => `<tr>${r.map((c) => `<td>${t(c)}</td>`).join('')}</tr>`).join('');
        wrap.innerHTML = `<table>${head}<tbody>${rows}</tbody></table>`;
        host.appendChild(wrap);
        break;
      }
      case 'quiz': host.appendChild(renderQuiz(b, lang)); break;
      default: throw new Error(`Unknown block type: ${b.type}`);
    }
  }
  return mounted;
}
