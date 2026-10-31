---
name: rendering-domain
description: Where the Rendering module's rules live and which are still open under ADR 3. Use when building, fixing or reviewing code in src/Modules/Rendering.
---

# Rendering domain

The specs, `design/README.md` and the ADRs hold the rules; this skill doesn't repeat them.

## Where the rules are
- **API-010 (themes)**: in review.
- **API-011 and API-012**: drafts, on hold for ADR 3.
- **ADR 3**: proposed. If it's accepted, Rendering runs sandboxed template builds instead of C# renderers.
- **`design/README.md`**: token naming, color roles and contrast, shared block rules, motion.
- **`design/blocks/<type>.md`**: one layout note per block type.

Build nothing that isn't approved. Check ADR 3's status first, and treat API-011's markup as reference only.

## Easy to miss
- The same input gives the same bytes: no clock, no random values, no culture-dependent formatting.
- Ignore the stored `target`, `rel` and `class` on link marks; Rendering sets its own.
- Under ADR 3, our code checks the build output (paths, symlinks, limits), never the template's code.
