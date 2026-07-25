# AGENTS.md

## Project overview

Valchecker is an ESM-only TypeScript validation library with state-aware fluent steps, transformed-output inference, structured non-empty issue results, Standard Schema V1, and selective tree-shakable plugin registration.

```text
packages/internal/      core implementation and built-in plugins
packages/all-steps/     runtime-marker-discovered allSteps collection
packages/valchecker/    application package and default v instance
docs/                   VitePress documentation
benchmarks/             runtime, impact, and tree-shaking tooling
type-performance/       TypeScript compiler-complexity fixture and budget
```

## Sources of truth

Before changing the repository, inspect affected implementation, runtime and type tests, package manifests, scripts, workflows, `api-surface.json`, benchmarks, and documentation. Executable current repository evidence takes precedence over older PRs or stale prose.

This file is the repository-wide baseline. Use `.agents/skills/valchecker-dev/` for repository maintenance and `.agents/skills/valchecker-expert/` for application code. More specific current guidance may refine this file but must not silently contradict it.

## Verification

Use the checked-in lockfile unless dependency changes are intentional:

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

`pnpm test:coverage` includes `pnpm test:quality`. Use focused checks during development, then run the applicable full checks. Run `pnpm typeperf`, focused step benchmarks, cross-library benchmarks, and bundle/performance-impact workflows when the change can affect those contracts.

Every CI pipeline must preserve the failing command's exit code. Commands piped into `tee` or another process must run under `set -o pipefail`.

## Code and runtime boundaries

- TypeScript strict mode; single quotes; no semicolons; tabs.
- Prefer functional, immutable-by-replacement patterns and existing abstractions.
- Preserve type-only imports and `/* @__NO_SIDE_EFFECTS__ */` immediately around tree-shakable plugin construction.
- Ordinary public runtime inputs remain runtime-validated.

TypeScript-only enforcement is an exception requiring all of these: an internal/advanced surface; precise declarations; deliberate `any`/assertion/untyped bypass; failure confined to the caller; no shared-state, security, integrity, or future-execution impact; a broad or hot path; and measured material cost.

Before removing a freeze, copy, assertion, or invariant check, classify ownership and shared execution/diagnostic references. Separate representations before optimizing when consumer mutation could affect later validation. Follow [the complete runtime-boundary policy](.agents/skills/valchecker-dev/references/runtime-boundaries.md).

## Core architecture

Schemas created by one `createValchecker()` instance share a prototype, not a `Proxy`. Fixed schema properties are own enumerable properties; registered methods are non-enumerable prototype methods. Do not reintroduce a property-read Proxy without contract review and benchmark evidence.

`allSteps` discovers runtime-marked public plugin exports. Do not maintain a duplicate static plugin list.

A normal built-in step uses:

1. `Meta` for public name, expected current state, and owned issue type;
2. `PluginDef` for state-aware signature and canonical JSDoc;
3. `implStepPlugin()` for runtime registration and operation mode.

A normal directory contains implementation, colocated tests, benchmark, and `index.ts`; additional type, async, collection, or regression tests remain colocated when required.

## Naming and parameters

- initial schemas use nouns: `string`, `number`, `object`, `looseNumber`;
- built-in validations use natural `isXxx` propositions and preserve successful values;
- concrete transformations use `toXxx` and name the resulting representation;
- generic/flow-control operations retain direct names such as `check`, `transform`, `fallback`, `use`, `generic`, `as`, and `toAsync`.

A named validation enforces only its stated condition. Native primitive conversions delegate to `Number`, `Boolean`, or `BigInt` without hidden parsing, finite-number, integer, or precision policy. Policy conversions use explicit names such as `toSafeNumber` and `toMappedBoolean`.

A message-bearing built-in keeps at most one required semantic operand positional. Optional configuration and `message` belong to one trailing options object; positional messages are forbidden.

## Results and issues

A public failure always contains a non-empty tuple:

```ts
interface ExecutionFailureResult<Issue> {
	issues: [Issue, ...Issue[]]
}
```

Public issues contain `code`, `category`, `payload`, `message`, `path`, and optional `context`. Codes use `<public-step-name>:<snake_case_description>`. Type declarations, category, payload, runtime creation, default message, tests, docs, changelog, and migration material must agree.

`createIssue()` creates an internal draft. Structures finish path, context, and enclosing message scopes; public `execute()` and Standard Schema validation finalize messages once. Priority is originating step message, nearest enclosing structure, outer structures, originating instance global resolver, originating default, then `"Invalid value."`.

Validation and operation failures are recoverable only where documented. Internal issues are fatal: structures stop, unions do not try another branch, and `fallback()` does not invoke its callback.

## Tests and public API

Follow [the testing strategy](.agents/skills/valchecker-dev/references/testing.md). Tests protect observable runtime, type-state, interoperability, or regression contracts; coverage is a guardrail, not the test plan.

For modified steps, cover distinct success/failure semantics, exact boundaries, relevant JavaScript edge cases, every owned issue shape, custom messages, output/issue inference, operation mode, and fluent availability. Add async, ordering, short-circuit, or collect-all cases only when the public contract requires them. Avoid arbitrary timers, tautologies, duplicate complete snapshots, coverage-only fixtures, and implementation-branch names.

Intentional additions, removals, renames, issue/payload changes, or semantic changes must update implementation/package exports, `packages/internal/src/steps/index.ts`, `api-surface.json`, default/selective instances, type tests, benchmark/tree-shaking scenarios, READMEs, VitePress, skills, changelog, and migration material as applicable.

Search the complete repository for superseded names, signatures, codes, commands, and paths. Documentation examples must compile against current exports and signatures, and normative prose must be traceable to implementation or tests.

## Pull requests

Use Conventional Commit intent. Start as Draft, keep the diff focused, inspect the complete diff, run a review-and-fix loop, resolve actionable threads, and verify CI plus every relevant type-performance, bundle-size, and performance-impact workflow.

Do not mark Ready while correctness, types, DX, documentation, issue inference, message finalization, Standard Schema, bundle size, tree-shaking, or performance concerns remain. Squash merge only after all repository gates pass and merge is within requested scope.

## Issue labels

Labels are namespaced by dimension:

- `type:` — `feature`, `fix`, `perf`, `refactor`, `docs`, `test`, `chore`;
- `area:` — `core`, `step`, `all-steps`, `public-api`, `types`, `docs`, `benchmarks`, `ci`;
- `priority:` — `P0` (urgent) through `P2` (opportunistic);
- `status:` — optional workflow state such as `needs-triage`, `blocked`, or `in-progress`.

Apply at most one `type:`, one `area:`, and one `priority:`. The dimensions are orthogonal. Performance issues should link durable benchmark evidence, including the run and scenario data.

## Detailed skills

- `.agents/skills/valchecker-dev/`
- `.agents/skills/valchecker-expert/`
