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
- API category framing → `scripts/docs-api-templates/*`.
- Runtime-sensitive narrative example code → canonical checked fixture under `docs/.examples`.

Narrative pages should link to generated API anchors for exact leaf contracts rather than restating catalogs.

## Transitional inventory and route compatibility

During #148–#154, legacy `docs/guide/*` and `docs/examples/*` pages may remain registered with `transitional: true`. This is an inventory bridge only: it preserves deterministic identity and old routes while content is re-homed by reader need.

A transitional page is not exempt from existence/H1 checks, but it may defer final page-local source metadata until its migration issue rewrites it into a canonical destination. When a canonical replacement exists, the legacy route may also set `navHidden: true`: it remains registered and audited but disappears from generated navigation so readers are not offered two teaching destinations.

`navHidden` is **only** a temporary route-compatibility mechanism. Canonical pages may not use it; the narrative structural checker rejects `navHidden` unless `transitional: true`. #154 owns replacing these temporary registered stubs with the final machine-readable route-compatibility strategy and removing the legacy inventory.

The final cleanup must leave no legacy page merely because it was once transitional.

## Page archetypes

Use archetypes as guidance, not 1:1 templates:

- tutorial — first-success, ordered learning path;
- concept — explanatory mental model;
- recipe — task-oriented solution;
- extension — plugin/custom-step authoring;
- reference — formal lookup/guarantee material;
- migration — before/after compatibility guidance.

Only deterministic page-specific requirements belong in the registry (`requiredHeadings`, `visualRequirement`). Do not encode subjective prose quality as a structural checkbox.
