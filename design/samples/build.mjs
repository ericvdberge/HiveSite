// Builds design/samples/blocks.html from design/tokens.json.
// Usage: node design/samples/build.mjs design/tokens.json design/samples/blocks.html
import { readFileSync, writeFileSync } from 'node:fs';
const tokens = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const vars = (o, p = '--hs') => Object.entries(o).flatMap(([k, v]) => {
  const name = `${p}-${k.replace(/_/g, '-')}`;
  return v && typeof v === 'object' ? vars(v, name) : [`  ${name}: ${v};`];
});
const themeCss = Object.entries(tokens.themes).map(([key, t]) => {
  const { name, description, ...rest } = t;
  return `[data-theme="${key}"] {\n  color-scheme: ${t.color_scheme};\n${vars(rest).filter((l) => !l.includes('--hs-color-scheme')).join('\n')}\n}`;
}).join('\n');
const bp = tokens.themes[tokens.default_theme].breakpoint;
const options = Object.entries(tokens.themes).map(([k, t]) => `<button type="button" data-set="${k}">${t.name}</button>`).join('');
const img = (seed, w = 1600, h = 1000) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hivesite blocks, all themes</title>
<!-- Generated from design/tokens.json. Every value below comes from a token; block CSS uses var(--hs-*) only. Breakpoints are written from breakpoint.* at build time. -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Hanken+Grotesk:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
${themeCss}
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; background: var(--hs-color-background); color: var(--hs-color-text); font-family: var(--hs-font-text); font-size: var(--hs-font-size-body); font-weight: var(--hs-font-weight-text); line-height: var(--hs-line-height-body); overflow-wrap: anywhere; }
img { display: block; max-width: 100%; }
a { color: var(--hs-color-accent-text); text-underline-offset: 0.2em; text-decoration-thickness: var(--hs-border-width-hairline); transition: text-decoration-thickness var(--hs-motion-duration-base) var(--hs-motion-easing-standard); }
a:hover { text-decoration-thickness: var(--hs-border-width-focus); }
:focus-visible { outline: var(--hs-border-width-focus) solid var(--hs-color-focus); outline-offset: var(--hs-border-width-focus-offset); }
section { padding: var(--hs-layout-section-y) var(--hs-layout-gutter); }
.wide { max-width: var(--hs-layout-wide-width); margin-inline: auto; }
.content { max-width: var(--hs-layout-content-width); margin-inline: auto; }
.block-heading { font-family: var(--hs-font-display); font-size: var(--hs-font-size-display-l); font-weight: var(--hs-font-weight-display); line-height: var(--hs-line-height-display); letter-spacing: var(--hs-letter-spacing-display); margin: 0 0 var(--hs-space-6); }
.label { font-family: var(--hs-font-label); font-size: var(--hs-font-size-label); font-weight: var(--hs-font-weight-label); letter-spacing: var(--hs-letter-spacing-label); line-height: var(--hs-line-height-label); text-transform: uppercase; color: var(--hs-color-text-muted); }
.hs-button { display: inline-flex; align-items: center; min-height: var(--hs-control-min-height); padding: var(--hs-control-padding-y) var(--hs-control-padding-x); background: var(--hs-color-accent); color: var(--hs-color-on-accent); border: 0; border-radius: var(--hs-radius-control); font: inherit; font-size: var(--hs-font-size-body-s); font-weight: var(--hs-font-weight-text-strong); text-decoration: none; cursor: pointer; }
.hs-button:hover { text-decoration: underline; text-underline-offset: 0.2em; }
/* switcher (sample only) */
.switch { position: sticky; top: 0; z-index: 2; display: flex; gap: var(--hs-space-2); padding: var(--hs-space-3) var(--hs-layout-gutter); background: var(--hs-color-surface); border-bottom: var(--hs-border-width-hairline) solid var(--hs-color-border); }
.switch button { font: inherit; font-size: var(--hs-font-size-body-s); padding: var(--hs-space-1) var(--hs-space-4); background: none; color: var(--hs-color-text); border: var(--hs-border-width-control) solid var(--hs-color-border-strong); border-radius: var(--hs-radius-control); cursor: pointer; }
.switch button[aria-pressed="true"] { background: var(--hs-color-accent); color: var(--hs-color-on-accent); border-color: var(--hs-color-accent); }
.switch .label { margin-inline-start: auto; align-self: center; }
/* hero */
.hs-hero { position: relative; }
.hs-hero[data-variant="text"] .hs-hero__body::before { content: ""; display: block; width: var(--hs-space-7); height: var(--hs-border-width-hairline); background: var(--hs-color-rule); margin-bottom: var(--hs-space-5); }
.hs-hero[data-variant="image"] { min-height: var(--hs-media-hero-min-height); display: flex; align-items: flex-end; padding-top: var(--hs-space-9); background: var(--hs-color-placeholder-media); color: var(--hs-color-on-image); }
.hs-hero__image { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.hs-hero[data-variant="image"]::after { content: ""; position: absolute; inset: 0; background: var(--hs-color-image-scrim); }
.hs-hero__body { position: relative; z-index: 1; width: 100%; max-width: var(--hs-layout-wide-width); margin-inline: auto; }
.hs-hero__body > * { max-width: var(--hs-layout-content-width); }
.hs-hero__title { font-family: var(--hs-font-display); font-size: var(--hs-font-size-display-xl); font-weight: var(--hs-font-weight-display); line-height: var(--hs-line-height-display); letter-spacing: var(--hs-letter-spacing-display); text-wrap: balance; margin: 0; }
.hs-hero__subtitle { font-size: var(--hs-font-size-body-l); color: var(--hs-color-text-muted); margin: var(--hs-space-4) 0 0; max-width: var(--hs-layout-measure); }
.hs-hero[data-variant="image"] .hs-hero__subtitle { color: var(--hs-color-on-image); }
.hs-hero .hs-button { margin-top: var(--hs-space-6); }
/* rich text */
.hs-prose { max-width: var(--hs-layout-content-width); margin-inline: auto; }
.hs-prose > * { margin: var(--hs-space-4) 0 0; max-width: var(--hs-layout-measure); }
.hs-prose > :first-child { margin-top: 0; }
.hs-prose h2 { font-family: var(--hs-font-display); font-size: var(--hs-font-size-display-l); font-weight: var(--hs-font-weight-display); line-height: var(--hs-line-height-heading); margin-top: var(--hs-space-7); }
.hs-prose h3 { font-family: var(--hs-font-display); font-size: var(--hs-font-size-display-m); font-weight: var(--hs-font-weight-display-strong); line-height: var(--hs-line-height-heading); margin-top: var(--hs-space-6); }
.hs-prose :is(h2, h3) + * { margin-top: var(--hs-space-3); }
.hs-prose :is(ul, ol) { padding-inline-start: var(--hs-space-5); }
.hs-prose li { margin-top: var(--hs-space-2); }
.hs-prose li > p { margin: 0; }
.hs-prose ::marker { color: var(--hs-color-text-muted); }
.hs-prose strong { font-weight: var(--hs-font-weight-text-strong); }
/* image */
.hs-image figure, .hs-gallery figure, .hs-embed figure { margin: 0; }
.hs-image img { width: 100%; height: auto; max-height: var(--hs-media-image-max-height); object-fit: contain; border-radius: var(--hs-radius-media); background: var(--hs-color-placeholder-media); }
figcaption { font-size: var(--hs-font-size-body-s); color: var(--hs-color-text-muted); margin-top: var(--hs-space-3); max-width: var(--hs-layout-measure); }
/* gallery */
.hs-gallery ul, .hs-cards ul { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--hs-layout-grid-gap); }
.hs-gallery ul { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.hs-gallery img { width: 100%; aspect-ratio: var(--hs-media-gallery-ratio); object-fit: cover; border-radius: var(--hs-radius-media); background: var(--hs-color-placeholder-media); }
.hs-gallery figcaption { margin-top: var(--hs-space-2); }
/* cards */
.hs-cards[data-layout="grid"] ul { grid-template-columns: minmax(0, 1fr); }
.hs-card { position: relative; display: flex; flex-direction: column; }
.hs-cards[data-layout="grid"] .hs-card { background: var(--hs-color-surface); border: var(--hs-border-width-hairline) solid var(--hs-color-border); border-radius: var(--hs-radius-card); overflow: hidden; transition: border-color var(--hs-motion-duration-base) var(--hs-motion-easing-standard); }
.hs-cards[data-layout="grid"] .hs-card:hover { border-color: var(--hs-color-border-strong); }
.hs-card:focus-within { outline: var(--hs-border-width-focus) solid var(--hs-color-focus); outline-offset: var(--hs-border-width-focus-offset); }
.hs-card :focus-visible { outline: none; }
.hs-card img { width: 100%; aspect-ratio: var(--hs-media-card-ratio); object-fit: cover; }
.hs-card__text { padding: var(--hs-space-5); display: flex; flex-direction: column; flex: 1; }
.hs-card__title { font-family: var(--hs-font-display); font-size: var(--hs-font-size-display-m); font-weight: var(--hs-font-weight-display-strong); line-height: var(--hs-line-height-heading); margin: 0; }
.hs-card__title a { color: var(--hs-color-text); text-decoration: none; }
.hs-card__title a::after { content: ""; position: absolute; inset: 0; }
.hs-card:hover .hs-card__title a { text-decoration: underline; }
.hs-card__body { font-size: var(--hs-font-size-body-s); color: var(--hs-color-text-muted); margin: var(--hs-space-2) 0 0; }
.hs-card__action { margin-top: auto; padding-top: var(--hs-space-4); color: var(--hs-color-accent-text); }
.hs-cards[data-layout="list"] .hs-card { border-bottom: var(--hs-border-width-hairline) solid var(--hs-color-border); }
.hs-cards[data-layout="list"] .hs-card:first-child { border-top: var(--hs-border-width-hairline) solid var(--hs-color-border); }
.hs-cards[data-layout="list"] .hs-card__text { padding: var(--hs-space-5) 0; }
.hs-cards[data-layout="list"] ul { gap: 0; }
.hs-pager { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; margin-top: var(--hs-space-7); }
.hs-pager :last-child { justify-self: end; }
/* form */
.hs-form__intro { font-size: var(--hs-font-size-body-l); color: var(--hs-color-text-muted); margin: 0 0 var(--hs-space-6); }
.hs-form form { background: var(--hs-color-surface); border: var(--hs-border-width-hairline) solid var(--hs-color-border); border-radius: var(--hs-radius-card); padding: var(--hs-space-5); display: grid; gap: var(--hs-space-5); }
.hs-field { display: grid; gap: var(--hs-space-2); }
.hs-field label { font-size: var(--hs-font-size-body-s); font-weight: var(--hs-font-weight-text-strong); }
.hs-field label span { color: var(--hs-color-text-muted); font-weight: var(--hs-font-weight-text); }
.hs-field :is(input, textarea) { width: 100%; min-height: var(--hs-control-min-height); padding: var(--hs-control-padding-y) var(--hs-control-padding-x); background: var(--hs-color-surface-sunk); color: var(--hs-color-text); border: var(--hs-border-width-control) solid var(--hs-color-border-strong); border-radius: var(--hs-radius-control); font: inherit; transition: border-color var(--hs-motion-duration-base) var(--hs-motion-easing-standard); }
.hs-field textarea { border-radius: min(var(--hs-radius-control), var(--hs-radius-card)); resize: vertical; }
.hs-field :is(input, textarea):hover { border-color: var(--hs-color-text-muted); }
.hs-field :is(input, textarea):focus-visible { border-color: var(--hs-color-focus); }
.hs-field.is-invalid :is(input, textarea), .hs-field :is(input, textarea):user-invalid { border-color: var(--hs-color-error); }
.hs-field__error { font-size: var(--hs-font-size-body-s); color: var(--hs-color-error); margin: 0; }
.hs-form .hs-button { justify-self: stretch; justify-content: center; }
/* embed */
.hs-embed__frame { aspect-ratio: 16 / 9; border-radius: var(--hs-radius-media); overflow: hidden; background: var(--hs-color-placeholder-media); display: grid; place-items: center; color: var(--hs-color-text-muted); font-size: var(--hs-font-size-body-s); }
.hs-embed .label { margin-top: var(--hs-space-3); }
.hs-embed figcaption { margin-top: var(--hs-space-1); }
.sample-note { font-size: var(--hs-font-size-body-s); color: var(--hs-color-text-muted); text-align: center; padding: var(--hs-space-6) var(--hs-layout-gutter); border-top: var(--hs-border-width-hairline) solid var(--hs-color-border); margin: 0; }
@media (min-width: ${bp.sm}) {
  .hs-gallery ul { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .hs-cards[data-layout="grid"] ul { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .hs-form form { padding: var(--hs-space-6); }
  .hs-form .hs-button { justify-self: start; }
}
@media (min-width: ${bp.md}) {
  .hs-gallery ul { grid-template-columns: repeat(var(--hs-gallery-columns), minmax(0, 1fr)); }
  .hs-cards[data-layout="grid"] ul { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
/* reveal: added by script, so content shows without it */
.js-reveal .reveal { opacity: 0; transform: translateY(var(--hs-motion-rise-distance)); transition: opacity var(--hs-motion-duration-slow) var(--hs-motion-easing-enter), transform var(--hs-motion-duration-slow) var(--hs-motion-easing-enter); }
.js-reveal .reveal.is-in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  [data-theme] { --hs-motion-duration-base: var(--hs-motion-reduced-duration); --hs-motion-duration-slow: var(--hs-motion-reduced-duration); --hs-motion-rise-distance: var(--hs-motion-reduced-rise-distance); --hs-motion-stagger: var(--hs-motion-reduced-duration); }
}
</style>
</head>
<body data-theme="${tokens.default_theme}">
<div class="switch" role="group" aria-label="Theme">${options}<span class="label">design/tokens.json v${tokens.version}</span></div>
<main>
<section class="hs-hero" data-variant="image" aria-label="Hero with image">
  <img class="hs-hero__image" src="${img('atelier-hero')}" alt="" fetchpriority="high">
  <div class="hs-hero__body reveal">
    <p class="label" style="color: inherit; margin: 0 0 var(--hs-space-4)">Hero, with image</p>
    <h1 class="hs-hero__title">Thrown, glazed and fired by hand.</h1>
    <p class="hs-hero__subtitle">Small-batch stoneware from a studio in Utrecht. Every piece is made to be used, every day.</p>
    <a class="hs-button" href="#shop">Visit the studio</a>
  </div>
</section>
<section class="hs-hero" data-variant="text" aria-label="Hero, text only">
  <div class="hs-hero__body reveal">
    <h2 class="hs-hero__title">Crafted by many. Made for you.</h2>
    <p class="hs-hero__subtitle">The text-only hero. A rule in the accent, a display title and a calm subtitle.</p>
    <a class="hs-button" href="#contact">Get in touch</a>
  </div>
</section>
<section class="hs-rich-text">
  <div class="hs-prose reveal">
    <h2>The studio</h2>
    <p>Every piece is thrown, glazed and fired in <strong>Utrecht</strong>. We work in <em>small batches</em>, so each glaze settles a little differently. Read more <a href="#about">about our clay</a>.</p>
    <h3>What we make</h3>
    <ul><li><p>Mugs and cups</p></li><li><p>Serving bowls, in three sizes</p><ul><li><p>Nested sets on request</p></li></ul></li><li><p>Vases</p></li></ul>
    <ol><li><p>Choose a piece.</p></li><li><p>We fire it within two weeks.</p></li></ol>
  </div>
</section>
<section class="hs-image" data-width="wide">
  <figure class="wide reveal">
    <img src="${img('atelier-wide', 1800, 900)}" alt="Shelves of glazed bowls in the studio" loading="lazy" width="1800" height="900">
    <figcaption>Image, width wide. The kiln room, early morning.</figcaption>
  </figure>
</section>
<section class="hs-gallery" aria-labelledby="g-h">
  <div class="wide">
    <h2 class="block-heading" id="g-h">Gallery</h2>
    <ul style="--hs-gallery-columns: 3">
      ${[1, 2, 3, 4, 5].map((i) => `<li class="reveal"><figure><img src="${img('atelier-g' + i, 800, 600)}" alt="Glazed piece ${i}" loading="lazy">${i % 2 ? `<figcaption>Celadon, piece ${i}</figcaption>` : ''}</figure></li>`).join('\n      ')}
    </ul>
  </div>
</section>
<section class="hs-cards" data-layout="grid" aria-labelledby="c-h">
  <div class="wide">
    <h2 class="block-heading" id="c-h">Card list, grid</h2>
    <ul>
      <li class="hs-card reveal"><img src="${img('atelier-c1', 900, 600)}" alt="" loading="lazy"><div class="hs-card__text"><h3 class="hs-card__title"><a href="#c1">Ceramics</a></h3><p class="hs-card__body">Stoneware for the table, in four glazes.</p><span class="hs-card__action label" aria-hidden="true">Shop the range &#8594;</span></div></li>
      <li class="hs-card reveal"><img src="${img('atelier-c2', 900, 600)}" alt="" loading="lazy"><div class="hs-card__text"><h3 class="hs-card__title"><a href="#c2">Workshops</a></h3><p class="hs-card__body">Two evenings at the wheel, for up to six people. Clay, glazes and firing are included, and you take home what you make.</p><span class="hs-card__action label" aria-hidden="true">Book a place &#8594;</span></div></li>
      <li class="hs-card reveal"><div class="hs-card__text"><h3 class="hs-card__title">Commissions</h3><p class="hs-card__body">A card without image or link: not clickable, no action.</p></div></li>
    </ul>
  </div>
</section>
<section class="hs-cards" data-layout="list" aria-labelledby="l-h">
  <div class="content">
    <h2 class="block-heading" id="l-h">Card list, pages</h2>
    <ul class="reveal">
      <li class="hs-card"><div class="hs-card__text"><h3 class="hs-card__title"><a href="#about">About</a></h3></div></li>
      <li class="hs-card"><div class="hs-card__text"><h3 class="hs-card__title"><a href="#journal">Journal</a></h3></div></li>
      <li class="hs-card"><div class="hs-card__text"><h3 class="hs-card__title"><a href="#visit">Visit</a></h3></div></li>
    </ul>
    <nav class="hs-pager" aria-label="Card list, pages: pages"><a href="#prev">&#8592; Previous</a><span class="label">Page 2 of 5</span><a href="#next">Next &#8594;</a></nav>
  </div>
</section>
<section class="hs-form" aria-labelledby="f-h">
  <div class="content reveal">
    <h2 class="block-heading" id="f-h">Contact form</h2>
    <p class="hs-form__intro">Questions about a piece or a workshop? Write to us. We answer within two days.</p>
    <form method="post" action="#" onsubmit="return false">
      <div class="hs-field"><label for="f-name">Name <span>(required)</span></label><input id="f-name" name="name" autocomplete="name" required></div>
      <div class="hs-field is-invalid"><label for="f-email">Email <span>(required)</span></label><input id="f-email" name="email" type="email" autocomplete="email" required value="anna@" aria-describedby="f-email-err" aria-invalid="true"><p class="hs-field__error" id="f-email-err">Error: enter an email address with a domain.</p></div>
      <div class="hs-field"><label for="f-msg">Message</label><textarea id="f-msg" name="message" rows="5"></textarea></div>
      <button class="hs-button" type="submit">Send</button>
    </form>
  </div>
</section>
<section class="hs-embed">
  <figure class="wide reveal">
    <div class="hs-embed__frame">A video from YouTube (placeholder in this sample)</div>
    <p class="label">YouTube</p>
    <figcaption>At the wheel: making a celadon bowl</figcaption>
  </figure>
</section>
</main>
<p class="sample-note">Sample only. Images from picsum.photos; the embed is a placeholder so the sample loads no third-party player.</p>
<script>
const params = new URLSearchParams(location.search);
const set = (k) => { document.body.dataset.theme = k; document.querySelectorAll('[data-set]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.set === k))); };
document.querySelectorAll('[data-set]').forEach((b) => b.addEventListener('click', () => set(b.dataset.set)));
set(params.get('theme') || document.body.dataset.theme);
if (!params.has('static') && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('js-reveal');
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }));
  document.querySelectorAll('.reveal').forEach((el, i, all) => {
    const sib = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
    const n = Math.min(sib.indexOf(el), 5);
    el.style.transitionDelay = 'calc(var(--hs-motion-stagger) * ' + n + ')';
    io.observe(el);
  });
}
</script>
</body>
</html>
`;
writeFileSync(process.argv[3], html);
console.log('wrote', process.argv[3]);
