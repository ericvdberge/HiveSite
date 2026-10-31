---
name: publishing-domain
description: Where the Publishing module's rules live and which are still open under ADR 3. Use when building, fixing or reviewing code in src/Modules/Publishing.
---

# Publishing domain

The specs and ADRs hold the rules; this skill doesn't repeat them.

## Where the rules are
- **API-020 (releases and rollback)**: in review.
- **API-021 (serving)**: draft, on hold for ADR 3.
- **ADR 3**: proposed. It may change the build call, make publish asynchronous, change what records a release's look, and replace `/s/{slug}` serving with one origin per site. Its Open questions in API-020 list each change.

Build nothing that isn't approved.

## Easy to miss
- Store every file before the live pointer moves. If storing fails, nothing changes.
- Rollback creates no release and changes no draft. A rollback to the release that's already live is a no-op and raises no event.
- Never prune the live release, even when it's older than the 20 newest.
- Releases use relative links, so a slug change needs no new publish. Publishing listens to `SiteChanged` to keep the slug history.
