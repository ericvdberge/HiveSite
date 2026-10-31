// Checks the brand files in design/brand. No dependencies.
// Usage: node design/brand/check-brand.mjs [dir]
//   dir defaults to this file's folder. Exit 0 when every check passes, 1 otherwise.
//   Failing fixture: node design/brand/check-brand.mjs design/brand/fixtures/failing   (must exit 1)
//
// Checks:
//   AC1  the required files are present
//   AC2  every .svg is well-formed XML, has a viewBox and a <title>, and uses only brand hex values
//   AC5  no external references (scripts, styles, images, fonts, imports, links) in any .svg or .html
//   AC9  every .html exposes a DURATIONS table and no step in it is under 300 ms;
//        no CSS transition or animation in any .html is under 300 ms
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dir = resolve(process.argv[2] ?? here);

const REQUIRED = ['logo-mark.svg', 'lockup-dark.svg', 'lockup-light.svg', 'intro.html', 'loader.html', 'check-brand.mjs', 'README.md'];
const BRAND = new Set(['#100E0B', '#17140F', '#CDAE74', '#94733A', '#F5F1E8', '#A69D8C']);
const MIN_MS = 300;

const failures = [];
const passes = [];
const fail = (file, msg) => failures.push(`FAIL ${file}: ${msg}`);
const pass = (file, msg) => passes.push(`ok   ${file}: ${msg}`);

// ---------- minimal XML well-formedness check ----------
function checkXml(src) {
  const stack = [];
  let i = 0, roots = 0, rootName = null, rootAttrs = null;
  const err = (m) => { const line = src.slice(0, i).split('\n').length; return `${m} (line ${line})`; };
  const entity = /^&(?:amp|lt|gt|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);/;
  const name = /^[A-Za-z_:][-A-Za-z0-9_:.]*/;
  const text = (s) => {
    for (let k = 0; k < s.length; k++) if (s[k] === '&' && !entity.test(s.slice(k))) return 'bad or unescaped &';
    return null;
  };
  while (i < src.length) {
    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i + 4);
      if (end < 0) return err('unclosed comment');
      if (src.slice(i + 4, end).includes('--')) return err('"--" inside comment');
      i = end + 3; continue;
    }
    if (src.startsWith('<![CDATA[', i)) {
      if (!stack.length) return err('CDATA outside the root element');
      const end = src.indexOf(']]>', i);
      if (end < 0) return err('unclosed CDATA');
      i = end + 3; continue;
    }
    if (src.startsWith('<?', i)) {
      const end = src.indexOf('?>', i);
      if (end < 0) return err('unclosed processing instruction');
      i = end + 2; continue;
    }
    if (src.startsWith('<!DOCTYPE', i)) {
      const end = src.indexOf('>', i);
      if (end < 0) return err('unclosed doctype');
      i = end + 1; continue;
    }
    if (src[i] === '<') {
      if (src[i + 1] === '/') {
        const m = src.slice(i + 2).match(name);
        if (!m) return err('bad end tag');
        const close = src.indexOf('>', i);
        if (close < 0 || src.slice(i + 2 + m[0].length, close).trim()) return err('bad end tag');
        const open = stack.pop();
        if (open !== m[0]) return err(`</${m[0]}> closes <${open ?? 'nothing'}>`);
        i = close + 1; continue;
      }
      const m = src.slice(i + 1).match(name);
      if (!m) return err('bad start tag');
      if (!stack.length) { roots++; if (roots > 1) return err('more than one root element'); rootName = m[0]; }
      i += 1 + m[0].length;
      const attrs = {};
      for (;;) {
        const ws = src.slice(i).match(/^\s*/)[0]; i += ws.length;
        if (src.startsWith('/>', i)) { i += 2; break; }
        if (src[i] === '>') { i += 1; stack.push(m[0]); break; }
        if (!ws) return err(`expected space or end of tag in <${m[0]}>`);
        const a = src.slice(i).match(name);
        if (!a) return err(`bad attribute in <${m[0]}>`);
        i += a[0].length;
        const eq = src.slice(i).match(/^\s*=\s*(["'])/);
        if (!eq) return err(`attribute ${a[0]} has no quoted value`);
        i += eq[0].length;
        const end = src.indexOf(eq[1], i);
        if (end < 0) return err(`unclosed value for ${a[0]}`);
        const v = src.slice(i, end);
        if (v.includes('<')) return err(`"<" in value of ${a[0]}`);
        const t = text(v); if (t) return err(`${t} in value of ${a[0]}`);
        if (a[0] in attrs) return err(`duplicate attribute ${a[0]}`);
        attrs[a[0]] = v;
        i = end + 1;
      }
      if (rootName === m[0] && rootAttrs === null) rootAttrs = attrs;
      continue;
    }
    const next = src.indexOf('<', i);
    const chunk = src.slice(i, next < 0 ? src.length : next);
    if (!stack.length && chunk.trim()) return err('text outside the root element');
    const t = text(chunk); if (t) return err(t);
    i = next < 0 ? src.length : next;
  }
  if (stack.length) return `unclosed <${stack.pop()}>`;
  if (!roots) return 'no root element';
  return { rootName, rootAttrs };
}

// ---------- shared checks ----------
function checkHex(file, src) {
  const bad = [...new Set((src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).filter((h) => !BRAND.has(h.toUpperCase())))];
  if (bad.length) fail(file, `off-brand hex values ${bad.join(' ')}`);
  else pass(file, 'only brand hex values');
}

function checkPaints(file, src) {
  // fill, stroke and stop-color must be a brand hex, none, currentColor or a local url(#id).
  const bad = [];
  for (const m of src.matchAll(/\b(fill|stroke|stop-color|color)\s*=\s*["']([^"']*)["']/g)) {
    const v = m[2].trim();
    if (BRAND.has(v.toUpperCase()) || v === 'none' || v === 'currentColor' || /^url\(#[-\w]+\)$/.test(v)) continue;
    bad.push(`${m[1]}="${v}"`);
  }
  if (bad.length) fail(file, `paint values that are not brand colors: ${bad.join(', ')}`);
}

function checkExternal(file, src) {
  const rules = [
    [/<script\b[^>]*\bsrc\s*=/i, '<script src>'],
    [/<link\b/i, '<link>'],
    [/@import\b/i, '@import'],
    [/url\(\s*(?!["']?#)/i, 'url() that is not a local #id'],
    [/<(?:img|iframe|image|use|object|embed|source|video|audio|a)\b[^>]*\b(?:xlink:)?(?:src|href)\s*=\s*["'](?!#)/i, 'src/href to another file'],
    [/<image\b/i, '<image>'],
    [/\bimport\s*\(|\bfetch\s*\(|new\s+(?:XMLHttpRequest|Worker|WebSocket|EventSource)\b/, 'network call in script'],
    [/(?:https?:\/\/|["'(=]\s*\/\/)[a-z0-9-]+\.[a-z0-9.-]+/i, 'external URL']
  ];
  // The SVG namespace URI is an identifier, not a request.
  const scrubbed = src.replace(/xmlns(?::\w+)?\s*=\s*["'][^"']*["']/g, '');
  const hits = rules.filter(([re]) => re.test(scrubbed)).map(([, what]) => what);
  if (hits.length) fail(file, `external references: ${hits.join(', ')}`);
  else pass(file, 'no external references');
}

function checkDurations(file, src) {
  const m = src.match(/\bconst\s+DURATIONS\s*=\s*\{([\s\S]*?)\n\s*\};/);
  if (!m) { fail(file, 'no DURATIONS table'); return; }
  const steps = [...m[1].matchAll(/(\w+)\s*:\s*\{\s*start\s*:\s*(\d+)\s*,\s*ms\s*:\s*(\d+)\s*\}/g)]
    .map(([, name, start, ms]) => ({ name, start: +start, ms: +ms }));
  if (!steps.length) { fail(file, 'DURATIONS table has no { start, ms } steps'); return; }
  const short = steps.filter((s) => s.ms < MIN_MS);
  if (short.length) fail(file, `steps under ${MIN_MS} ms: ${short.map((s) => `${s.name} ${s.ms} ms`).join(', ')}`);
  else pass(file, `${steps.length} steps, shortest ${Math.min(...steps.map((s) => s.ms))} ms (${steps.map((s) => `${s.name} ${s.ms}`).join(', ')})`);
}

function checkCssMotion(file, src) {
  const css = [...src.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((x) => x[1]).join('\n');
  const short = [];
  for (const d of css.matchAll(/\b(transition|animation)(?:-duration)?\s*:\s*([^;}]*)/gi)) {
    for (const t of d[2].matchAll(/(\d*\.?\d+)(ms|s)\b/g)) {
      const ms = t[2] === 's' ? +t[1] * 1000 : +t[1];
      if (ms > 0 && ms < MIN_MS) short.push(`${d[1]} ${t[0]}`);
    }
  }
  if (short.length) fail(file, `CSS motion under ${MIN_MS} ms: ${short.join(', ')}`);
}

// ---------- run ----------
let names;
try { names = readdirSync(dir).filter((n) => statSync(join(dir, n)).isFile()); }
catch { console.log(`FAIL ${dir}: not a folder`); process.exit(1); }

for (const r of REQUIRED) {
  if (names.includes(r)) pass(r, 'present'); else fail(r, 'missing');
}

for (const n of names.filter((x) => x.toLowerCase().endsWith('.svg'))) {
  const src = readFileSync(join(dir, n), 'utf8');
  const x = checkXml(src);
  if (typeof x === 'string') { fail(n, `not well-formed XML: ${x}`); continue; }
  pass(n, 'well-formed XML');
  if (x.rootName !== 'svg') fail(n, `root element is <${x.rootName}>, not <svg>`);
  if (!/^\s*-?[\d.]+[\s,]+-?[\d.]+[\s,]+[\d.]+[\s,]+[\d.]+\s*$/.test(x.rootAttrs?.viewBox ?? '')) fail(n, 'no valid viewBox on <svg>');
  else pass(n, `viewBox ${x.rootAttrs.viewBox}`);
  const title = src.match(/<title\b[^>]*>([^<]*)<\/title>/);
  if (!title || !title[1].trim()) fail(n, 'no <title>'); else pass(n, `title "${title[1].trim()}"`);
  checkHex(n, src);
  checkPaints(n, src);
  checkExternal(n, src);
}

for (const n of names.filter((x) => x.toLowerCase().endsWith('.html'))) {
  const src = readFileSync(join(dir, n), 'utf8');
  checkExternal(n, src);
  checkHex(n, src);
  checkPaints(n, src);
  checkDurations(n, src);
  checkCssMotion(n, src);
  if (!/matchMedia\(\s*['"]\(prefers-reduced-motion:\s*reduce\)['"]\s*\)/.test(src)) fail(n, 'no prefers-reduced-motion check');
  else if (!/addEventListener\(\s*['"]change['"]/.test(src)) fail(n, 'does not follow prefers-reduced-motion changes');
  else pass(n, 'reduced-motion branch, follows live changes');
}

for (const line of passes) console.log(line);
for (const line of failures) console.log(line);
console.log(failures.length ? `\n${failures.length} check(s) failed in ${dir}` : `\nAll brand checks passed in ${dir}`);
process.exit(failures.length ? 1 : 0);
