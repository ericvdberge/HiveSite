// A story or task on the GitHub project board.
export type Card = {
  number: number
  title: string
  url: string
  status: string
  labels: string[]
  prs: string[]
}

export type Board = { cards: Card[]; fetchedAt: number; error?: string }

// Something only a human can move on: approve a spec/design PR or a case,
// merge a build PR, or unblock a needs-human item.
export type WaitItem = {
  kind: 'approve' | 'merge' | 'needs-human' | 'case'
  number: number
  title: string
  url: string
}

// One subagent run, from the Agent tool call and SubagentStart/Stop hooks.
export type AgentRun = {
  id: string
  agentId?: string
  agent: string
  story?: number
  description: string
  startedAt: number
  endedAt?: number
  // What the agent said last, from SubagentStop.
  lastMessage?: string
}

// What the pane says it is doing or last did.
export type Status = { busy?: string; note?: string; isError?: boolean }

declare module 'claude-code' {
  interface PluginState {
    'factory-floor': {
      board: Shaped<Board>
      waiting: Shaped<WaitItem[]>
      agents: Shaped<AgentRun[]>
      status: Shaped<Status>
      // Bumped every few seconds so ages and the live dot redraw.
      tick: Shaped<number>
      // The agent whose file is open in the pane.
      selected: Shaped<{ agent?: string }>
    }
  }
}
