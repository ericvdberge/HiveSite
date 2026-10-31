---
name: review-pr
description: The agent factory's checklist for reviewing a build pull request against its spec, story, module boundaries and project rules. Use when reviewing a story PR or re-reviewing after fixes.
---

# Review a build PR

```bash
gh pr view <pr> --json title,body,headRefName,files,comments
gh pr diff <pr>
```

Find the story (`Closes #N`) and spec (`Spec: API-xxx`) in the PR body. A build PR without both is `CHANGES NEEDED` with one finding.

## Checklist

1. **Spec coverage.** For each endpoint in the spec: route, method, auth, request fields and limits, response shape, every error status and `code`. Anything missing or extra is a finding.
2. **Acceptance criteria.** Each AC on the story is implemented and has a test that would fail without the change.
3. **Boundaries.** Every changed file is inside the dev agent's module folder, `tests/` for that module, or files the story names. Another module is used only through its `.Contracts` project.
4. **Project rules.** The root and module `CLAUDE.md` rules hold (errors, ids, no hard-coded design values).
5. **C# patterns.** The code follows `src/CLAUDE.md` exactly. Check at least: handlers are `private static` methods that map, call the service and return `TypedResults`; validators are named on the route; services take entities and filters and return `null` or `Result<T>`, never throw for a business rule; repositories map DAOs with Mapperly and use LINQ only; nothing new in `Hivesite.Shared` that only one entity uses; tests are MSTest.
6. **Scope.** No unrelated refactors, no new dependencies without a reason in the PR body.

## Simpler beats complete

A finding never asks for more plumbing than the spec sentence is worth. When honouring a spec rule would take a new helper, a framework feature (Data Protection, locks) or more than about 30 lines, the finding is "simplify the spec": name the rule and propose dropping it to `api-architect`. Don't ask the developer to build it.

## Comment format

```markdown
**Review round <n>: CHANGES NEEDED** (or **APPROVE-READY**)

1. `src/Modules/Content/…/PageEndpoints.cs:42` — 422 `too_many_blocks` from API-004 is not returned; the limit is never checked.
2. …
```

Round number = previous factory review comments on this PR + 1. On round 3 with findings, add the `needs-human` label.
