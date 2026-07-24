---
name: valchecker-dev
description: Guide for maintaining the Valchecker repository, including architecture, step plugins, tests, benchmarks, public API changes, documentation, CI, and pull-request completion.
---

# Valchecker Development Guide

Use this skill whenever changing the Valchecker repository itself. For application code that consumes Valchecker without modifying this repository, use `valchecker-expert` instead.

## Startup procedure

Before proposing or implementing a change:

1. Read the root `AGENTS.md` completely.
2. Inspect the current implementation, tests, exports, documentation, scripts, and workflows affected by the task.
3. Load every task-relevant reference from this skill rather than relying on memory or an older pull request.
4. Follow the latest, most specific applicable repository rule. When documents conflict, identify the conflict and resolve it from `AGENTS.md`, the current implementation, and the repository's executable checks.
5. Prefer established Valchecker patterns over introducing a parallel abstraction or duplicate source of truth.

## Required verification

The baseline repository verification is:

```bash
pnpm install
pnpm build
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm docs:build
```

Run additional checks when applicable:

```bash
pnpm api:surface
pnpm test:package
pnpm publint
pnpm typeperf
pnpm bench
```

Use focused tests and benchmarks during development, but complete the relevant full checks before considering the work finished. Runtime-, type-performance-, bundle-, or tree-shaking-sensitive changes require measured evidence from the corresponding benchmark workflows.

Every CI pipeline must preserve the failing command's exit code. Any command piped into `tee` or another process must run with `set -o pipefail`.

## Project structure

```text
packages/internal/     core implementation and built-in step plugins
packages/all-steps/    automatic allSteps collection
packages/valchecker/   public package and default v instance
docs/                  VitePress documentation
benchmarks/             cross-library and tree-shaking reports
api-surface.json        recorded public exports
```

## Step implementation contract

A normal built-in step uses three layers:

1. `Meta` — public method name, expected current schema, and owned issue type.
2. `PluginDef` — state-aware TypeScript signature and canonical JSDoc.
3. `implStepPlugin()` — runtime behavior and operation mode.

A normal step directory contains:

```text
packages/internal/src/steps/<public-step-name>/
├── <public-step-name>.ts
├── <public-step-name>.test.ts
├── <public-step-name>.bench.ts
└── index.ts
```

Directory and file names, public exports, `Meta.Name`, the plugin object, issue codes, tests, and documentation must agree. Preserve `/* @__NO_SIDE_EFFECTS__ */` on tree-shakable plugin exports.

`allSteps` discovers exported plugin objects through the runtime marker. Do not create or maintain a duplicate static plugin list.

## Naming and parameter contracts

- Initial schemas use nouns or noun phrases: `string`, `number`, `object`, `looseNumber`.
- Built-in validations use natural `isXxx` propositions and preserve successful values.
- Concrete transformations use `toXxx` and name the resulting representation.
- Generic escape hatches retain direct semantic names such as `check` and `transform`.
- A named validation enforces only the condition stated by its name; do not add hidden finite-number, integer, non-empty, parsing, or coercion policy.
- Message-bearing built-in steps keep at most one required semantic operand positional. Optional configuration and `message` belong to one trailing options object.

Native primitive conversions delegate to the corresponding JavaScript operation. Policy-bearing conversions require explicit names.

Issue codes use:

```text
<public-step-name>:<snake_case_description>
```

The type-level issue, runtime issue creation, category, payload, tests, documentation, changelog, and migration material must remain synchronized.

## Testing strategy

Tests protect observable runtime behavior, type-state contracts, interoperability, and regressions. Coverage is a diagnostic guardrail, not the test plan.

Before adding a test, identify:

1. the contract it protects;
2. the owning test layer;
3. the plausible production mutation that would make it fail;
4. the semantic input class or exact boundary it represents;
5. why the assertion distinguishes correct from broken behavior.

For modified steps, cover each distinct success and failure semantic, exact boundaries, JavaScript-specific edge cases, owned issue codes and payloads, custom messages, output and issue inference, operation mode, and fluent method availability. Add asynchronous, ordering, short-circuit, or collect-all cases only where the public contract requires them.

Keep complete issue-shape assertions in the owning step test. Composition and integration tests should assert only the fields relevant to their scenario. Use table-driven tests for equivalent inputs. Do not add arbitrary timers, tautological assertions, duplicate complete snapshots, implementation-branch test names, or fixtures whose only purpose is executing an uncovered line.

Follow the complete [testing strategy](./references/testing.md).

## Runtime boundaries

Public runtime inputs remain runtime-validated. TypeScript-only enforcement is an exception that requires a precise advanced contract, deliberate bypass, confined blast radius, no shared-state or integrity risk, a performance-sensitive path, and measured cost.

Before removing a freeze, copy, assertion, or invariant check, classify ownership and determine whether execution state and public diagnostic payloads share references. Separate those representations before optimizing when consumer mutation could affect later validation.

Follow the complete [runtime boundary policy](./references/runtime-boundaries.md).

## Public API changes

An intentional public addition, removal, rename, payload change, issue-code change, or semantic change must update every affected surface:

- implementation and package exports;
- `packages/internal/src/steps/index.ts`;
- `api-surface.json`;
- default and selective instance tests;
- type-state and inference tests;
- benchmark adapters and tree-shaking scenarios;
- root and package README files;
- VitePress references and examples;
- agent skills and contributor guidance;
- changelog and migration documentation when applicable.

Search the complete repository for removed names and issue codes before merge.

## Performance and tree-shaking

Keep hot-path runtime work direct and allocation-conscious, but do not trade semantic correctness for an isolated microbenchmark result. Preserve measured performance-sensitive duplication when the repository documents why abstraction regresses throughput.

For performance changes:

1. define the exact semantic contract that must remain unchanged;
2. benchmark the candidate against the current implementation;
3. separate construction, cold execution, warmed success, and warmed failure where relevant;
4. inspect uncertainty and multiple runs;
5. evaluate runtime, type performance, bundle size, and tree-shaking independently;
6. document the trade-off and retain only measured improvements.

For selective-import changes, verify that unselected plugin markers are absent from the generated minimal bundle.

## Pull-request completion

Use conventional commit intent. Open work as a Draft PR, inspect the complete diff, run a review-and-fix loop, resolve all actionable review feedback, and verify CI plus relevant performance and bundle workflows. Do not mark the PR ready while correctness, developer-experience, bundle-size, tree-shaking, or performance regressions remain. Merge through squash only after the repository-defined gates pass.

## References

- [Architecture](./references/architecture.md)
- [Conventions](./references/conventions.md)
- [Testing strategy](./references/testing.md)
- [Benchmarking](./references/benchmarking.md)
- [Runtime boundaries](./references/runtime-boundaries.md)
- [PR checklist](./references/checklist.md)
- [Implementation examples](./references/examples.md)
- [Repository documentation](../../../docs/index.md)
