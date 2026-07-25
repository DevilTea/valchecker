# Pull Request Checklist

Use this checklist with the root [`AGENTS.md`](../../../../AGENTS.md) and task-relevant `valchecker-dev` references. Current implementation, package scripts, and executable workflows take precedence over stale examples.

## Before implementation

- [ ] Read the repository guidance and inspect affected source, runtime/type tests, exports, API surface, docs, scripts, workflows, and benchmarks.
- [ ] Define affected runtime, input/output/issue/type-state, operation-mode, interoperability, bundle, and performance contracts.
- [ ] Reuse the established source of truth rather than adding a parallel registry or abstraction.
- [ ] For runtime-defense changes, document boundary, ownership, bypass, blast radius, shared references, measured cost, and preserved tests.

## Implementation

- [ ] Strict types remain precise; `any` is limited to an explained runtime boundary.
- [ ] Plugin construction preserves `/* @__NO_SIDE_EFFECTS__ */`.
- [ ] Public names, `Meta.Name`, plugin keys, paths, exports, issue contracts, tests, and docs agree.
- [ ] Message-bearing steps use the required trailing-options convention.
- [ ] Named validation and native conversion semantics contain no hidden policy.
- [ ] Hot-path structure or deliberate duplication is not changed without equivalent benchmark evidence.
- [ ] Internal issues remain fatal through structures, combinators, and recovery.

## Tests

- [ ] Every test protects an observable runtime, type, interoperability, or regression contract in its owning layer.
- [ ] Modified steps cover distinct success/failure semantics, exact boundaries, relevant JavaScript edge cases, owned issues/messages, output, operation mode, and fluent availability.
- [ ] Async, ordering, short-circuit, collect-all, and early-failure cases are included only where the public contract requires them.
- [ ] No arbitrary timers, tautologies, coverage-only fixtures, duplicate full snapshots, or implementation-branch names are introduced.
- [ ] Coverage policy remains controlled by `scripts/coverage-policy.ts` and is not lowered merely to pass CI.

## Public surface and docs

- [ ] Built-in steps have applicable implementation, tests, benchmark, and local index; `packages/internal/src/steps/index.ts` exports the plugin.
- [ ] Intentional export changes regenerate `api-surface.json` with `pnpm api:surface:update` and verify it with `pnpm api:surface`.
- [ ] Default/selective instances and tree-shaking scenarios expose exactly the intended plugins; `allSteps` remains runtime-marker discovered.
- [ ] Canonical PluginDef JSDoc, READMEs, VitePress, examples, skills, changelog, and migration material are updated where applicable.
- [ ] Removed names/codes remain only in explicit historical or migration contexts.
- [ ] Commands, imports, signatures, links, issue payloads, and behavior claims are checked against current repository evidence.

## Verification

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm api:surface
pnpm publint
pnpm test:package
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm docs:build
```

- [ ] Applicable `pnpm typeperf`, focused benchmarks, cross-library benchmarks, bundle report, and impact workflows were run and inspected.
- [ ] CI pipelines preserve failure exit codes; commands piped through `tee` use `set -o pipefail`.
- [ ] No command or workflow is reported as passing without its result being inspected.

## Pull request

- [ ] Branch and diff are focused and commits use Conventional Commit intent.
- [ ] PR begins as Draft and explains rationale, impact, validation, and measured evidence where applicable.
- [ ] Complete diff and generated records underwent a review-and-fix loop; all actionable feedback is resolved.
- [ ] CI and relevant type-performance, bundle, and runtime-impact gates pass.
- [ ] PR is marked Ready only after all applicable correctness, type, DX, docs, package, performance, and workflow gates complete.
- [ ] Squash merge occurs only when requested and safe.
