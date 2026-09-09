# Documentation writing guidelines

These rules apply to hand-authored narrative pages. Exact page identity/order comes from `docs/_meta/pages.ts`; generated step reference follows #134; preserved legacy routes are generated from `docs/_meta/compatibility.ts`.

## Canonical ownership first

Before editing, decide what fact is being changed:

- exact built-in step behavior, options, issue codes, caveats → edit the step's `<name>.doc.md`;
- cross-cutting concept or user task → edit the narrative page;
- page identity/order/section → edit `docs/_meta/pages.ts`;
- legacy published-route compatibility or final legacy-page disposition → edit `docs/_meta/compatibility.ts`;
- generated API category framing → edit `scripts/docs-api-templates/*`;
- never hand-edit generated `docs/api/*` or generated legacy-route pages.

## Narrative frontmatter

Narrative pages use only page-local metadata:

```yaml
---
description: Short reader/search description.
relatedSources:
  - packages/internal/src/path/to/semantic-root.ts
relatedPackages:
  - valchecker
---
```

`description` and at least one precise `relatedSources` semantic root are required for behavior-bearing narrative pages. `relatedPackages` is optional and should not duplicate information without a concrete impact/search use.

Do not put registry-owned `title`, `section`, `category`, `order`, route, or navigation labels in frontmatter.

The structural checker intentionally accepts only this narrow metadata shape so misspelled or duplicated ownership fails closed.

## Source fidelity

Read the exact current implementation/type sources before making behavioral claims. `relatedSources` names the smallest files that directly define those claims; do not use package barrels, generated files, whole directories, or every transitive helper merely to broaden matching.

A passing structural/build check does not prove prose correctness. Source-backed semantic review remains required.

## Headings and page identity

- H1 must exactly match the registry's canonical `title`.
- Use headings to organize reader questions/tasks, not to mirror source-file structure.
- Only page-specific headings whose presence is objectively required belong in registry `requiredHeadings`.

## Examples

- small API-shape/type examples may remain inline;
- runtime-sensitive claims use a canonical checked fixture displayed from the same source;
- one substantial example has one canonical code owner;
- typecheck skips are exceptional and must carry an auditable reason.

Do not repeat exhaustive step parameters/issues in narrative pages; link to generated Reference.

## Visuals

Graphviz DOT is the default graph/flow/state DSL. Tables are preferred for genuinely tabular comparisons. SVG, Vue, and screenshots are exceptions with explicit explanatory value; Mermaid is not initially supported.

A page declares a structural visual requirement only when the visual is essential enough that its absence is objectively a contract failure.

## Links, assets, and includes

Prefer canonical internal destinations for every new or maintained link. Local image/include targets must resolve; the narrative structural check rejects missing local assets/includes.

Old published URLs are compatibility surfaces, not preferred destinations. Preserve them only through `docs/_meta/compatibility.ts` and its generated artifacts. Do not link new prose, README entry points, navigation, or API framing to an old compatibility route when the canonical route is known.

If a legacy page was split or absorbed, its compatibility entry may record several canonical content destinations while selecting one primary `redirectTo`. That mapping is disposition evidence; do not recreate the old page as a manually curated index.

## Generated compatibility pages

Files generated for old published routes contain redirect metadata and a fallback canonical link only. They are deliberately outside narrative ownership and must not accumulate hand-written teaching content.

Use:

- `pnpm docs:compat` to verify mapping/output parity;
- `pnpm docs:compat:update` after changing the compatibility mapping or canonical route identity.

If a generated compatibility page looks wrong, fix the mapping, registry, or generator. Never patch the generated file itself.
