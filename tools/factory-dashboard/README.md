# Factory Dashboard

One page that answers one question first: what needs you next. GitHub holds the work: issues, the project board, PRs and git. Claude does the work: every button that needs thinking starts the `manager` agent headless in this repository, and it runs the other agents as usual. No other ticket store, and no GitHub AI.

```bash
node tools/factory-dashboard/serve.mjs
```

Open http://localhost:4310. In the Claude desktop app you can open it in the browser pane, from the `factory-dashboard` entry in `.claude/launch.json`.

Needs `gh` signed in with the `project` scope (`gh auth refresh -s project`) and the `claude` CLI on the PATH, signed in (`claude auth login`). There's nothing to install.

## The page

The sidebar holds the four views (with the number waiting on you), the manager's state, **Run next story** and **Message the manager**. On a phone it folds into a bar at the top.

1. **Your turn.** Everything waiting on you, most urgent first. The top item is open.
   - Ranking: the factory asked you something (`needs-human`), then a run that failed, then a spec or design to approve (it blocks building), then a build PR to merge, then a case to approve.
   - Each item has one box for your thoughts and two buttons:
     - **Approve** (or **Merge**). It merges the PR, or labels the case `approved`, and the factory goes on by itself. After a spec it runs the story again; after a case, pm writes the stories.
     - **Send back with my notes** (or **Send and continue**). It posts your words to GitHub, as a review on the PR or a comment on the issue, then starts the manager to act on them.
   - Ctrl+Enter sends. With nothing waiting, it shows what's next up and a button to run it.
2. **Agents.** One tile per team, showing who's working on which issue right now, and the recent manager runs. Click a run to follow its log live, or to stop it.
3. **Portfolio.** The plan's phases with everything under them, nested by GitHub sub-issues.
4. **Board.** The GitHub columns. Gold edges wait on you.

Click any item to open it on the right:
- where it is in run-story,
- the same box for your thoughts,
- the issue and its comments,
- the spec (read from the spec PR's branch while it's in review),
- the PR diff. Click a line number to post a review comment on that line to GitHub.

The sidebar's **Message the manager** is for anything else ("what's blocking #17?", "split #13").

## Where the state comes from

| Shown as | Comes from |
|---|---|
| Your turn: spec / design | The card is in Spec review and has an open PR |
| Your turn: merge | The card is in Ready to merge |
| Your turn: case | A `type:case` issue without the `approved` label |
| Needs you | The `needs-human` label |
| Run failed | The last dashboard run for that issue failed in the last 3 days |
| Working, and who | A manager run started here, and the subagent it's running on that issue |
| Done | A closed issue, even if its card wasn't moved. A banner offers to sync the board. |

Work started from a Claude chat isn't shown as *working*. You see it in the issue's comments and in the columns it moves.

## What each button runs

| Button | Runs |
|---|---|
| Approve and merge / Merge | `gh pr merge --squash --delete-branch`, `node scripts/board.mjs sync`, then run-story for the story after a spec |
| Approve case | `gh issue edit --add-label approved`, then pm writes the stories |
| Send back with my notes | `gh pr review --comment`, then the manager with run-story's *Send back* section |
| Send and continue | `gh issue comment`, then the manager continues the story with your comment |
| Comment on a line | A review comment on the PR, through the GitHub API |
| Run next story / Run this story | The manager: "Use the run-story skill to run …" |
| New story | The manager, using write-story, puts it in Backlog |
| Message the manager | The manager, with your words |
| Column | `node scripts/board.mjs move` |
| Sync board | `node scripts/board.mjs sync` |

One story runs at a time, as run-story asks. Anything else that would start a second story run waits in a queue and starts when the running one ends; you can stop it while it waits. Messages run alongside.

Merging and approving are human gates. The server only does them when you press the button, never because an agent asked.

## Signing in Claude

Runs use your own `claude` CLI login, not the desktop app's.

```bash
claude auth login
```

Run it once in an ordinary terminal (not inside a Claude session) and sign in with the account the agents should use. The CLI refreshes the login by itself after that.

The server removes the desktop app's session variables (`CLAUDECODE`, `CLAUDE_CODE_*`, …) before it starts `claude`. Inherited, they make the CLI wait for the app to refresh its login, and headless runs fail with "OAuth session expired". The page shows a banner while the CLI isn't signed in, and refuses to start runs or post feedback until it is.

For a login that never needs a browser, create a long-lived token with `claude setup-token` and set `CLAUDE_CODE_OAUTH_TOKEN` in the environment you start the server from. The server passes that variable on.

## Headless permissions

A headless run can't ask you for approval. It runs with `--permission-mode acceptEdits` and these tools: `git`, `gh`, `dotnet`, `node scripts/board.mjs`, `node scripts/spec-index.mjs`, file reads and edits, subagents and skills. The deny rules in `.claude/settings.json` still apply, so agents can't merge or push to `main`.

Environment variables:
- `FACTORY_PERMISSION_MODE` changes the mode.
- `FACTORY_PORT` changes the port.

A run's log shows its session, so you can continue it in a terminal with `claude --resume <session>`.

## Files

- `serve.mjs`: the local server.
  - Reads GitHub with one GraphQL query of about 2 points, reused for 15 seconds.
  - Runs `gh` and the board script.
  - Starts, queues and stops `claude` runs, and keeps their logs and a short action log in `.runs/`, which git ignores.
- `index.html`: the page, in the Hivesite brand. It re-reads the board every minute while it's visible, after every action, and when a run ends.

The server listens on 127.0.0.1 only and refuses POST requests from other origins.
