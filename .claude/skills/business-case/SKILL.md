---
name: business-case
description: Format for agent-factory business cases filed as `type:case` GitHub issues for a human to approve or reject. Use when proposing what to build next or sizing an idea.
---

# Write a business case

A case is a GitHub issue a human can decide on in five minutes.

```bash
gh issue create --title "Case: <outcome in plain words>" --label "type:case" --body-file case.md
```

## Body

```markdown
## Problem
Who has it, how often, what it costs them today.

## Proposal
What we would build, in three sentences or fewer.

## Size of the prize
Reach and value, with sources. Mark estimates as estimates.

## Cost
T-shirt size (S/M/L) per team, and new risks or running costs.

## Why not
The strongest reasons to skip it.

## Recommendation
Build / don't build / test first, and the smallest first story.
```

A human approves by adding the `approved` label. The manager then asks `pm` to write the stories.
