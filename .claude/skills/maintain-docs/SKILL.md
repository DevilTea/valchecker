---
name: maintain-docs
description: Maintain Valchecker's documentation architecture, narrative pages, checked examples, generated API reference, visuals, and source-backed semantic review. Use for documentation changes and whenever source changes may affect documented behavior.
---

# Valchecker Documentation Maintenance

[`AGENTS.md`](../../../AGENTS.md) is the repository baseline. For documentation work, also read:

- [`references/content-architecture.md`](./references/content-architecture.md) — section boundaries, page ownership, and reader flow;
- [`references/writing-guidelines.md`](./references/writing-guidelines.md) — prose, source linkage, examples, visuals, and transitional-page rules;
- [`docs/_meta/pages.ts`](../../../docs/_meta/pages.ts) — canonical narrative page identity, order, and deterministic per-page requirements.

Current executable repository evidence wins if prose and code disagree.

## Canonical ownership

Classify the claim before editing anything:

- Exact built-in step facts belong in `packages/internal/src/steps/<name>/<name>.doc.md`; `docs/api/*` is generated through #134 and must not be hand-edited.
- Cross-cutting concepts and user tasks belong in registered narrative Markdown pages.
- Narrative identity/order/section/title live in `docs/_meta/pages.ts`; page-local Markdown must not mirror those fields.
- Runtime-sensitive narrative examples belong in canonical `docs/.examples/.../example.ts` fixtures with tests; Markdown displays that same source with `<<<` or the established equivalent.
- Small API/type-composition snippets may remain inline when compile proof is sufficient.
- Graphviz DOT is the default graph/flow/state DSL. Do not introduce Mermaid while it is unsupported.

When a behavioral narrative claim is final rather than transitional, `relatedSources` should name the smallest exact source roots that directly define the claim. Do not pad it with barrels, package roots, directories, generated files, or every transitive helper.

## Workflow

1. **Load contracts.** Read `AGENTS.md`, this skill, both references, the page registry, and any local canonical owner relevant to the task.
2. **Classify ownership.** Decide whether each change belongs to a step `.doc.md`, narrative page, registry, checked fixture, API template, or generated artifact before editing.
3. **Read source evidence.** Inspect the exact current implementation/types/tests behind behavioral claims. Do not infer semantics from existing prose alone.
4. **Edit canonical owners only.** Never patch generated API output to make a check pass.
5. **Regenerate derived artifacts.** Use the established update command such as `pnpm docs:api:update` when canonical step docs/templates changed.
6. **Run focused checks.** Use the narrow command that exercises the changed contract while iterating.
7. **Run the canonical deterministic gate.** After package build artifacts exist, run `pnpm docs:check`.
8. **Inspect source impact.** When source changed, run `pnpm docs:status` against the relevant base. It is review scope, not a semantic freshness oracle.
9. **Review every impacted page.** In particular, read impacted-but-untouched pages against current source. An untouched page may be correct; it still requires inspection.
10. **Hand off evidence.** Report deterministic checks, source-backed semantic review, any owner decisions still required, and residual risks.

Routine maintenance does **not** require a persistent `.maintain-docs/tasks/*.task.json` database. Use stdout or an explicit ephemeral report when machine-readable impact output is useful.

## Commands

- `pnpm docs:narrative` — narrative registry/frontmatter/asset/source structural contract.
- `pnpm docs:markdown` — supported diagram syntax and auditable compile-skip contract.
- `pnpm docs:api` — non-mutating generated API freshness check.
- `pnpm docs:api:update` — regenerate API output from canonical owners.
- `pnpm docs:examples` — compile Markdown TypeScript examples against built declarations.
- `pnpm docs:examples:runtime` — execute behavior-sensitive narrative fixtures.
- `pnpm docs:check` — authoritative non-mutating deterministic docs gate after `pnpm build`.
- `pnpm docs:status` — non-blocking source-to-doc semantic review scope.

`docs:status` does not replace `docs:check`, and `docs:check` does not prove prose semantics.

## Impact semantics

Use these terms precisely:

- **impacted + touched** — a source dependency changed and the page was edited; still review the claim.
- **impacted + untouched** — mandatory semantic review scope, not automatically defective and not a reason to make a meaningless edit.
- **mechanically stale/broken** — automation can prove the defect, for example a missing `relatedSources` path, generated API mismatch, invalid page contract, broken include/asset, failing checked example, or failed production build.

Narrative impact follows `page -> relatedSources root -> transitive imported dependency`. Step documentation uses #134 structural ownership and does not duplicate `relatedSources` metadata. Rename/copy/delete handling must preserve both old and new changed paths so a move cannot silently disappear from review scope.

Do not use reviewed-at hashes, timestamps, or touch-only acknowledgement fields as proof of semantic freshness.

## Semantic review

After deterministic checks pass, use the fresh-context `maintain-docs-review` subagent for documentation changes with meaningful behavioral content, migration work, substantial examples, diagrams/tables, or broad source impact.

The reviewer is read-only. It should look for source/prose contradictions, claims that are too broad or too narrow, duplicate ownership, misleading examples, inaccurate visuals, missing impacted pages, and migration/troubleshooting drift. It should not spend its budget re-running a known-passing full gate by default.

Treat reviewer output as three distinct classes:

- **Blocking** — source contradictions or violations of canonical ownership/contracts.
- **Owner decision** — user-facing contract/terminology/IA choices that automation or the reviewer must not decide silently.
- **Residual risk** — uncertainty or review scope that remains after the available evidence.

## Scope boundaries

English is the only maintained reader-facing language in this migration. Do not add localization fields, translated trees, translation freshness machinery, or a translation agent while working under this skill.

Do not opportunistically change runtime/API behavior merely because documentation work exposes a product-design question. Record or raise the product question separately.