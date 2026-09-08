# Documentation content architecture

This reference describes **where reader-facing knowledge belongs**. The machine-readable page inventory, paths, titles, section membership, and ordering live in `docs/_meta/pages.ts`; do not mirror that inventory here.

## Reader-facing sections

### Getting Started

Own the shortest path from installation/imports to a successful schema → execution → result flow. Link to deeper concepts and reference instead of teaching every mechanism inline.

### Core Concepts

Own cross-cutting mental models: stateful chaining/pipeline behavior, validation vs transformation, sync/async propagation, issue/path behavior, type inference vs runtime behavior, and other observable concepts that span multiple steps.

### Guides & Recipes

Own task-oriented workflows and reusable application patterns. A guide may use several APIs together, but exact leaf-step parameters, issue tables, and contract catalogs stay in generated Reference.

### Extending Valchecker

Own custom-step/plugin authoring, instance/plugin selection, composition/lifecycle boundaries, and extension/tree-shaking guidance.

### Reference

Own exact lookup surfaces: the formal compatibility contract, generator-owned built-in API reference, and other material whose primary purpose is precision rather than teaching flow.

Generated API routes are not narrative registry entries. They remain owned by #134 and are merged into the Reference navigation through the explicit seam in `docs/.vitepress/config.ts`.

### Troubleshooting & Migration

Own migration steps, common mistakes, compatibility caveats, and diagnosis/recovery guidance.

## Ownership boundary

- Step-specific API facts → sibling `<name>.doc.md` → generated `docs/api/*`.
- Cross-cutting concepts and real tasks → narrative Markdown.
- Narrative page identity/order → `docs/_meta/pages.ts`.
- Legacy published-route compatibility and final legacy-page disposition → `docs/_meta/compatibility.ts`.
- API category framing → `scripts/docs-api-templates/*`.
- Runtime-sensitive narrative example code → canonical checked fixture under `docs/.examples`.

Narrative pages should link to generated API anchors for exact leaf contracts rather than restating catalogs.

## Route compatibility

Canonical reader-facing pages are registered only in `docs/_meta/pages.ts`. Old published routes that still need to resolve are **not** narrative pages and do not appear in that registry.

`docs/_meta/compatibility.ts` is the single machine-readable compatibility inventory. Each entry records:

- the old published route;
- its final disposition (`migrated`, `split`, `absorbed`, `redirected`, or `intentionally-removed` when appropriate);
- the canonical page ids that now own its useful content;
- the canonical page id used as the redirect destination.

Compatibility targets use canonical page ids rather than copied route strings. Route identity therefore stays owned by the narrative registry even if a canonical page moves later.

Old-path Markdown files are generated compatibility artifacts. `pnpm docs:compat` verifies the mapping and committed output without changing files; `pnpm docs:compat:update` is the only supported way to rewrite those artifacts. Do not hand-edit generated compatibility pages or reintroduce duplicate prose merely to preserve an old URL.

The compatibility checker must fail closed on malformed/duplicate source routes, canonical-route collisions, unknown canonical targets, invalid redirect ownership, or stale generated artifacts. The narrative checker excludes only the exact generated compatibility paths named by the mapping; unrelated Markdown under an old directory remains an unregistered-page error.

## Page archetypes

Use archetypes as guidance, not 1:1 templates:

- tutorial — first-success, ordered learning path;
- concept — explanatory mental model;
- recipe — task-oriented solution;
- extension — plugin/custom-step authoring;
- reference — formal lookup/guarantee material;
- migration — before/after compatibility guidance.

Only deterministic page-specific requirements belong in the registry (`requiredHeadings`, `visualRequirement`). Do not encode subjective prose quality as a structural checkbox.
