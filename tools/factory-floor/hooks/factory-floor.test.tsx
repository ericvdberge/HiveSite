import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'factory-floor',
  component: 'Pane',
  requestId: 'factory-floor',
  props: {
    title: 'Factory Floor',
    isFocused: false,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const names = (...list: string[]) => ({ nodes: list.map(name => ({ name })) })
const ITEMS = [
  { status: { name: 'Backlog' }, linked: null, content: { number: 7, title: 'Pages API', url: 'https://github.com/o/r/issues/7', labels: names('type:story') } },
  { status: { name: 'Ready' }, linked: null, content: { number: 25, title: 'Factory Floor', url: 'https://github.com/o/r/issues/25', labels: names() } },
  {
    status: { name: 'Ready to merge' },
    linked: { pullRequests: { nodes: [{ url: 'https://github.com/o/r/pull/1' }] } },
    content: { number: 2, title: 'Agent factory', url: 'https://github.com/o/r/issues/2', labels: names() },
  },
]
const PRS = [
  { number: 1, title: 'chore(factory): add the agent factory', url: 'https://github.com/o/r/pull/1', headRefName: 'factory/bootstrap', isDraft: false, labels: names() },
  { number: 9, title: 'docs(spec): API-001 pages', url: 'https://github.com/o/r/pull/9', headRefName: 'spec/api-001', isDraft: false, labels: names() },
  { number: 10, title: 'feat(content): pages', url: 'https://github.com/o/r/pull/10', headRefName: 'story/7-pages', isDraft: true, labels: names() },
]
const BLOCKED = [{ number: 12, title: 'Stuck after three rounds', url: 'https://github.com/o/r/issues/12' }]
const FLOOR = {
  data: {
    repositoryOwner: { projectV2: { items: { pageInfo: { hasNextPage: false, endCursor: 'x' }, nodes: ITEMS } } },
    repository: { prs: { nodes: PRS }, blocked: { nodes: BLOCKED }, cases: { nodes: [] } },
  },
}
// 10:00 local, so a reset reads as a time of day.
const NOW = new Date(2026, 9, 28, 10, 0).getTime()

type Argv = readonly string[]
const viewed: unknown[] = []

// What the host says about GitHub and the pane; a test changes it as it goes.
type World = { remaining: number; resetMs: number; isShown: boolean }
const open = (): World => ({ remaining: 5000, resetMs: NOW + 3_600_000, isShown: true })

// Stands for the host: gh answers from the fixtures above, node moves a card.
function host(ran: Argv[], world: World) {
  return (argv: Argv) => {
    ran.push(argv)
    const out = (value: unknown) => ({ exitCode: 0, stdout: JSON.stringify(value), stderr: '', isStdoutTruncated: false, isStderrTruncated: false })
    if (argv[0] === 'git') return { ...out(''), stdout: '/repo\n' }
    if (argv[0] === 'node') return { ...out(''), stdout: `#${argv[3]} → Ready\n` }
    if (argv[2] === 'rate_limit') return out({ limit: 5000, remaining: world.remaining, reset: Math.floor(world.resetMs / 1000) })
    if (argv[2] === 'graphql') return out(FLOOR)
    return { ...out(''), exitCode: 1, stderr: `unexpected: ${argv.join(' ')}` }
  }
}

// The GraphQL reads among the commands run; rate_limit is REST.
const graphql = (ran: Argv[]) => ran.filter(a => a[0] === 'gh' && a[2] === 'graphql').length

async function start($: any, on: any, ran: Argv[], submitted: string[], world: World = open()) {
  on('command.register', () => ({ value: { command: 'factory-floor' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.panes', () => ({ value: [{ id: 'factory-floor', title: 'Factory Floor', isShown: world.isShown, isFocused: false, isPlaced: true }] }))
  const clock = mock.clock(on, { now: NOW })
  mock.store(on)
  on('fs.read', () => ({ value: JSON.stringify({ owner: 'o', repo: 'o/r', project: 8 }) }))
  on('process.run', (_: unknown, e: { argv: Argv }) => ({ value: host(ran, world)(e.argv) }))
  on('prompt.submit', (_: unknown, e: { text: string }) => {
    submitted.push(e.text)
    return { text: e.text }
  })
  on('classic.SubagentStop', () => ({}))
  on('turn.complete', (_: unknown, e: { answer: string }) => ({ text: e.answer }))
  on('ui.view', (_: unknown, e: unknown) => {
    viewed.push(e)
    return { value: {} }
  })
  on('prompt.fill', (_: unknown, e: { text: string }) => ({ value: { text: e.text, cursor: e.text.length } }))
  on('agent.spawn', () => ({ model: 'opus', agentId: 'a1' }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/repo', surface: 'desktop', isInteractive: true })
  await clock.settle()
  return clock
}

// The SVG drawings of the desktop layout, joined, to search their text.
async function drawings(ui: any): Promise<string> {
  const found = await ui.findAll({ type: 'Svg' })
  return found.map((one: any) => String(one.props.source)).join(' ')
}

const turn = ($: any) => $.turn.complete({ turnId: 't', answer: 'done', durationMs: 1, isAborted: false, reason: 'answer' })

test('the terminal pane lists the board and what waits on me', async ($, on) => {
  const ran: Argv[] = []
  await start($, on, ran, [])
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'refresh' })
  expect(await ui.find({ type: 'Text', text: /Waiting on me \(3\)/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Review & merge/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Backlog \(1\)/ })).toBeDefined()
  await ui.unmount()
})

test('desktop, vscode and mobile draw the Factory Floor look', async ($, on) => {
  await start($, on, [], [])
  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.press({ key: 'refresh' })
    const svg = await drawings(ui)
    expect(svg).toContain('Waiting on you')
    expect(svg).toContain('Factory Floor')
    expect(svg).toContain('#25')
    expect(await ui.find({ type: 'Text', text: /Needs you/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Pages API/ })).toBeDefined()
    await ui.unmount()
  }
})

test('Move to Ready runs board.mjs and Run sends the run-story prompt', async ($, on) => {
  const ran: Argv[] = []
  const submitted: string[] = []
  await start($, on, ran, submitted)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'refresh' })
  await ui.press({ key: 'ready-7' })
  expect(ran.some(a => a.join(' ') === 'node scripts/board.mjs move 7 Ready')).toBe(true)
  expect(await drawings(ui)).toContain('#7 → Ready')

  await ui.press({ key: 'run-next' })
  await ui.press({ key: 'run-25' })
  expect(submitted).toEqual([
    'Use the run-story skill to run the next story on the board.',
    'Use the run-story skill to run story #25.',
  ])
  await ui.unmount()
})

test('the organisation follows spawns and SubagentStop, and a person opens their file', async ($, on) => {
  viewed.length = 0
  await start($, on, [], [])
  await $.agent.spawn({ subagentType: 'api-architect', description: 'Spec for story #7', prompt: 'Draft the spec for #7' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'refresh' })
  expect((await ui.find({ key: 'agent-api-architect' }))?.text).toMatch(/on #7/)

  await ui.press({ key: 'agent-api-architect' })
  expect(await ui.find({ type: 'Text', text: /At work/ })).toBeDefined()
  await ui.press({ key: 'file-transcript' })
  expect(viewed).toEqual([{ agentId: 'a1' }])

  await $.classic.SubagentStop({
    agent_id: 'a1',
    agent_type: 'api-architect',
    agent_transcript_path: '',
    stop_hook_active: false,
    last_assistant_message: 'Opened spec PR #30.',
  })
  expect((await ui.find({ key: 'agent-api-architect' }))?.text).toMatch(/done/)
  expect(await ui.find({ type: 'Text', text: /Opened spec PR #30/ })).toBeDefined()
  expect(await drawings(ui)).toContain('api-architect finished on #7')

  const tty = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await tty.find({ type: 'Text', text: /done api-architect #7/ })).toBeDefined()
  await tty.unmount()
  await ui.unmount()
})

test('a refresh is one GraphQL read, after a free REST look at the budget', async ($, on) => {
  const ran: Argv[] = []
  await start($, on, ran, [])
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  ran.length = 0
  await ui.press({ key: 'refresh' })
  expect(ran.map(a => a.slice(0, 3).join(' '))).toEqual(['gh api rate_limit', 'gh api graphql'])
  await ui.unmount()
})

test('the board refreshes by itself every few minutes and after a turn, not more', async ($, on) => {
  const ran: Argv[] = []
  const clock = await start($, on, ran, [])
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(graphql(ran)).toBe(1)

  // A turn right after a read reuses it; one a minute later reads again.
  await turn($)
  await clock.settle()
  expect(graphql(ran)).toBe(1)
  await clock.advance(61_000)
  await turn($)
  await clock.settle()
  expect(graphql(ran)).toBe(2)

  // Quiet minutes: the timer reads once the read is five minutes old.
  await clock.advance(6 * 60_000)
  expect(graphql(ran)).toBe(3)
  await ui.unmount()
})

test('a busy hour stays far below the GraphQL budget', async ($, on) => {
  const ran: Argv[] = []
  const clock = await start($, on, ran, [])
  ran.length = 0
  // An hour with a turn and an agent ending every minute.
  for (let m = 0; m < 60; m++) {
    await turn($)
    await $.classic.SubagentStop({ agent_id: `a${m}`, agent_type: 'tester', agent_transcript_path: '', stop_hook_active: false })
    await clock.advance(60_000)
  }
  console.log(`busy hour: ${graphql(ran)} GraphQL reads, ${ran.length} gh calls in all`)
  expect(graphql(ran)).toBeLessThanOrEqual(60)
})

test('a hidden pane and an idle session read nothing', async ($, on) => {
  const ran: Argv[] = []
  const world: World = { ...open(), isShown: false }
  const clock = await start($, on, ran, [], world)
  const opened = graphql(ran)
  await clock.advance(60 * 60_000)
  await turn($)
  await clock.settle()
  expect(graphql(ran)).toBe(opened)

  // Shown again, the timer reads; with no turn for half an hour it stops.
  world.isShown = true
  await turn($)
  await clock.advance(5 * 60_000)
  expect(graphql(ran)).toBeGreaterThan(opened)
  await clock.advance(40 * 60_000)
  const idle = graphql(ran)
  await clock.advance(60 * 60_000)
  expect(graphql(ran)).toBe(idle)
})

test('overlapping refreshes share one read', async ($, on) => {
  const ran: Argv[] = []
  await start($, on, ran, [])
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  ran.length = 0
  await Promise.all([ui.press({ key: 'refresh' }), ui.press({ key: 'refresh' })])
  expect(graphql(ran)).toBe(1)
  await ui.unmount()
})

test('a low budget waits calmly until it resets', async ($, on) => {
  const ran: Argv[] = []
  const world: World = { remaining: 72, resetMs: NOW + 41 * 60_000, isShown: true }
  const clock = await start($, on, ran, [], world)
  const tty = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await tty.find({ type: 'Text', text: /Rate limited · retrying at 10:41/ })).toBeDefined()
  expect(await tty.find({ type: 'Text', text: /failed/ })).toBeUndefined()
  await tty.unmount()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await drawings(ui)).toContain('Rate limited · retrying at 10:41')
  expect(graphql(ran)).toBe(0)

  // Before the reset, turns, timers and presses do not even ask the budget.
  ran.length = 0
  await turn($)
  await clock.advance(20 * 60_000)
  await ui.press({ key: 'refresh' })
  expect(ran.length).toBe(0)

  // Past the reset the budget is back, and the board is read once.
  world.remaining = 5000
  await clock.advance(22 * 60_000)
  expect(graphql(ran)).toBe(1)
  expect(await drawings(ui)).not.toContain('Rate limited')
  await ui.unmount()
})
