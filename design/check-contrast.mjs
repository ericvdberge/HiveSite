// Checks that every theme has the same keys and that every color pair meets WCAG AA.
// Usage: node design/check-contrast.mjs design/tokens.json
import { readFileSync } from 'node:fs';
const tokens = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const parse = (c) => {
  let m = c.match(/^#([0-9a-f]{6})$/i);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat(1);
  m = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  throw new Error('bad color ' + c);
};
const over = (fg, bg) => { const a = fg[3]; return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)).concat(1); };
const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, p + k + '.') : [p + k]));
const names = Object.keys(tokens.themes);
const ref = keys(tokens.themes[names[0]]).sort().join('\n');
let fail = 0;
for (const n of names) {
  if (keys(tokens.themes[n]).sort().join('\n') !== ref) { console.log(`KEYS DIFFER: ${n}`); fail++; }
}
const pairs = [
  ['text', 'background', 4.5], ['text', 'surface', 4.5], ['text', 'surface_sunk', 4.5],
  ['text_muted', 'background', 4.5], ['text_muted', 'surface', 4.5], ['text_muted', 'surface_sunk', 4.5], ['text_muted', 'placeholder_media', 4.5],
  ['accent_text', 'background', 4.5], ['accent_text', 'surface', 4.5],
  ['on_accent', 'accent', 4.5],
  ['error', 'background', 4.5], ['error', 'surface', 4.5], ['error', 'surface_sunk', 4.5],
  ['on_image', 'image_scrim@white', 4.5], ['on_image', 'image_scrim@black', 4.5],
  ['border_strong', 'background', 3], ['border_strong', 'surface', 3], ['border_strong', 'surface_sunk', 3],
  ['focus', 'background', 3], ['focus', 'surface', 3], ['focus', 'surface_sunk', 3],
];
for (const n of names) {
  const c = tokens.themes[n].color;
  console.log(`\n## ${n}`);
  for (const [f, b, min] of pairs) {
    let bg;
    if (b.startsWith('image_scrim@')) bg = over(parse(c.image_scrim), b.endsWith('white') ? [255, 255, 255, 1] : [0, 0, 0, 1]);
    else bg = parse(c[b]);
    const r = ratio(parse(c[f]), bg);
    const ok = r >= min;
    if (!ok) fail++;
    const bgLabel = b.includes('@') ? `${c.image_scrim} over ${b.split('@')[1]}` : c[b];
    console.log(`| ${n} | \`${f}\` on \`${b.replace('@', ' over ')}\` | ${c[f]} on ${bgLabel} | ${r.toFixed(2)}:1 | ${min}:1 | ${ok ? 'pass' : 'FAIL'} |`);
  }
}
console.log(fail ? `\n${fail} failures` : '\nall pass');
process.exit(fail ? 1 : 0);
