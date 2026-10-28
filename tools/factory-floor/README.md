# Factory Floor

A mod for the Claude desktop app (Code tab) that runs the Hivesite agent factory from a pane beside the chat.

On desktop it is drawn in the look of the Agent Factory Floor page: a masthead with four figures, the organisation web (manager, then the four teams with each agent lit up while it runs and the story it is on), story cards with a Ready → Spec → Build → Review → Merge track, and an activity feed. A terminal gets the same content as plain rows.

- **Waiting on me**: spec and design PRs to review and merge, build PRs ready to merge, `needs-human` issues and unapproved cases, each linked.
- **Agents now**: which subagent (`.claude/agents/*`) runs on which story, fed by the `agent.spawn`, `SubagentStart` and `SubagentStop` hooks.
- **Board**: the columns of the project named in `.github/factory.json`, with story cards.
- **Actions**: *Run next story* and *Run* on a Ready card send a `run-story` prompt to this session; *→ Ready* on a Backlog card runs `node scripts/board.mjs move <issue> Ready`.

The pane opens by itself in a checkout that has `.github/factory.json`; elsewhere type `/factory-floor`. It refreshes every minute, when an agent stops, and on *Refresh*. It needs `gh` signed in with the `project` scope.

Files: `hooks/register.tsx` (the hooks module), `hooks/svg.ts` (the desktop drawings), `types/index.d.ts` (its state), `hooks/factory-floor.test.tsx` (run with `claude plugin test tools/factory-floor`). See the repository README for installing it.
