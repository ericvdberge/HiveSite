---
name: write-api-spec
description: How agent-factory API specs are written, numbered, indexed and proposed as pull requests. Use when drafting a new API spec, changing an existing one, or checking a spec's format.
---

# Write an API spec

Specs are markdown files in `specs/<domain>/API-NNN-<slug>.md`. `specs/STYLE.md` is the authority; this skill is the procedure.

## Procedure

1. Read `specs/README.md` (the index) and every spec your new one depends on.
2. Take the next free number in the domain's range (see `specs/STYLE.md`).
3. Copy `specs/TEMPLATE.md` and fill it in. Start with `status: in review`, `version: 1`.
4. Run `node scripts/spec-index.mjs` and fix every error. Commit the regenerated `specs/README.md`.
5. Branch `spec/API-NNN-<slug>`, commit `docs(spec): API-NNN <title>`, push, and open the PR:

```bash
gh pr create --title "spec: API-NNN <title>" --label "type:spec,team:<team>" --body-file pr.md
```

The PR body links the story (`Spec for #<story>`), summarises endpoints and decisions, and lists open questions or "none".

## Changing an approved spec

Raise `version`, set `status: in review`, describe the change at the top of the PR body, and link the story that needs it. Never edit a `built` spec without also opening a story to change the code.

## What makes a spec good

- Every endpoint shows auth, a full request example, a full response example and every error with its status code and `code` string.
- Names, ids, error shape and pagination match the existing specs.
- Limits are numbers (`max 40 blocks`), not words (`a reasonable number`).
- Anything undecided goes under `## Open questions`. A spec cannot be approved while it has any.

## Keep it simple

Every rule in a spec becomes code, tests and review. Before you add one, ask: does this story fail without it?

- No hardening "for later": signed or encrypted tokens, idempotency keys, locks, retries, caching, rate limits. Name what you left out under Decisions as "not in this version", so a human can ask for it.
- Prefer what the framework does by default (model binding, unique indexes, plain ids) over a rule that needs custom plumbing.
- The `api-design-principles` skill describes public APIs at scale. Where it asks for more than this, `specs/STYLE.md` and this section win.
