import type { AgentRun, Card, WaitItem } from '../types'

// The pane's drawings on surfaces that render SVG (desktop, vscode, mobile),
// in the look of the Agent Factory Floor page: cream and gold, a display
// serif, mono eyebrows, and the organisation web of agents.

const STYLE = `<style>
:root,svg{--bg:#f5f1e8;--panel:#fbf8f2;--sunk:#ece6da;--line:#ddd4c3;--soft:#e7e0d2;--fg:#1b1813;--muted:#6c6457;--faint:#9a917f;
--gold:#94733a;--glow:rgba(176,140,74,.14);--lab:#3f68b0;--pay:#6e5fb8;--srch:#2f8a71;--grow:#b4673a;--ok:#2f7d55;--bad:#a8463c}
@media (prefers-color-scheme:dark){:root,svg{--bg:#0d0c0a;--panel:#151410;--sunk:#1c1a16;--line:#2c2820;--soft:#221f19;--fg:#f2ece0;--muted:#a69d8c;
--faint:#6f685b;--gold:#cdae74;--glow:rgba(205,174,116,.09);--lab:#86a6e3;--pay:#a597e6;--srch:#6cc1a4;--grow:#dc9a6c;--ok:#7cc79b;--bad:#e08a7f}}
text{font-family:"Hanken Grotesk",ui-sans-serif,system-ui,sans-serif;fill:var(--fg)}
.d{font-family:"Cormorant Garamond","Iowan Old Style",Georgia,serif}
.m{font-family:"IBM Plex Mono",ui-monospace,Menlo,monospace}
.mu{fill:var(--muted)}.fa{fill:var(--faint)}.go{fill:var(--gold)}
.panel{fill:var(--panel);stroke:var(--line)}
.breath{transform-box:fill-box;transform-origin:center;animation:breath 3.2s cubic-bezier(.22,.8,.24,1) infinite}
@keyframes breath{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.6);opacity:0}}
.beat{animation:beat 2.4s ease-out infinite}@keyframes beat{0%,100%{opacity:1}50%{opacity:.35}}
.av:hover .face{stroke:var(--gold);stroke-width:1.6}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>`

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s)
const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${STYLE}${body}</svg>`

export function ago(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000))
  if (s < 5) return 'now'
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  return `${Math.round(s / 3600)}h`
}

// Wraps a title onto at most `lines` lines of about `per` characters.
function wrap(s: string, per: number, lines: number): string[] {
  const out: string[] = []
  let line = ''
  for (const word of s.split(/\s+/)) {
    if ((line + ' ' + word).trim().length > per && line) {
      out.push(line)
      line = word
    } else line = (line + ' ' + word).trim()
  }
  if (line) out.push(line)
  if (out.length > lines) out.splice(lines - 1, out.length, clip(out.slice(lines - 1).join(' '), per))
  return out
}

/* ---------- the firm ---------- */

type Unit = { id: string; name: string; color: string; agents: [string, string, string][] }
// [agent type, short label, initials]
const UNITS: Unit[] = [
  { id: 'rnd', name: 'Cases & stories', color: 'var(--lab)', agents: [['rnd-analyst', 'analyst', 'RA'], ['pm', 'pm', 'PM']] },
  { id: 'spec', name: 'Spec & design', color: 'var(--pay)', agents: [['api-architect', 'architect', 'AA'], ['designer', 'designer', 'DS']] },
  {
    id: 'build',
    name: 'Build',
    color: 'var(--srch)',
    agents: [['dev-content', 'content', 'DC'], ['dev-rendering', 'rendering', 'DR'], ['dev-publishing', 'publishing', 'DP']],
  },
  { id: 'review', name: 'Review', color: 'var(--grow)', agents: [['reviewer', 'reviewer', 'RV'], ['tester', 'tester', 'TE']] },
]
export const ROSTER = UNITS.flatMap(u => u.agents.map(a => a[0]))
const unitOf = (agent: string) =>
  UNITS.find(u => u.agents.some(a => a[0] === agent)) ?? (agent.startsWith('pr-review-toolkit') ? UNITS[3] : undefined)

const TEAM_COLOR: Record<string, string> = {
  'team:content': 'var(--srch)',
  'team:rendering': 'var(--pay)',
  'team:publishing': 'var(--grow)',
  'team:design': 'var(--lab)',
  'team:factory': 'var(--gold)',
}
const teamOf = (card: Card) => card.labels.find(l => l.startsWith('team:'))

/* ---------- masthead and figures ---------- */

export type Figures = { waiting: number; atWork: number; agents: number; inFlight: number; shipped: number }

export function masthead(w: number, f: Figures, updated: string, isBusy: boolean): string {
  const narrow = w < 420
  const cols = narrow ? 2 : 4
  const figs: [string, number, string][] = [
    ['Waiting on you', f.waiting, 'reviews, merges, blocks'],
    ['At work', f.atWork, `of ${f.agents} agents`],
    ['In flight', f.inFlight, 'Ready to Ready to merge'],
    ['Shipped', f.shipped, 'stories done'],
  ]
  const fw = w / cols
  const top = 92
  const fh = 74
  const rows = Math.ceil(figs.length / cols)
  const h = top + rows * fh + 8
  const live = f.atWork > 0 ? `Live · ${f.atWork} at work` : 'Live · quiet'
  let body = `
  <text x="0" y="16" class="m go" font-size="10.5" letter-spacing="2">HIVESITE · FACTORY FLOOR</text>
  <text x="0" y="58" class="d" font-size="${narrow ? 34 : 40}" font-weight="500">The Agent <tspan font-style="italic" class="go">Factory</tspan></text>
  <circle cx="${w - 8}" cy="12" r="3.5" fill="var(--${isBusy ? 'gold' : 'ok'})" class="beat"/>
  <text x="${w - 18}" y="16" text-anchor="end" font-size="11.5" class="mu">${esc(isBusy ? 'Refreshing…' : live)}</text>
  <text x="0" y="80" font-size="11.5" class="fa">${esc(updated)}</text>
  <line x1="0" x2="${w}" y1="${top - 4}" y2="${top - 4}" stroke="var(--line)"/>`
  figs.forEach(([label, value, small], i) => {
    const c = i % cols
    const r = Math.floor(i / cols)
    const x = c * fw + (c ? 14 : 0)
    const y = top + r * fh
    if (c) body += `<line x1="${c * fw}" x2="${c * fw}" y1="${y + 6}" y2="${y + fh - 6}" stroke="var(--line)"/>`
    if (r) body += `<line x1="0" x2="${w}" y1="${y}" y2="${y}" stroke="var(--line)"/>`
    const tone = i === 0 && value > 0 ? 'go' : ''
    body += `<text x="${x}" y="${y + 20}" font-size="11.5" class="mu">${label}</text>
    <text x="${x}" y="${y + 52}" class="d ${tone}" font-size="34" font-weight="500">${value}</text>
    <text x="${x}" y="${y + 67}" class="m fa" font-size="9.5">${esc(clip(small, Math.floor(fw / 6)))}</text>`
  })
  body += `<line x1="0" x2="${w}" y1="${h - 4}" y2="${h - 4}" stroke="var(--line)"/>`
  return svg(w, h, body)
}

/* ---------- the organisation web ---------- */

const curve = (a: { x: number; y: number }, b: { x: number; y: number }, bend: number) => {
  const my = (a.y + b.y) / 2
  return `M${a.x} ${a.y} C${a.x} ${my + bend} ${b.x} ${my - bend} ${b.x} ${b.y}`
}

function avatar(x: number, y: number, r: number, color: string, initials: string, on: boolean, title: string) {
  return `<g class="av" transform="translate(${x} ${y})"><title>${esc(title)}</title>
  ${on ? `<circle class="breath" r="${r}" fill="none" stroke="${color}"/><circle r="${r + 6}" fill="${color}" fill-opacity=".13"/>` : ''}
  <circle r="${r}" fill="var(--sunk)"/>
  <circle class="face" r="${r}" fill="none" stroke="${color}" stroke-opacity="${on ? 1 : 0.55}"/>
  ${on ? `<circle r="${r + 3}" fill="none" stroke="${color}" stroke-width="1.6" stroke-dasharray="${(2 * Math.PI * (r + 3) * 0.7).toFixed(1)} 999" transform="rotate(-90)"/>` : ''}
  <text y="${r * 0.34}" text-anchor="middle" class="d" font-size="${r * 0.95}" font-weight="600" fill="${on ? color : 'var(--muted)'}">${initials}</text>
  <circle cx="${r * 0.72}" cy="${r * 0.72}" r="3.6" fill="${on ? 'var(--ok)' : 'var(--faint)'}" stroke="var(--panel)" stroke-width="2"/></g>`
}

export function orgWeb(w: number, runs: AgentRun[]): string {
  const running = runs.filter(r => !r.endedAt)
  const busy = (agent: string) => running.filter(r => r.agent === agent)
  const narrow = w < 440
  const cols = narrow ? 1 : 2
  const gap = 14
  const uw = (w - 24 - (cols - 1) * gap) / cols
  const uh = 128
  const top = 118
  const M = { x: w / 2, y: 62 }
  const managerOn = running.length > 0
  let edges = ''
  let boxes = ''
  let people = ''

  UNITS.forEach((u, i) => {
    const c = i % cols
    const r = Math.floor(i / cols)
    const x = 12 + c * (uw + gap)
    const y = top + r * (uh + gap)
    const hub = { x: x + uw / 2, y }
    const unitOn = u.agents.some(a => busy(a[0]).length > 0)
    // One column: the units hang in pipeline order, each from the one above.
    const from = narrow && i > 0 ? { x: hub.x, y: y - gap } : { x: M.x, y: M.y + 28 }
    const path = narrow && i > 0 ? `M${from.x} ${from.y} V${y}` : curve(from, hub, 14)
    edges += `<path d="${path}" fill="none" stroke="${u.color}" stroke-opacity="${unitOn ? 0.7 : 0.2}" stroke-width="${unitOn ? 1.4 : 1}"/>`
    if (unitOn) {
      edges += `<circle r="3" fill="${u.color}"><animateMotion dur="1.6s" repeatCount="indefinite" path="${path}"/></circle>`
    }
    boxes += `<rect x="${x}" y="${y}" width="${uw}" height="${uh}" rx="16" fill="var(--bg)" fill-opacity=".6" stroke="${u.color}" stroke-opacity="${unitOn ? 0.6 : 0.3}"/>
    <circle cx="${hub.x}" cy="${hub.y}" r="3.5" fill="${u.color}"/>
    <text x="${x + 14}" y="${y + 22}" class="m" font-size="10" letter-spacing="1.5" fill="${u.color}">${u.name.toUpperCase()}</text>`
    const n = u.agents.length
    const span = Math.min(uw - 24, n * 92)
    u.agents.forEach(([agent, label, initials], j) => {
      const ax = x + uw / 2 - span / 2 + span / n / 2 + (j * span) / n
      const ay = y + 64
      const on = busy(agent)
      const story = on.find(run => run.story)?.story
      const ap = curve(hub, { x: ax, y: ay - 22 }, -6)
      edges += `<path d="${ap}" fill="none" stroke="${u.color}" stroke-opacity="${on.length ? 0.75 : 0.16}" stroke-width="${on.length ? 1.4 : 1}"/>`
      if (on.length) edges += `<circle r="2.4" fill="${u.color}"><animateMotion dur="1.2s" repeatCount="indefinite" path="${ap}"/></circle>`
      const title = on.length ? `${agent} · ${on.map(run => run.description || 'working').join('; ')}` : `${agent} · idle`
      people += avatar(ax, ay, 19, u.color, initials, on.length > 0, title)
      people += `<text x="${ax}" y="${ay + 36}" text-anchor="middle" font-size="11.5">${label}</text>`
      people += on.length
        ? `<text x="${ax}" y="${ay + 50}" text-anchor="middle" class="m go" font-size="9.5" letter-spacing=".8">${story ? `ON #${story}` : 'AT WORK'}</text>`
        : `<text x="${ax}" y="${ay + 50}" text-anchor="middle" class="m fa" font-size="9.5" letter-spacing=".8">IDLE</text>`
    })
  })

  // Agents without a seat in the web: general-purpose, Explore, the toolkit's reviewers.
  const extra = running.filter(r => !ROSTER.includes(r.agent))
  const rows = Math.ceil(UNITS.length / cols)
  let h = top + rows * (uh + gap) + 4
  let others = ''
  if (extra.length) {
    others += `<text x="12" y="${h + 10}" class="m fa" font-size="9.5" letter-spacing="1.4">ALSO AT WORK</text>`
    extra.slice(0, 4).forEach((run, i) => {
      others += `<text x="12" y="${h + 30 + i * 18}" font-size="12">${esc(clip(`${run.agent}${run.story ? ` on #${run.story}` : ''} · ${run.description}`, Math.floor(w / 6.5)))}</text>`
    })
    h += 24 + Math.min(4, extra.length) * 18
  }

  const head = `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="18" class="panel"/>
  <defs><radialGradient id="glow"><stop offset="0" stop-color="var(--glow)"/><stop offset="1" stop-color="var(--glow)" stop-opacity="0"/></radialGradient></defs>
  <ellipse cx="${w / 2}" cy="50" rx="${w * 0.42}" ry="64" fill="url(#glow)"/>
  <text x="18" y="32" class="d" font-size="24" font-weight="500">Organisation</text>
  <text x="${w - 18}" y="32" text-anchor="end" font-size="11.5" class="fa">${running.length ? `${running.length} at work` : 'All idle'}</text>`
  const manager = avatar(M.x, M.y, 24, 'var(--gold)', 'M', managerOn, managerOn ? 'manager · running a story' : 'manager · idle')
  const mlabel = `<text x="${M.x + 34}" y="${M.y - 2}" class="d" font-size="16" font-weight="600">Manager</text>
  <text x="${M.x + 34}" y="${M.y + 13}" class="m go" font-size="9.5" letter-spacing="1.3">RUN-STORY</text>`
  return svg(w, h, head + edges + boxes + manager + mlabel + people + others)
}

/* ---------- stories ---------- */

const STAGES = ['Ready', 'Spec review', 'Building', 'Agent review', 'Ready to merge']
const STAGE_LABEL = ['Ready', 'Spec', 'Build', 'Review', 'Merge']

export function stories(w: number, cards: Card[], runs: AgentRun[], waiting: WaitItem[]): string {
  const flying = cards
    .filter(c => STAGES.includes(c.status))
    .sort((a, b) => STAGES.indexOf(b.status) - STAGES.indexOf(a.status))
  const cols = w >= 560 ? 2 : 1
  const gap = 12
  const cw = (w - 36 - (cols - 1) * gap) / cols
  const ch = 150
  const top = 50
  const rows = Math.max(1, Math.ceil(flying.length / cols))
  const h = top + (flying.length ? rows * (ch + gap) : 40) + 6
  let body = `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="18" class="panel"/>
  <text x="18" y="32" class="d" font-size="24" font-weight="500">Stories</text>
  <text x="${w - 18}" y="32" text-anchor="end" font-size="11.5" class="fa">Where each story stands</text>`
  if (!flying.length) {
    body += `<text x="18" y="${top + 18}" font-size="13" class="mu">Nothing in flight. Move a Backlog story to Ready, then run it.</text>`
  }
  const per = Math.floor((cw - 28) / 10.6)
  flying.forEach((card, i) => {
    const x = 18 + (i % cols) * (cw + gap)
    const y = top + Math.floor(i / cols) * (ch + gap)
    const color = TEAM_COLOR[teamOf(card) ?? ''] ?? 'var(--gold)'
    const stage = STAGES.indexOf(card.status)
    const who = runs.find(r => !r.endedAt && r.story === card.number)
    const gate = waiting.find(item => card.prs.includes(item.url) || item.number === card.number)
    const title = wrap(card.title, per, 2)
    const segW = (cw - 28 - 4 * 4) / 5
    body += `<g><title>${esc(`#${card.number} ${card.title}`)}</title>
    <rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="16" fill="none" stroke="var(--soft)"/>
    <path d="M${x + 16} ${y + 0.75} H${x + cw - 16}" stroke="${color}" stroke-width="2" stroke-opacity=".85"/>
    <text x="${x + 14}" y="${y + 24}" class="m" font-size="10" letter-spacing="1.6" fill="${color}">${esc((teamOf(card)?.slice(5) ?? 'story').toUpperCase())} · #${card.number}</text>
    <text x="${x + cw - 14}" y="${y + 24}" text-anchor="end" font-size="11.5" class="mu">${esc(card.status)}</text>
    ${title.map((line, k) => `<text x="${x + 14}" y="${y + 50 + k * 22}" class="d" font-size="20" font-weight="600">${esc(line)}</text>`).join('')}`
    STAGE_LABEL.forEach((label, k) => {
      const sx = x + 14 + k * (segW + 4)
      const fill = k < stage ? color : k === stage ? color : 'var(--sunk)'
      const opacity = k === stage ? 0.55 : 1
      body += `<rect x="${sx}" y="${y + 98}" width="${segW}" height="3" rx="1.5" fill="${fill}" fill-opacity="${opacity}"/>
      <text x="${sx}" y="${y + 114}" font-size="10" class="${k === stage ? '' : 'fa'}">${label}</text>`
    })
    const foot = who
      ? `<tspan fill="var(--ok)">●</tspan> ${esc(who.agent)} at work · ${ago(who.startedAt)}`
      : gate
        ? `<tspan class="go">●</tspan> Waiting on you · #${gate.number}`
        : card.status === 'Ready'
          ? 'Ready to run'
          : 'Between steps'
    body += `<line x1="${x + 14}" x2="${x + cw - 14}" y1="${y + 124}" y2="${y + 124}" stroke="var(--soft)"/>
    <text x="${x + 14}" y="${y + 141}" font-size="11.5" class="mu">${foot}</text></g>`
  })
  return svg(w, h, body)
}

/* ---------- activity ---------- */

export function activity(w: number, runs: AgentRun[]): string {
  const events = runs
    .flatMap(run => {
      const unit = unitOf(run.agent)
      const color = unit?.color ?? 'var(--gold)'
      const on = run.story ? ` on #${run.story}` : ''
      const list = [{ at: run.startedAt, color, text: `${run.agent} started${on}${run.description ? ` · ${run.description}` : ''}` }]
      if (run.endedAt) list.push({ at: run.endedAt, color, text: `${run.agent} finished${on}` })
      return list
    })
    .sort((a, b) => b.at - a.at)
    .slice(0, 8)
  const h = 52 + Math.max(1, events.length) * 26 + 8
  let body = `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="18" class="panel"/>
  <text x="18" y="32" class="d" font-size="24" font-weight="500">Activity</text>
  <text x="${w - 18}" y="32" text-anchor="end" font-size="11.5" class="fa">Newest first</text>`
  if (!events.length) body += `<text x="18" y="70" font-size="13" class="mu">The floor is quiet. Run a story to get it going.</text>`
  events.forEach((event, i) => {
    const y = 70 + i * 26
    if (i) body += `<line x1="18" x2="${w - 18}" y1="${y - 17}" y2="${y - 17}" stroke="var(--soft)"/>`
    body += `<text x="18" y="${y}" class="m fa" font-size="10.5">${ago(event.at)}</text>
    <circle cx="64" cy="${y - 4}" r="3" fill="${event.color}"/>
    <text x="76" y="${y}" font-size="12.5">${esc(clip(event.text, Math.floor((w - 94) / 6.6)))}</text>`
  })
  return svg(w, h, body)
}
