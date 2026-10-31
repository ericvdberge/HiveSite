---
name: run-story
description: The agent factory's playbook for taking GitHub stories from Backlog or Ready to pull requests a human can merge, one at a time, until everything waits on a human. Use when asked to run, continue or check a story, or to run the next one on the board.
---

# Run a story

One story moves through fixed steps. Each step has one owner, one output, and a board column. Humans own the gates after Ready; agents never pass a gate on their behalf.

```
Backlog ─(manager or human)→ Ready → Spec review ─(human merges spec PR)→ Building → Agent review → Ready to merge ─(human merges)→ Done
```

| Column | Owner | Output | Leaves when |
|---|---|---|---|
| Backlog | `pm`, manager | story issue | the manager promotes it (see *Promote from Backlog*), or a human moves it to **Ready** |
| Ready | manager | — | manager starts it |
| Spec review | `api-architect` | spec PR (`spec/...` branch) | **a human merges the spec PR** with `status: approved` |
| Building | `pm`, then the module's dev agent | task list, draft build PR | dev pushes a PR that builds and passes tests locally |
| Agent review | `pr-review-toolkit:code-reviewer`, `reviewer`, `tester` | PR comments | all three pass, or three rounds used |
| Ready to merge | human | merge | **a human merges** |

## Before you start

1. Read `CLAUDE.md`. Its **Factory** section names the teams (`team:*` label → dev agent), the build and test commands, and the board.
2. Catch the board up with what humans did since the last run: `node scripts/board.mjs sync`. It moves closed issues to **Done** and stories with an open spec PR to **Spec review**. GitHub does not move cards on its own, so never skip this.
3. Find the story: the issue number you were given, or the top item in **Ready**: `node scripts/board.mjs list Ready`. A named story still in **Backlog** goes through *Promote from Backlog* first.
4. Read the issue, its comments and its linked spec. Work out which step it is in from its column and the last manager comment.

## Steps

### 1. Spec
- If the story links specs that are all `approved` or `built`, or says `Spec: none`, skip to step 2.
- Otherwise start `api-architect` with the story number. It opens a spec PR.
- When you come back after the human merged the spec PR, the story is still in **Spec review**. Move it on yourself as step 2 starts.
- Move the story to **Spec review**, comment with the PR link, and **stop**. Tell the human: "Review and merge spec PR #N to continue."

### 2. Plan
- Start `pm` to add acceptance criteria and a task list that match the approved spec.
- If the story touches design, start `designer` first and wait for its PR to be merged by the human (same gate as a spec).

### 3. Build
- Move the story to **Building**.
- Start the dev agent for the story's `team:*` label with `isolation: worktree`. Give it the issue number, the spec file, the branch name `story/<issue>-<slug>`, and the build and test commands.
- The dev opens a **draft** PR that follows the PR template and says `Closes #<issue>` and `Spec: API-xxx`.
- **First story of a module** (its folder has no entity built on the `src/CLAUDE.md` patterns yet): the dev first comments on the story with the files it will add and the public method signatures, and **stops**. Tell the human: "Check the sketch on #N." Build once they reply. It costs one short read and saves review rounds.
- Before the PR, the dev reads its diff against `src/CLAUDE.md` once more and fixes what drifts.

### 4. Review (at most three rounds)
- Move the story to **Agent review**.
- Start in parallel: `pr-review-toolkit:code-reviewer` and `reviewer`. When the reviewer says `APPROVE-READY`, start `tester` (and `pr-review-toolkit:pr-test-analyzer` when tests changed).
- Findings → start the dev agent again on the same branch with the findings. One round = review + test + fix.
- After the third round that still has findings: add label `needs-human`, comment a summary, and **stop**.

### 5. Hand over
- When review and tests pass: `gh pr ready <pr>`, move the story to **Ready to merge**, comment a summary with links, and **stop**.
- The human merges and GitHub closes the issue. The card stays in **Ready to merge** until the next run's `sync` moves it to **Done**.

## Keep going

A **stop** in the steps ends work on that story, not the run. After each stop, and after a send back, pick the next story that can move and run it, until none can:

1. `node scripts/board.mjs sync`, then read the board again.
2. Pick, in this order:
   - a story whose gate a human passed since its last manager comment: its spec or design PR was merged, or a human answered a sketch or a question;
   - a story in **Building** or **Agent review** with no run going and no `needs-human` label;
   - the top story in **Ready**;
   - the top story in **Backlog** that passes *Promote from Backlog*.
3. Skip stories that wait on a human: an open spec or design PR in **Spec review**, a sketch with no reply, **Ready to merge**, `needs-human`, or the review budget used.
4. Nothing left? End with one summary: each story you touched, where it stopped, and what the human must do, most urgent first.

## Promote from Backlog

When nothing in **Ready** can move, take work from **Backlog** yourself instead of stopping. `node scripts/board.mjs list Backlog`, lowest issue number first.

1. Promote only an item an agent team can finish: `type:story` or `type:task` with a `team:content`, `team:rendering`, `team:publishing` or `team:design` label. Skip `type:case` (a human approves cases), parents with open sub-issues (run the children), `team:factory` and items with no team label (both are human work), and `needs-human`.
2. Skip it when it depends on open work: its body says "Depends on #N", "Blocked by #N" or "after #N" and #N is not closed, or it needs a spec that waits on an open spec PR.
3. No acceptance criteria yet? Start `pm` to refine it with the write-story skill first. If pm can't write testable criteria from what's there, add `needs-human`, comment the question, and skip it.
4. Move it to **Ready** and comment: `**Promote** — moved from Backlog: <one line why it can move>. Next: spec.` Then run it from step 1.

A human who moves a story back to **Backlog** while it's in flight is parking it: don't promote it again until its last human comment says to.

## Send back a PR with human review comments

A human who reviewed a PR that waits on them (spec, design or build) and left comments can send it back to its team. The Factory Floor's *Send back* button asks for this.

1. Read every human comment on the PR: `gh pr view <pr> --comments`, `gh api repos/<repo>/pulls/<pr>/reviews` and `gh api repos/<repo>/pulls/<pr>/comments` (line comments, with path and line). Ignore comments by agents. No human comments? Say so and stop.
2. Pick the team from the branch: `spec/` → `api-architect`, `design/` → `designer`, `story/` → the dev agent for the story's `team:*` label. A `factory/` or `chore/` PR has no agent team: fix it in this session yourself.
3. Start that agent on the same branch (dev agents with `isolation: worktree`) with the PR number, the story, and each comment quoted with its file and line. It fixes every comment or answers why not, pushes, and replies on the PR with one line per comment.
4. Move the card: a spec or design PR stays in **Spec review**; a build PR goes to **Building**, then through step 4 again. Rounds a human asked for do not count toward the three.
5. Comment on the story issue and **stop** at the same gate as before: `**Send back** — <team> fixed N comments on PR #N. Next: review again and merge.` Then *Keep going*.

## Board commands

```bash
node scripts/board.mjs list [Column]
node scripts/board.mjs move <issue> "<Column>"
node scripts/board.mjs sync   # closed → Done, open spec PR → Spec review
```

Move the card in the same step as the work it reports, before the issue comment. A step is not done while its card is in the wrong column.

## Guardrails

- One story in flight. Finish it or stop it at a gate before starting another; then start another (*Keep going*).
- Agents write only where their role allows (see each agent file). Spec PRs and build PRs are always separate.
- No agent merges, approves a PR, pushes to `main`, or edits a spec's `status` to `approved`.
- Budget: stop and ask the human once a story has used three review rounds or the dev agent has been started more than five times.
- Every step ends with an issue comment: `**<step>** — <what happened>. Next: <next step or who must act>.`
- When an agent goes wrong in a way a rule would have prevented, propose the rule as a change to its file in `.claude/agents/` or `.claude/skills/` in the hand-over comment.
