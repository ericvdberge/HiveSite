# 4. The MVP renders the default template in-process, on one origin

Status: accepted · 2026-11-01

## Context
ADR 3 (proposed) moves rendering to sandboxed Vue/Nuxt template builds, with a separate origin per site and per preview. That is the right end state for owner-written templates, but it puts a build sandbox, wildcard DNS and TLS, and the entity engine (API-005) in front of the first published site. The owner wants an MVP they can try end to end in the studio first: sign in, build a site from blocks, pick a theme, preview, publish, roll back, and see the live site.

## Decision
For the MVP, take the parts of ADR 3 that hold for every later step and leave out the parts that only matter for owner-written templates.

- **Kept from ADR 3.**
  - The default look is Vue: `@hivesite/blocks` (one component per block type) and one default template, styled only through the tokens in `design/tokens.json`.
  - A build is pure: the same snapshot and template give the same files, snapshot-tested.
- **Changed for the MVP.**
  - Only Hivesite's own default template exists. Owners can't upload templates, so there is no sandbox.
  - Rendering runs the default template build in-process: Node, invoked by the Host, as trusted code.
  - Sites are served from the API origin under `/s/{site_slug}/`, as API-021 first described. The preview is shown under the same rule.
  - This is safe only because no owner code runs. Owner HTML through the `embed` block stays escaped or sandboxed as API-003 says.
- **Theme.**
  - The site picks one of the three themes (`atelier`, `ivory`, `studio`) in a small site setting, not through the API-005 entity.
  - API-005 stays the plan for brand styling after the MVP.
- **Sign-in.**
  - Until real sign-in (#56, #57, #58) lands as the last MVP milestone, the Host signs everyone in as the seeded admin (#50), in Development only.
  - Production keeps returning 401.

## Consequences
- The specs held under ADR 3 (API-010, API-011, API-020, API-021) are revised to this route before their stories build.
- Moving to ADR 3 later adds the sandbox and per-site origins around the same template and snapshot. The default template and `@hivesite/blocks` carry over unchanged.
- ADR 3 stays proposed for after the MVP. Its decisions on entities (a) and origins (c) are deferred, not rejected.
