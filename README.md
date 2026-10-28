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
