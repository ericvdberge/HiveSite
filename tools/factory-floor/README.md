# Factory Floor

A mod for the Claude desktop app (Code tab) that runs the Hivesite agent factory from a pane beside the chat.

On desktop it is drawn in the look of the Agent Factory Floor page: a masthead with four figures, the organisation (the four teams as cards; each person lights up while they run and shows the story they are on, and clicking one opens their file with what they are doing, what they said last, *Watch live* / *Open transcript* and *Ask…*), story cards with a Ready → Spec → Build → Review → Merge track and their issue and PR links, and an activity feed. It redraws every 5 seconds. A terminal gets the same content as plain rows.

- **Waiting on me**: spec and design PRs to review and merge, build PRs ready to merge, `needs-human` issues and unapproved cases, each linked. Each PR has *Send back*: after you leave review comments on GitHub, it asks the manager (`run-story`) to hand the PR back to its team, which fixes the comments on the same branch and replies on the PR.
- **Agents now**: which subagent (`.claude/agents/*`) runs on which story, fed by the `agent.spawn`, `SubagentStart` and `SubagentStop` hooks.
- **Board**: the columns of the project named in `.github/factory.json`, with story cards.
- **Actions**: *Run next story* and *Run* on a Ready card send a `run-story` prompt to this session; *→ Ready* on a Backlog card runs `node scripts/board.mjs move <issue> Ready`.

The pane opens by itself in a checkout that has `.github/factory.json`; elsewhere type `/factory-floor`. It needs `gh` signed in with the `project` scope.

**GitHub budget.** The board, open PRs and waiting issues come from one GraphQL query of about 5 points (`gh project item-list` costs about 400 a page). While the pane is shown it re-reads every 5 minutes, and after a turn or an agent stop when the read is over a minute old. It reads nothing while the pane is hidden or after 30 minutes without a turn. Reads are shared through the mod's store, so a second session reuses a fresh one, and overlapping refreshes share one read. Before each read it checks `gh api rate_limit` (REST, free); under 500 GraphQL points left, it waits for the reset and says *Rate limited · retrying at HH:MM*.

Files: `hooks/register.tsx` (the hooks module), `hooks/svg.ts` (the desktop drawings), `types/index.d.ts` (its state), `hooks/factory-floor.test.tsx` (run with `claude plugin test tools/factory-floor`). See the repository README for installing it.
