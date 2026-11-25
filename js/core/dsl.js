// Building blocks of a chapter. Each helper returns a plain object; blocks.js turns it into HTML.
// Every text is a { de, en } pair. Lists are { de: [...], en: [...] }.
// Formula markup inside $...$: x_a, x_{ab}, x^2, [[numerator|denominator]].

/** Section heading. */
export const h = (text) => ({ type: 'h', text });

/** One short paragraph (two or three short sentences). */
export const p = (text) => ({ type: 'p', text });

/** An animation (object with id, title, hint, height, build). */
export const anim = (def) => ({ type: 'anim', def });

/** One key formula, large. `where` lists the symbols: { de: [['U', 'Spannung in V'], ...], en: [...] }. */
export const formula = (f, where) => ({ type: 'formula', f, where });

/** "Try it" prompts that send the reader back to the animation above. */
export const tryIt = (items) => ({ type: 'try', items });

/** "Remember" box: the two or three things to keep. */
export const note = (items) => ({ type: 'note', items });

/** Numbered recipe steps. */
export const steps = (items) => ({ type: 'steps', items });

/** Worked example: { title, given: {de: [...], en: [...]}, steps: {de: [...], en: [...]}, result }. */
export const example = (o) => ({ type: 'example', ...o });

/**
 * Quick check. Questions are either multiple choice
 *   { q, options: { de: [...], en: [...] }, correct: 1, why }
 * or numeric
 *   { q, answer: 0.48, unit: 'A', decimals: 2, tol: 0.02, why }
 *     (unit: string or { de, en }; decimals: digits shown in the solution; tol: allowed relative error)
 */
export const quiz = (questions) => ({ type: 'quiz', questions });

/** Small table: { head: { de: [...], en: [...] }, rows: [[cell, cell, ...], ...] } (cells: string or {de, en}). */
export const table = (o) => ({ type: 'table', ...o });
