import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AgentRun, Board, Card, Status, WaitItem } from '../types'
import { activity, ago, GOLD, IN_FLIGHT, masthead, ROSTER, seatOf, storyCard, UNITS } from './svg'

// The Factory Floor: the Hivesite board, what waits on the human, which
// factory agent runs on which story, and buttons that drive the factory.

const PANE = 'factory-floor'
const TITLE = 'Factory Floor'
const COLUMNS = ['Backlog', 'Ready', 'Spec review', 'Building', 'Agent review', 'Ready to merge', 'Done']
const TICK_MS = 5_000
// GitHub's GraphQL budget is 5,000 points an hour, shared with gh and the
// agents. A shown pane re-reads the board every few minutes, never while it
// is hidden or the session is idle, and backs off when the budget runs low.
const POLL_MS = 5 * 60_000
const CHECK_MS = 60_000
const SOFT_MS = 60_000
const IDLE_MS = 30 * 60_000
const RESERVE = 500
// Kept across sessions, so a second session reuses a fresh read.
const CACHE = 'board-cache'
const LIMITED = 'limited-until'

// Change a tag when that value's fields change: an older stored value is
// then read as the initial one instead of in the wrong shape.
const board = atom({ plugin: 'factory-floor', key: 'board' } as const, { cards: [], fetchedAt: 0 } as Board, {
  shape: 'board-1',
})
const waiting = atom({ plugin: 'factory-floor', key: 'waiting' } as const, [] as WaitItem[], { shape: 'waiting-1' })
const agents = atom({ plugin: 'factory-floor', key: 'agents' } as const, [] as AgentRun[], { shape: 'agents-1' })
const status = atom({ plugin: 'factory-floor', key: 'status' } as const, {} as Status, { shape: 'status-2' })
const tick = atom({ plugin: 'factory-floor', key: 'tick' } as const, 0, { shape: 'tick-1' })
const selected = atom({ plugin: 'factory-floor', key: 'selected' } as const, {} as { agent?: string }, { shape: 'selected-1' })

type Config = { owner: string; repo: string; project: number }
const DEFAULTS: Config = { owner: 'ericvdberge', repo: 'ericvdberge/HiveSite', project: 8 }

// Set at session start; a reload runs session.start again.
let cwd = '.'
let config = DEFAULTS

async function readConfig($: EngineInterface): Promise<Config | undefined> {
  try {
    const text = await $.fs.read(`${cwd}/.github/factory.json`)
    const json = JSON.parse(String(text)) as Partial<Config>
    return { ...DEFAULTS, ...json }
  } catch {
    return undefined
  }
}

async function gh($: EngineInterface, args: string[]): Promise<unknown> {
  const { exitCode, stdout, stderr } = await $.process.run(['gh', ...args], { cwd, timeoutMs: 60_000 })
  if (exitCode !== 0) throw new Error((stderr || stdout).trim().split('\n')[0] || `gh exited ${exitCode}`)
  return JSON.parse(stdout)
}

// The whole floor in one GraphQL query of a few points. `gh project
// item-list` asks for every field of every item, about 400 points a page.
const QUERY = `query($login: String!, $number: Int!, $owner: String!, $name: String!, $after: String) {
  repositoryOwner(login: $login) {
    ... on ProjectV2Owner {
      projectV2(number: $number) {
        items(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            status: fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
            linked: fieldValueByName(name: "Linked pull requests") {
              ... on ProjectV2ItemFieldPullRequestValue { pullRequests(first: 10) { nodes { url } } }
            }
            content {
              ... on Issue { number title url labels(first: 20) { nodes { name } } }
              ... on PullRequest { number title url labels(first: 20) { nodes { name } } }
            }
          }
        }
      }
    }
  }
  repository(owner: $owner, name: $name) {
    prs: pullRequests(states: OPEN, first: 100) {
      nodes { number title url headRefName isDraft labels(first: 20) { nodes { name } } }
    }
    blocked: issues(states: OPEN, labels: ["needs-human"], first: 100) { nodes { number title url } }
    cases: issues(states: OPEN, labels: ["type:case"], first: 100) {
      nodes { number title url labels(first: 20) { nodes { name } } }
    }
  }
}`

type Names = { nodes: { name: string }[] }
type ProjectItem = {
  status?: { name?: string } | null
  linked?: { pullRequests?: { nodes: { url: string }[] } } | null
  content?: { number?: number; title?: string; url?: string; labels?: Names } | null
}
type Pr = { number: number; title: string; url: string; headRefName: string; isDraft: boolean; labels: Names }
type Issue = { number: number; title: string; url: string; labels?: Names }
type Floor = {
  data: {
    repositoryOwner?: {
      projectV2?: { items: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: ProjectItem[] } } | null
    } | null
    repository: { prs: { nodes: Pr[] }; blocked: { nodes: Issue[] }; cases: { nodes: Issue[] } }
  }
}

async function fetchFloor($: EngineInterface): Promise<{ cards: Card[]; items: WaitItem[] }> {
  const [owner, name] = config.repo.split('/')
  const nodes: ProjectItem[] = []
  let first: Floor | undefined
  let after: string | undefined
  // A board over 100 cards takes a page more; the rest of the query is cheap.
  for (let page = 0; page < 10; page++) {
    const vars = ['-f', `login=${config.owner}`, '-F', `number=${config.project}`, '-f', `owner=${owner}`, '-f', `name=${name}`]
    if (after) vars.push('-f', `after=${after}`)
    const floor = (await gh($, ['api', 'graphql', '-f', `query=${QUERY}`, ...vars])) as Floor
    first ??= floor
    const items = floor.data.repositoryOwner?.projectV2?.items
    if (!items) throw new Error(`Project ${config.project} of ${config.owner} not found`)
    nodes.push(...items.nodes)
    if (!items.pageInfo.hasNextPage) break
    after = items.pageInfo.endCursor
  }
  const cards = nodes
    .filter(item => item.content?.number !== undefined)
    .map(item => ({
      number: item.content!.number!,
      title: item.content!.title ?? '',
      url: item.content!.url ?? '',
      status: item.status?.name ?? 'Backlog',
      labels: item.content!.labels?.nodes.map(l => l.name) ?? [],
      prs: item.linked?.pullRequests?.nodes.map(pr => pr.url) ?? [],
    }))
  const repo = first!.data.repository
  return { cards, items: waitingOf(cards, repo.prs.nodes, repo.blocked.nodes, repo.cases.nodes) }
}

function waitingOf(cards: Card[], prs: Pr[], blocked: Issue[], cases: Issue[]): WaitItem[] {
  const readyToMerge = new Set(cards.filter(c => c.status === 'Ready to merge').flatMap(c => c.prs))
  const items: WaitItem[] = []
  for (const pr of prs) {
    const labels = pr.labels.nodes.map(l => l.name)
    const branch = pr.headRefName
    if (branch.startsWith('spec/') || branch.startsWith('design/') || labels.includes('type:spec')) {
      items.push({ kind: 'approve', number: pr.number, title: pr.title, url: pr.url })
    } else if (!pr.isDraft && (branch.startsWith('story/') || labels.includes('ready') || readyToMerge.has(pr.url))) {
      items.push({ kind: 'merge', number: pr.number, title: pr.title, url: pr.url })
    }
  }
  for (const issue of blocked) items.push({ kind: 'needs-human', number: issue.number, title: issue.title, url: issue.url })
  for (const issue of cases) {
    if (!issue.labels?.nodes.some(l => l.name === 'approved')) {
      items.push({ kind: 'case', number: issue.number, title: issue.title, url: issue.url })
    }
  }
  return items
}

// The GraphQL budget left, read over REST, which costs no GraphQL points.
async function graphqlLeft($: EngineInterface): Promise<{ remaining: number; resetMs: number } | undefined> {
  try {
    const left = (await gh($, ['api', 'rate_limit', '--jq', '.resources.graphql'])) as { remaining: number; reset: number }
    return { remaining: left.remaining, resetMs: left.reset * 1000 }
  } catch {
    return undefined
  }
}

type Cache = { at: number; cards: Card[]; items: WaitItem[] }
// Why a refresh was asked: the timer, a turn or agent that ended, the pane
// opening, or the person's own press. Each takes a cached read this young.
type Why = 'poll' | 'event' | 'open' | 'press'
const MAX_AGE: Record<Why, number> = { poll: POLL_MS, open: POLL_MS, event: SOFT_MS, press: 0 }

let refreshing: Promise<void> | undefined
let lastActivity = 0
let lastAttempt = 0

async function isShown($: EngineInterface): Promise<boolean> {
  try {
    return (await $.ui.panes()).some(pane => pane.id === PANE && pane.isShown)
  } catch {
    return false
  }
}

async function active($: EngineInterface) {
  lastActivity = await $.clock.now()
}

function refresh($: EngineInterface, why: Why = 'press'): Promise<void> {
  // One refresh at a time; a second ask while one runs shares it.
  refreshing ??= reread($, why).finally(() => {
    refreshing = undefined
  })
  return refreshing
}

async function reread($: EngineInterface, why: Why) {
  const now = await $.clock.now()
  if (why === 'press') lastActivity = now
  // Nobody looks at a hidden pane, and an idle session moves nothing.
  if ((why === 'poll' || why === 'event') && !(await isShown($))) return
  if (why === 'poll' && now - lastActivity > IDLE_MS) return

  const cached = (await $.store.get(CACHE)) as Cache | undefined
  if (cached) {
    if (cached.at > (await read($, board)).fetchedAt) {
      await update($, board, () => ({ cards: cached.cards, fetchedAt: cached.at }))
      await update($, waiting, () => cached.items)
    }
    if (now - cached.at < MAX_AGE[why]) return
  }
  // A read that failed is not tried again by itself within the minute.
  if (why !== 'press' && now - lastAttempt < SOFT_MS) return

  const until = Number((await $.store.get(LIMITED)) ?? 0)
  if (until > now) return limited($, until)
  const left = await graphqlLeft($)
  if (left && left.remaining < RESERVE) return limited($, left.resetMs)

  lastAttempt = now
  await update($, status, s => ({ ...s, busy: 'Refreshing…' }))
  try {
    const { cards, items } = await fetchFloor($)
    const at = await $.clock.now()
    await $.store.set(CACHE, { at, cards, items } satisfies Cache)
    await update($, board, () => ({ cards, fetchedAt: at }))
    await update($, waiting, () => items)
    await update($, status, s => ({ ...s, busy: undefined, limitedUntil: undefined }))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/rate limit/i.test(message)) return limited($, (await graphqlLeft($))?.resetMs ?? now + POLL_MS)
    await update($, board, b => ({ ...b, error: message }))
    await update($, status, () => ({ note: `Refresh failed: ${message}`, isError: true }))
  }
}

// Waits out the budget calmly: the pane says when it reads again, and every
// session waits for the same time.
async function limited($: EngineInterface, until: number) {
  await $.store.set(LIMITED, until)
  await update($, status, s => ({ ...s, busy: undefined, limitedUntil: until }))
}

function clockTime(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function moveToReady($: EngineInterface, issue: number) {
  await update($, status, () => ({ busy: `Moving #${issue} to Ready…` }))
  const root = await $.process.run(['git', 'rev-parse', '--show-toplevel'], { cwd })
  const dir = root.exitCode === 0 ? root.stdout.trim() : cwd
  const run = await $.process.run(['node', 'scripts/board.mjs', 'move', String(issue), 'Ready'], {
    cwd: dir,
    timeoutMs: 120_000,
  })
  const ok = run.exitCode === 0
  const message = ok ? run.stdout.trim() : (run.stderr || run.stdout).trim().split('\n').pop()
  await update($, status, () => ({ note: ok ? message : `Move failed: ${message}`, isError: !ok }))
  if (ok) await refresh($)
}

async function runStory($: EngineInterface, issue?: number) {
  const text =
    issue === undefined
      ? 'Use the run-story skill to run the next story on the board.'
      : `Use the run-story skill to run story #${issue}.`
  await $.prompt.submit({ text, asUser: true })
  await update($, status, () => ({ note: issue === undefined ? 'Sent: run the next story' : `Sent: run #${issue}` }))
}

// A PR the human reviewed goes back to its team with their comments.
async function sendBack($: EngineInterface, pr: number) {
  await $.prompt.submit({
    text: `Use the run-story skill to send PR #${pr} back to its team with my review comments.`,
    asUser: true,
  })
  await update($, status, () => ({ note: `Sent back: PR #${pr}` }))
}

const isPr = (item: WaitItem) => item.kind === 'approve' || item.kind === 'merge'

async function openTranscript($: EngineInterface, agentId: string, agent: string) {
  const shown = await $.ui.view({ agentId })
  if (shown.deny) await update($, status, () => ({ note: `Cannot open ${agent}'s transcript: ${shown.deny}`, isError: true }))
}

async function askAgent($: EngineInterface, agent: string) {
  await $.prompt.fill({ text: `Use the ${agent} agent to `, mode: 'replace' })
}

function storyOf(text: string): number | undefined {
  const match = /(?:#|\bstory\s+|\bissue\s+)(\d+)/i.exec(text)
  return match ? Number(match[1]) : undefined
}

const WAIT_LABEL: Record<WaitItem['kind'], string> = {
  approve: 'Review & merge',
  merge: 'Merge',
  'needs-human': 'Needs you',
  case: 'Approve case',
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    cwd = e.cwd ?? '.'
    const found = await readConfig($)
    config = found ?? DEFAULTS
    await $.command.register({ name: 'factory-floor', description: 'Open the Factory Floor pane for the Hivesite board' })
    await active($)
    // Open by itself only in a checkout that has the factory.
    if (found) {
      void $.ui.open({ id: PANE, title: TITLE })
      void refresh($, 'open')
    }
    // A tick redraws the ages and live marks. Each minute the board is re-read
    // if it is older than POLL_MS, the pane is shown and the session not idle;
    // a turn or an agent that ends re-reads one older than a minute.
    $.clock.every(TICK_MS, () => void update($, tick, n => (n + 1) % 1_000_000))
    $.clock.every(CHECK_MS, () => void refresh($, 'poll'))
    return started
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    await active($)
    // Subagents' turns end too; SubagentStop already refreshes for those.
    if (!e.agentId) void refresh($, 'event')
    return done
  })

  on('command.run', { command: 'factory-floor' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    await active($)
    void refresh($, 'open')
    return { text: 'Factory Floor opened.' }
  })

  // A spawn names the agent type and carries the story in its prompt;
  // SubagentStart/Stop say when that agent really runs and ends.
  on('agent.spawn', async ($, e, next) => {
    if (e.fork && !e.subagentType) return next(e)
    await active($)
    const run: AgentRun = {
      id: e.tool_use_id,
      agent: e.subagentType,
      story: storyOf(`${e.description} ${e.prompt}`),
      description: e.description,
      startedAt: Date.now(),
    }
    await update($, agents, list => [...list, run].slice(-50))
    const spawned = await next(e)
    await update($, agents, list =>
      list.map(one => {
        if (one.id !== run.id) return one
        if (spawned.deny) return { ...one, endedAt: Date.now() }
        return { ...one, agentId: one.agentId ?? spawned.agentId ?? spawned.teammateId }
      }),
    )
    return spawned
  })

  on('classic.SubagentStart', async ($, e, next) => {
    await active($)
    await update($, agents, list => {
      if (list.some(one => one.agentId === e.agent_id)) return list
      const index = list.findLastIndex(one => one.agent === e.agent_type && !one.agentId && !one.endedAt)
      if (index >= 0) return list.map((one, i) => (i === index ? { ...one, agentId: e.agent_id } : one))
      const run: AgentRun = { id: e.agent_id, agentId: e.agent_id, agent: e.agent_type, description: '', startedAt: Date.now() }
      return [...list, run].slice(-50)
    })
    return next(e)
  })

  on('classic.SubagentStop', async ($, e, next) => {
    await update($, agents, list =>
      list.map(one =>
        one.agentId === e.agent_id && !one.endedAt
          ? { ...one, endedAt: Date.now(), lastMessage: e.last_assistant_message?.slice(0, 2000) }
          : one,
      ),
    )
    // An agent that ends has usually moved a card or opened a PR.
    await active($)
    void refresh($, 'event')
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { cards, fetchedAt, error } = await read($, board)
    const items = await read($, waiting)
    const runs = await read($, agents)
    const { busy, note, isError, limitedUntil } = await read($, status)
    // Read so the pane redraws on every tick: ages and live marks move.
    await read($, tick)

    const running = runs.filter(r => !r.endedAt)
    const backlog = cards.filter(c => c.status === 'Backlog')
    const ready = cards.filter(c => c.status === 'Ready')
    const wait = limitedUntil && limitedUntil > Date.now() ? `Rate limited · retrying at ${clockTime(limitedUntil)}` : undefined
    const line =
      busy ?? wait ?? note ?? (fetchedAt ? `Updated ${ago(fetchedAt)} ago · every ${POLL_MS / 60_000} min while shown` : 'Loading the board…')

    // Desktop, VS Code and mobile: the Factory Floor look. Pictures are SVG;
    // everything that takes a click is a native element.
    if (e.surface !== 'terminal') {
      const { Box, Text, Button, Link, Svg } = $.ui.resolve(e)
      const { agent: open } = await read($, selected)
      const w = Math.max(320, Math.min(760, Math.round((e.props.bodyColumns ?? 60) * 7.5)))
      const figures = {
        waiting: items.length,
        atWork: running.length,
        agents: ROSTER.length,
        inFlight: cards.filter(c => IN_FLIGHT.includes(c.status)).length,
        shipped: cards.filter(c => c.status === 'Done').length,
      }
      const select = (agent: string | undefined) => update($, selected, () => ({ agent }))
      const heading = (title: string, hint: string) => (
        <Box flexDirection="row" justifyContent="space-between">
          <Text size="heading" weight="medium">
            {title}
          </Text>
          <Text size="footnote" dimColor>
            {hint}
          </Text>
        </Box>
      )
      const row = (card: Card, action: 'ready' | 'run') => (
        <Box flexDirection="row" gap={1}>
          <Link href={card.url} label={`#${card.number}`} />
          <Box flexGrow={1} flexShrink={1}>
            <Text wrap="truncate">{card.title}</Text>
          </Box>
          {action === 'ready' ? (
            <Button key={`ready-${card.number}`} label="→ Ready" onPress={() => moveToReady($, card.number)} />
          ) : (
            <Button key={`run-${card.number}`} label="Run" variant="primary" onPress={() => runStory($, card.number)} />
          )}
        </Box>
      )

      // One person on the floor: a dot that is green while they work, their
      // name, and what they are on. Pressing opens their file.
      const person = (agent: string, label: string, color: string) => {
        const atWork = running.filter(r => r.agent === agent)
        const last = runs.filter(r => r.agent === agent).at(-1)
        const story = atWork.find(r => r.story)?.story
        const state = atWork.length ? (story ? `on #${story} · ${ago(atWork[0]!.startedAt)}` : `at work · ${ago(atWork[0]!.startedAt)}`) : last?.endedAt ? `done ${ago(last.endedAt)} ago` : 'idle'
        return (
          <Button key={`agent-${agent}`} variant={open === agent ? 'primary' : 'secondary'} onPress={() => select(open === agent ? undefined : agent)}>
            <Text color={atWork.length ? '#3fa384' : color} bold>
              {atWork.length ? '●' : '○'}
            </Text>{' '}
            {label} <Text dimColor>{state}</Text>
          </Button>
        )
      }

      // The open file: who they are, what they do now, what they said last.
      const file = (agent: string) => {
        const seat = seatOf(agent)
        const mine = runs.filter(r => r.agent === agent)
        const now = mine.filter(r => !r.endedAt)
        const latest = mine.at(-1)
        const said = [...mine].reverse().find(r => r.lastMessage)?.lastMessage
        return (
          <Box flexDirection="column" gap={1} borderStyle="round" borderColor={GOLD} paddingX={2} paddingY={1}>
            <Box flexDirection="row" justifyContent="space-between">
              <Text size="title" weight="medium">
                {seat?.label ?? agent}
              </Text>
              <Button key="file-close" label="Close" role="dismiss" onPress={() => select(undefined)} />
            </Box>
            <Text dimColor>
              {agent}
              {seat ? ` · ${seat.role}` : ''}
            </Text>
            {now.length > 0 ? (
              now.map(run => (
                <Text>
                  <Text color="#3fa384">● At work</Text>
                  {run.story ? ` on #${run.story}` : ''} for {ago(run.startedAt)}
                  {run.description ? ` · ${run.description}` : ''}
                </Text>
              ))
            ) : (
              <Text dimColor>{latest?.endedAt ? `Idle · last finished ${ago(latest.endedAt)} ago` : 'Idle · not started in this session'}</Text>
            )}
            {said && (
              <Box flexDirection="column">
                <Text size="footnote" dimColor>
                  LAST SAID
                </Text>
                <Text wrap="wrap">{said.length > 600 ? `${said.slice(0, 599)}…` : said}</Text>
              </Box>
            )}
            {mine.length > 1 && (
              <Box flexDirection="column">
                <Text size="footnote" dimColor>
                  RECENT RUNS
                </Text>
                {[...mine].reverse().slice(0, 4).map(run => (
                  <Text dimColor wrap="truncate">
                    {ago(run.startedAt)} ago{run.story ? ` · #${run.story}` : ''} · {run.description || run.agent}
                    {run.endedAt ? '' : ' · running'}
                  </Text>
                ))}
              </Box>
            )}
            <Box flexDirection="row" gap={1} flexWrap="wrap">
              {latest?.agentId && (
                <Button
                  key="file-transcript"
                  label={now.length ? 'Watch live' : 'Open transcript'}
                  variant="primary"
                  onPress={() => openTranscript($, latest.agentId!, agent)}
                />
              )}
              <Button key="file-ask" label={`Ask ${seat?.label ?? agent}…`} onPress={() => askAgent($, agent)} />
            </Box>
          </Box>
        )
      }

      const extra = running.filter(r => !ROSTER.includes(r.agent))

      return (
        <Box flexDirection="column" gap={2}>
          <Svg
            alt={`The Agent Factory: ${figures.waiting} waiting on you, ${figures.atWork} agents at work`}
            source={masthead(w, figures, line, Boolean(busy))}
            isInteractive
          />
          <Box flexDirection="row" gap={1}>
            <Button key="run-next" label="Run next story" variant="primary" onPress={() => runStory($)} />
            <Button key="refresh" label="Refresh" onPress={() => refresh($)} />
          </Box>
          {isError && <Text color="red">{note}</Text>}

          <Box flexDirection="column" gap={1}>
            {heading('Waiting on you', 'Merge, or send back with your comments')}
            {items.length === 0 && <Text dimColor>Nothing waits on you.</Text>}
            {items.map(item => (
              <Box flexDirection="row" gap={1}>
                <Link href={item.url} label={`#${item.number}`} />
                <Text color={GOLD}>{WAIT_LABEL[item.kind]}</Text>
                <Box flexGrow={1} flexShrink={1}>
                  <Text wrap="truncate">{item.title}</Text>
                </Box>
                {isPr(item) && <Button key={`send-back-${item.number}`} label="Send back" onPress={() => sendBack($, item.number)} />}
              </Box>
            ))}
          </Box>

          <Box flexDirection="column" gap={1}>
            {heading('Organisation', running.length ? `${running.length} at work` : 'Click someone to open their file')}
            <Text>
              <Text color={running.length ? '#3fa384' : GOLD} bold>
                {running.length ? '●' : '○'}
              </Text>{' '}
              <Text weight="semibold">Manager</Text>
              <Text dimColor> · run-story in this chat · {running.length ? 'directing' : 'waiting for Run next story'}</Text>
            </Text>
            {UNITS.map(unit => (
              <Box key={`unit-${unit.id}`} flexDirection="column" gap={1} borderStyle="round" borderColor={unit.color} paddingX={1}>
                <Text color={unit.color} size="caption" weight="semibold">
                  {unit.name.toUpperCase()}
                </Text>
                <Box flexDirection="row" flexWrap="wrap" gap={1}>
                  {unit.seats.map(seat => person(seat.agent, seat.label, unit.color))}
                </Box>
              </Box>
            ))}
            {extra.length > 0 && (
              <Box flexDirection="row" flexWrap="wrap" gap={1}>
                {[...new Set(extra.map(r => r.agent))].map(agent => person(agent, agent, GOLD))}
              </Box>
            )}
            {open && file(open)}
          </Box>

          <Box flexDirection="column" gap={1}>
            {heading('Stories', 'Where each story stands')}
            {cards.filter(c => IN_FLIGHT.includes(c.status)).length === 0 && (
              <Text dimColor>Nothing in flight. Move a Backlog story to Ready, then run it.</Text>
            )}
            {cards
              .filter(c => IN_FLIGHT.includes(c.status))
              .sort((a, b) => IN_FLIGHT.indexOf(b.status) - IN_FLIGHT.indexOf(a.status))
              .map(card => {
                const who = running.find(r => r.story === card.number)
                return (
                  <Box flexDirection="column">
                    <Svg alt={`#${card.number} ${card.title}: ${card.status}`} source={storyCard(w, card, runs, items)} isInteractive />
                    <Box flexDirection="row" gap={1} paddingX={1}>
                      <Link href={card.url} label={`Issue #${card.number}`} />
                      {card.prs.map(url => (
                        <Link href={url} label={`PR #${url.split('/').pop()}`} />
                      ))}
                      {who && (
                        <Button key={`story-agent-${card.number}`} label={`Open ${who.agent}`} onPress={() => select(who.agent)} />
                      )}
                      {card.status === 'Ready' && (
                        <Button key={`story-run-${card.number}`} label="Run" variant="primary" onPress={() => runStory($, card.number)} />
                      )}
                    </Box>
                  </Box>
                )
              })}
          </Box>

          <Box flexDirection="column" gap={1}>
            {heading(`Ready (${ready.length})`, 'Run one, or the next')}
            {ready.length === 0 && <Text dimColor>Nothing is Ready. Move a Backlog story up.</Text>}
            {ready.map(card => row(card, 'run'))}
          </Box>
          <Box flexDirection="column" gap={1}>
            {heading(`Backlog (${backlog.length})`, 'Top goes first')}
            {error && cards.length === 0 && <Text color="red">{error}</Text>}
            {backlog.map(card => row(card, 'ready'))}
          </Box>

          <Svg alt="Agent activity, newest first" source={activity(w, runs)} />
        </Box>
      )
    }

    const { Box, Text, Button, Link } = $.ui.resolve(e)
    const finished = runs.filter(r => r.endedAt).slice(-5).reverse()

    const section = (title: string) => (
      <Text weight="semibold" bold>
        {title}
      </Text>
    )
    const cardRow = (card: Card) => (
      <Box flexDirection="row" gap={1}>
        <Link href={card.url} label={`#${card.number}`} />
        <Box flexGrow={1} flexShrink={1}>
          <Text wrap="truncate">{card.title}</Text>
        </Box>
        {card.status === 'Backlog' && (
          <Button key={`ready-${card.number}`} label="→ Ready" onPress={() => moveToReady($, card.number)} />
        )}
        {card.status === 'Ready' && (
          <Button key={`run-${card.number}`} label="Run" onPress={() => runStory($, card.number)} />
        )}
      </Box>
    )

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" gap={1}>
          <Button key="run-next" label="Run next story" variant="primary" onPress={() => runStory($)} />
          <Button key="refresh" label="Refresh" onPress={() => refresh($)} />
        </Box>
        <Text dimColor color={isError ? 'red' : undefined} wrap="wrap">
          {line}
        </Text>

        <Box flexDirection="column">
          {section(`Waiting on me (${items.length})`)}
          {items.length === 0 && <Text dimColor>Nothing waits on you.</Text>}
          {items.map(item => (
            <Box flexDirection="row" gap={1}>
              <Link href={item.url} label={`#${item.number}`} />
              <Text dimColor>{WAIT_LABEL[item.kind]}</Text>
              <Box flexGrow={1} flexShrink={1}>
                <Text wrap="truncate">{item.title}</Text>
              </Box>
              {isPr(item) && <Button key={`send-back-${item.number}`} label="Send back" onPress={() => sendBack($, item.number)} />}
            </Box>
          ))}
        </Box>

        <Box flexDirection="column">
          {section(`Agents now (${running.length})`)}
          {running.length === 0 && <Text dimColor>No agent is running.</Text>}
          {running.map(run => (
            <Text wrap="truncate">
              <Text bold>{run.agent}</Text>
              {run.story ? ` on #${run.story}` : ''} · {ago(run.startedAt)} {run.description && `· ${run.description}`}
            </Text>
          ))}
          {finished.map(run => (
            <Text dimColor wrap="truncate">
              done {run.agent}
              {run.story ? ` #${run.story}` : ''} · {ago(run.endedAt!)} ago
            </Text>
          ))}
        </Box>

        {error && cards.length === 0 && <Text color="red">{error}</Text>}
        {COLUMNS.map(column => {
          const inColumn = cards.filter(c => c.status === column)
          return (
            <Box flexDirection="column">
              {section(`${column} (${inColumn.length})`)}
              {column === 'Done'
                ? inColumn.length > 0 && <Text dimColor>{inColumn.length} done</Text>
                : inColumn.map(cardRow)}
            </Box>
          )
        })}
      </Box>
    )
  })
}
