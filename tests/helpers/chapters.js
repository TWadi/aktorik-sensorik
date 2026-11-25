// Loads every chapter file that exists and lists its animations.

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CHAPTERS } from '../../js/manifest.js';

/** @returns {Promise<Array<{meta: object, mod: object, chapter: object}>>} */
export async function loadChapters(only = process.env.CHAPTERS) {
  const wanted = only ? only.split(',').map((s) => s.trim().toLowerCase()) : null;
  const out = [];
  for (const meta of CHAPTERS) {
    if (wanted && !wanted.includes(meta.id)) continue;
    const url = new URL(`../../js/chapters/${meta.id}.js`, import.meta.url);
    if (!existsSync(fileURLToPath(url))) continue;
    const mod = await import(url.href);
    out.push({ meta, mod, chapter: mod.default });
  }
  return out;
}

export const animsOf = (chapter) => chapter.blocks.filter((b) => b.type === 'anim').map((b) => b.def);
