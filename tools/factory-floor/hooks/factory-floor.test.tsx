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

const ITEMS = {
  items: [
    { status: 'Backlog', labels: ['type:story'], content: { number: 7, title: 'Pages API', url: 'https://github.com/o/r/issues/7' } },
    { status: 'Ready', labels: [], content: { number: 25, title: 'Factory Floor', url: 'https://github.com/o/r/issues/25' } },
    {
      status: 'Ready to merge',
      labels: [],
      'linked pull requests': ['https://github.com/o/r/pull/1'],
      content: { number: 2, title: 'Agent factory', url: 'https://github.com/o/r/issues/2' },
    },
  ],
}
const PRS = [
  { number: 1, title: 'chore(factory): add the agent factory', url: 'https://github.com/o/r/pull/1', headRefName: 'factory/bootstrap', isDraft: false, labels: [] },
  { number: 9, title: 'docs(spec): API-001 pages', url: 'https://github.com/o/r/pull/9', headRefName: 'spec/api-001', isDraft: false, labels: [] },
  { number: 10, title: 'feat(content): pages', url: 'https://github.com/o/r/pull/10', headRefName: 'story/7-pages', isDraft: true, labels: [] },
]
const BLOCKED = [{ number: 12, title: 'Stuck after three rounds', url: 'https://github.com/o/r/issues/12' }]

type Argv = readonly string[]
const viewed: unknown[] = []

// Stands for the host: gh answers from the fixtures above, node moves a card.
function host(ran: Argv[]) {
  return (argv: Argv) => {
    ran.push(argv)
    const out = (value: unknown) => ({ exitCode: 0, stdout: JSON.stringify(value), stderr: '', isStdoutTruncated: false, isStderrTruncated: false })
    if (argv[0] === 'git') return { ...out(''), stdout: '/repo\n' }
    if (argv[0] === 'node') return { ...out(''), stdout: `#${argv[3]} → Ready\n` }
    if (argv[1] === 'project') return out(ITEMS)
    if (argv[1] === 'pr') return out(PRS)
    if (argv.includes('needs-human')) return out(BLOCKED)
    return out([])
  }
}

async function start($: any, on: any, ran: Argv[], submitted: string[]) {
  on('command.register', () => ({ value: { command: 'factory-floor' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  const clock = mock.clock(on)
  on('fs.read', () => ({ value: JSON.stringify({ owner: 'o', repo: 'o/r', project: 8 }) }))
  on('process.run', (_: unknown, e: { argv: Argv }) => ({ value: host(ran)(e.argv) }))
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
  return clock
}

// The SVG drawings of the desktop layout, joined, to search their text.
async function drawings(ui: any): Promise<string> {
  const found = await ui.findAll({ type: 'Svg' })
  return found.map((one: any) => String(one.props.source)).join(' ')
}

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

test('the board refreshes by itself on a timer and after a turn', async ($, on) => {
  const ran: Argv[] = []
  const clock = await start($, on, ran, [])
  const reads = () => ran.filter(a => a[1] === 'project').length
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'refresh' })
  const before = reads()

  await clock.advance(30_000)
  await clock.settle()
  expect(reads()).toBeGreaterThan(before)

  const afterTimer = reads()
  await $.turn.complete({ turnId: 't1', answer: 'done', durationMs: 1, isAborted: false, reason: 'answer' })
  await clock.settle()
  expect(reads()).toBeGreaterThan(afterTimer)
  await ui.unmount()
})
