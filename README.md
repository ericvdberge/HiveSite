# Hivesite

*Crafted by many. Made for you.*

A block-based website builder, designed and built by a team of AI agents in Claude Code. Humans approve cases, specs and merges; agents do the rest.

- **Plan:** [docs/plan.html](docs/plan.html)
- **House rules:** [CLAUDE.md](CLAUDE.md)
- **API specs:** [specs/](specs/README.md)
- **Decisions:** [docs/adr/](docs/adr/)

## The agent factory

| Agent | Job |
|---|---|
| `manager` | Runs one story at a time through the board; stops at human gates |
| `rnd-analyst` | Finds and sizes business cases |
| `pm` | Acceptance criteria and tasks |
| `api-architect` | API specs in `specs/` |
| `designer` | Tokens, themes and block layouts in `design/` |
| `dev-content` · `dev-rendering` · `dev-publishing` | Build one module each |
| `reviewer` · `tester` | Check PRs against spec, story and boundaries |

General code review comes from Anthropic's `pr-review-toolkit`; .NET, API-design, UI and market-sizing skills come from [wshobson/agents](https://github.com/wshobson/agents). Our agents only add the Hivesite process on top.

## Getting started

```bash
gh auth refresh -s project                     # once: lets gh manage the board
node scripts/setup-github.mjs ericvdberge/HiveSite
claude --agent manager                         # "run the next story"
```

Open Claude Code in this folder and accept the plugin prompts from `.claude/settings.json`.

## Factory Floor (Claude desktop app)

[`tools/factory-floor/`](tools/factory-floor/README.md) is a mod for the Claude desktop app's Code tab: a pane beside the chat with the board, what waits on you, which agent runs on which story, and buttons for *Run next story*, *Run #N* and *→ Ready*. It needs `gh` with the `project` scope (see above).

Install it once, from a shell in this folder:

```bash
claude plugin marketplace add ./tools/factory-floor
```

```bash
claude plugin install factory-floor@hivesite
```

The marketplace is a folder, so the installed mod is read from `tools/factory-floor/` itself: pull or edit it, then start a new session (or run `/reload-plugins` in a terminal session) to pick up the change. To load it straight from the folder instead, add `"CLAUDE_CODE_PLUGIN_DIRS": "<path to this repo>/tools/factory-floor"` under `env` in `~/.claude/settings.json`.

In a session opened on this repo the pane opens by itself; anywhere else type `/factory-floor`. Test it with `claude plugin test tools/factory-floor`.
