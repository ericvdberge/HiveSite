---
name: write-story
description: Format, labels and board fields for agent-factory story and task issues on GitHub. Use when creating a story, refining one into acceptance criteria and tasks, or splitting a story.
---

# Write a story

A story is one GitHub issue that one team can finish in one build PR.

## Create

```bash
gh issue create --title "<Owner can …>" --label "type:story,team:<team>" --body-file story.md
node scripts/board.mjs move <issue> Backlog
```

The title says what a user can do afterwards, in plain words: "Owner can set the blocks of a page". Not "Implement PUT /pages/{id}/blocks".

## Body

```markdown
## Why
One or two sentences: who needs this and what it unlocks. Link the case issue if there is one.

## Spec
API-004 (link to specs/<domain>/API-004-*.md), or "none" for non-API work.

## Acceptance criteria
- [ ] AC1 — Given …, when …, then … (maps to: PUT /pages/{id}/blocks 200)
- [ ] AC2 — … (maps to: 400 invalid_block)

## Tasks
- [ ] …one reviewable change each

## Out of scope
- …
```

## Rules

- Every acceptance criterion is testable and names the spec item it covers.
- Labels: exactly one `type:*` and one `team:*`. Add `needs-spec` when the spec does not exist or is not approved.
- Split when the work spans more than one team or will exceed about 400 changed lines; link the parts with "Part of #N".
- Tasks that deserve their own tracking become their own issues with `type:task` that mention the parent.
