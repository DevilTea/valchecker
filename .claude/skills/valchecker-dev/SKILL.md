---
name: valchecker-dev
description: Maintain the Valchecker repository — architecture, step plugins, tests, public API, documentation, benchmarks, CI, and pull-request completion. Use for any change to this repository itself; use valchecker-expert for application code that only consumes Valchecker.
---

# Valchecker Development

[`AGENTS.md`](../../../AGENTS.md) is the baseline: verification commands, the runtime-boundary default, naming and parameter rules, issue contracts, the surfaces a public change must update, and what never to do unasked. This skill adds the depth behind those rules. Where they appear to disagree, `AGENTS.md` and current executable repository evidence win.

## What is machine-checked

These need no manual audit — `pnpm verify` fails on them:

| Contract | Checked by |
| --- | --- |
| `api-surface.json` matches runtime and declared exports | `scripts/check-api-surface.ts` |
| No positional `message`; trailing named options object | `scripts/check-step-parameter-style.ts` |
| `/* @__NO_SIDE_EFFECTS__ */` present on plugin construction | `scripts/check-step-parameter-style.ts` |
| PluginDef JSDoc has Description / Example / Issues | `scripts/check-step-jsdoc.ts` |
| Issue codes are `<step-name>:<snake_case>` | `scripts/check-issue-codes.ts` |
| Docs `ts` examples compile against the built declarations | `scripts/check-docs-examples.ts` |
| No `.only`/`.skip`, raw timers, or implementation-named tests | `scripts/check-test-quality.ts` |
| Coverage floors, including 100% for `internal/src/core/**` | `scripts/coverage-policy.ts` |
| ESM-only packaging, no CJS artifacts, pinned internal deps | `scripts/test-packages.ts`, `publint` |
| Type-complexity budget and pinned TypeScript version | `scripts/check-type-performance.ts` |
| Tree-shaking markers and selective-bundle size | `benchmarks/src/treeshake.mjs` |
| Piped CI commands run under `pipefail` | `scripts/check-workflow-pipefail.ts` |
| A source change carries a `CHANGELOG.md` entry | `Changelog` job in `ci.yml` (`skip-changelog` label opts out) |
| `main` takes no direct push, force-push, or non-squash merge | repository ruleset, with every CI check required |

What is **not** machine-checked, and therefore needs deliberate attention: whether a behaviour change earned a real `CHANGELOG.md` entry rather than merely touching the file, whether prose in `docs/` and the READMEs still describes current behaviour, and whether a removed name survives anywhere outside an explicit historical or migration context.

## Change discipline

- Preserve state-aware method availability and input/output/issue/operation-mode inference.
- Keep a step's issue code, category, payload, message, and path/context behaviour synchronized with its tests and docs.
- Let `allSteps` discover plugins through the runtime marker; never add a second list.
- Keep schema instances on the shared-prototype architecture unless a benchmarked contract review justifies replacing it.
- Reuse the established source of truth rather than adding a parallel registry or abstraction.
- Do not import package-private paths across package boundaries.

## References

- [Architecture](./references/architecture.md) — plugin layers, dispatch, issue finalization, structural execution, construction metadata
- [Conventions](./references/conventions.md) — payload key vocabulary, categories, file layout, canonical JSDoc
- [Testing](./references/testing.md) — test ownership by layer, case design, async and structural coverage
- [Benchmarking](./references/benchmarking.md) — focused benches, cross-library suite, impact and tree-shaking workflows
- [Runtime boundaries](./references/runtime-boundaries.md) — the TypeScript-only conditions, ownership taxonomy, review requirements
- [Step implementation utilities](./references/utils-api.md) — the `utils` API surface
- [Implementation examples](./references/examples.md) — complete worked steps
- [Documentation site](../../../docs/index.md)
