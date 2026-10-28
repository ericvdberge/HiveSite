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

// The factory's agents by team, with the short label and the one line the
// pane shows in an agent's file. Colors are mid-tones that read in both themes.
export type Seat = { agent: string; label: string; role: string }
export type Unit = { id: string; name: string; color: string; seats: Seat[] }
export const UNITS: Unit[] = [
  {
    id: 'rnd',
    name: 'Cases & stories',
    color: '#5b82c9',
    seats: [
      { agent: 'rnd-analyst', label: 'Analyst', role: 'Finds and sizes business cases' },
      { agent: 'pm', label: 'PM', role: 'Acceptance criteria and tasks' },
    ],
  },
  {
    id: 'spec',
    name: 'Spec & design',
    color: '#8a7bd6',
    seats: [
      { agent: 'api-architect', label: 'Architect', role: 'API specs in specs/' },
      { agent: 'designer', label: 'Designer', role: 'Tokens, themes and block layouts in design/' },
    ],
  },
  {
    id: 'build',
    name: 'Build',
    color: '#3fa384',
    seats: [
      { agent: 'dev-content', label: 'Content', role: 'Builds the Content module' },
      { agent: 'dev-rendering', label: 'Rendering', role: 'Builds the Rendering module' },
      { agent: 'dev-publishing', label: 'Publishing', role: 'Builds the Publishing module' },
    ],
  },
  {
    id: 'review',
    name: 'Review',
    color: '#c8794a',
    seats: [
      { agent: 'reviewer', label: 'Reviewer', role: 'Checks PRs against spec, story and boundaries' },
      { agent: 'tester', label: 'Tester', role: 'Runs the tests and checks spec coverage' },
    ],
  },
]
export const GOLD = '#b8924f'
export const ROSTER = UNITS.flatMap(u => u.seats.map(s => s.agent))
export const seatOf = (agent: string) => UNITS.flatMap(u => u.seats).find(s => s.agent === agent)
export const unitOf = (agent: string) =>
  UNITS.find(u => u.seats.some(s => s.agent === agent)) ?? (agent.startsWith('pr-review-toolkit') ? UNITS[3] : undefined)

const TEAM_COLOR: Record<string, string> = {
  'team:content': '#3fa384',
  'team:rendering': '#8a7bd6',
  'team:publishing': '#c8794a',
  'team:design': '#5b82c9',
  'team:factory': GOLD,
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

/* ---------- stories ---------- */

export const IN_FLIGHT = ['Ready', 'Spec review', 'Building', 'Agent review', 'Ready to merge']
const STAGE_LABEL = ['Ready', 'Spec', 'Build', 'Review', 'Merge']

// One story card: team, state, title, the five-stage track and who has it.
export function storyCard(w: number, card: Card, runs: AgentRun[], waiting: WaitItem[]): string {
  const h = 146
  const color = TEAM_COLOR[teamOf(card) ?? ''] ?? GOLD
  const stage = IN_FLIGHT.indexOf(card.status)
  const who = runs.find(r => !r.endedAt && r.story === card.number)
  const gate = waiting.find(item => card.prs.includes(item.url) || item.number === card.number)
  const title = wrap(card.title, Math.floor((w - 28) / 10.6), 2)
  const segW = (w - 28 - 4 * 4) / 5
  let body = `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="16" class="panel"/>
  <path d="M16 1 H${w - 16}" stroke="${color}" stroke-width="2"/>
  <text x="14" y="24" class="m" font-size="10" letter-spacing="1.6" fill="${color}">${esc((teamOf(card)?.slice(5) ?? 'story').toUpperCase())} · #${card.number}</text>
  <text x="${w - 14}" y="24" text-anchor="end" font-size="11.5" class="mu">${esc(card.status)}</text>
  ${title.map((line, k) => `<text x="14" y="${50 + k * 22}" class="d" font-size="20" font-weight="600">${esc(line)}</text>`).join('')}`
  STAGE_LABEL.forEach((label, k) => {
    const sx = 14 + k * (segW + 4)
    const fill = k <= stage ? color : 'var(--sunk)'
    body += `<rect x="${sx}" y="96" width="${segW}" height="3" rx="1.5" fill="${fill}" fill-opacity="${k === stage ? 0.55 : 1}"${k === stage && who ? ' class="beat"' : ''}/>
    <text x="${sx}" y="112" font-size="10" class="${k === stage ? '' : 'fa'}">${label}</text>`
  })
  const foot = who
    ? `<tspan fill="var(--ok)">●</tspan> ${esc(who.agent)} at work · ${ago(who.startedAt)}`
    : gate
      ? `<tspan class="go">●</tspan> Waiting on you · #${gate.number}`
      : card.status === 'Ready'
        ? 'Ready to run'
        : 'Between steps'
  body += `<line x1="14" x2="${w - 14}" y1="121" y2="121" stroke="var(--soft)"/>
  <text x="14" y="138" font-size="11.5" class="mu">${foot}</text>`
  return svg(w, h, body)
}

/* ---------- activity ---------- */

export function activity(w: number, runs: AgentRun[]): string {
  const events = runs
    .flatMap(run => {
      const unit = unitOf(run.agent)
      const color = unit?.color ?? GOLD
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
