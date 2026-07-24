# AGENTS.md

## Project overview

Valchecker is an ESM-only TypeScript validation library with state-aware fluent steps, transformed-output inference, structured non-empty issue results, Standard Schema V1 support, and selective tree-shakable plugin registration.

```text
packages/internal/      core implementation and built-in step plugins
packages/all-steps/     runtime-marker-discovered allSteps collection
packages/valchecker/    public package and default v instance
docs/                   VitePress documentation
benchmarks/             runtime, impact, and tree-shaking tooling
type-performance/       TypeScript compiler-complexity fixture and budget
```

## Sources of truth

Before changing the repository, inspect the affected implementation, tests, package manifests, scripts, workflows, API-surface record, benchmarks, and documentation. Do not copy behavior from an older pull request or stale prose when executable repository evidence disagrees.

Repository-wide rules in this file are the baseline. Use `.agents/skills/valchecker-dev/` for repository maintenance and `.agents/skills/valchecker-expert/` for application code that consumes Valchecker. A more specific current rule may refine this file but must not silently contradict it.

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

`pnpm test:coverage` includes `pnpm test:quality`. Run focused tests during development, then the applicable full checks above before completion. Run `pnpm typeperf`, focused step benchmarks, the cross-library benchmark tooling, and bundle-size or performance-impact workflows when the change can affect those contracts.

Every CI pipeline must preserve the failing command's exit code. A command piped into `tee` or another process must run under `set -o pipefail`.

## Code style

- TypeScript strict mode
- single quotes and no semicolons
- tabs for indentation
- functional and immutable patterns
- `/* @__NO_SIDE_EFFECTS__ */` immediately associated with tree-shakable plugin construction
- type-only imports where applicable
- existing repository abstractions and naming before new parallel mechanisms

## Runtime boundary policy

Public runtime inputs remain runtime-validated. TypeScript-only enforcement is an exception and is acceptable only when all of these are true:

1. the surface is low-level, internal-facing, or an explicitly advanced integration API;
2. declarations forbid the operation precisely;
3. violating the contract requires `any`, a type assertion, direct mutation, or untyped JavaScript;
4. failure is confined to the violating caller;
5. unrelated callers, future valid executions, shared state, security, and data integrity cannot be affected;
6. the defense runs on a broad or performance-sensitive path;
7. benchmarks or profiling demonstrate material cost.

Before removing a freeze, copy, assertion, or invariant check, classify ownership and determine whether private execution state and public diagnostic payloads share references. Separate those representations before optimizing when consumer mutation could alter later validation.

Follow [the complete runtime boundary policy](.agents/skills/valchecker-dev/references/runtime-boundaries.md).

## Core architecture contracts

Schemas created by one `createValchecker()` instance share a prototype, not a `Proxy`. Fixed schema properties are own enumerable properties; registered fluent methods are non-enumerable prototype methods. Do not reintroduce a property-read `Proxy` without contract review and benchmark evidence.

`allSteps` discovers exported plugin objects through the runtime marker. Do not maintain a duplicate static plugin list.

A normal built-in step uses:

1. `Meta` for public method name, expected current schema, and owned issue type;
2. `PluginDef` for the state-aware method signature and canonical JSDoc;
3. `implStepPlugin()` for runtime registration and operation mode.

A normal step directory contains its implementation, colocated runtime tests, benchmark, and `index.ts`; additional type, async, collection, or regression tests remain colocated when needed.

## Naming and parameter contracts

- initial schemas use nouns or noun phrases: `string`, `number`, `object`, `looseNumber`;
- built-in validations use natural `isXxx` propositions and preserve successful values;
- concrete transformations use `toXxx` and name the resulting representation;
- generic and flow-control operations retain direct names such as `check`, `transform`, `fallback`, `use`, `generic`, `as`, and `toAsync`.

A named validation enforces only the condition stated by its name. Do not add hidden finite-number, integer, non-empty, parsing, or coercion policy.

Native primitive conversions delegate to the corresponding JavaScript operation:

```text
toNumber  -> Number(value)
toBoolean -> Boolean(value)
toBigint  -> BigInt(value)
```

Native exceptions become structured operation issues when the underlying operation can throw. `NaN`, infinities, truthiness, and `Number(bigint)` precision loss remain native semantics. Policy-bearing conversions use explicit names such as `toSafeNumber` and `toMappedBoolean`.

A message-bearing built-in step keeps at most one required semantic operand positional. Optional configuration and `message` belong to one trailing options object. Direct positional messages are forbidden.

## Result and issue contracts

A public failure always contains at least one issue:

```ts
type ExecutionFailureResult<Issue> = {
	issues: [Issue, ...Issue[]]
}
```

Public issues contain `code`, `category`, `payload`, `message`, `path`, and optional `context`. Issue codes use:

```text
<public-step-name>:<snake_case_description>
```

The type declaration, category, payload, runtime creation, default message, tests, docs, changelog, and migration material must agree.

`createIssue()` creates an internal draft. Nested structures finish path, context, and enclosing message scopes; public `execute()` and Standard Schema validation finalize messages once. Message priority is originating step custom message, nearest enclosing structure message, further enclosing structure messages, originating instance global resolver, originating default, then `"Invalid value."`.

Validation and operation failures are recoverable where the consuming step documents recovery. Internal issues are fatal: structures stop, unions do not try another branch, and `fallback()` does not invoke its callback.

## Testing requirements

Follow [the testing strategy](.agents/skills/valchecker-dev/references/testing.md). Tests protect observable runtime, type-state, interoperability, or regression contracts. Coverage is a diagnostic guardrail, not the test plan.

For a modified step, cover each distinct success and failure semantic, exact boundaries, relevant JavaScript edge cases, every owned issue shape, custom messages, output and issue inference, operation mode, and fluent availability. Add async, ordering, short-circuit, or collect-all cases only when the public contract requires them.

Use table-driven tests for equivalent inputs. Do not add tautological assertions, arbitrary timers, duplicate complete issue snapshots, coverage-only fixtures, or tests named after implementation branches.

## Public API and documentation changes

Intentional additions, removals, renames, issue changes, payload changes, or semantic changes must update every affected surface:

- implementation and package exports;
- `packages/internal/src/steps/index.ts`;
- `api-surface.json` through `pnpm api:surface:update`, followed by `pnpm api:surface`;
- default and selective instance tests;
- type-state and inference tests;
- benchmark adapters and tree-shaking scenarios;
- root and package README files;
- VitePress pages and examples;
- agent skills and contributor guidance;
- changelog and migration material when applicable.

Search the complete repository for superseded method names, signatures, issue codes, commands, and paths before merge. Documentation examples must compile against current exports and signatures, and normative prose must be traceable to implementation or tests.

## Pull requests

Use Conventional Commit intent. Start repository work as a Draft PR, keep the diff focused, inspect the complete diff, run a review-and-fix loop, resolve every actionable review thread, and verify CI plus every relevant type-performance, bundle-size, and performance-impact workflow.

Do not mark a PR Ready while correctness, type-safety, developer experience, documentation, issue inference, message finalization, Standard Schema behavior, bundle size, tree-shaking, or performance concerns remain. Squash merge only after all repository-defined gates pass and merging is within the requested task scope.

## Detailed skills

- `.agents/skills/valchecker-dev/`
- `.agents/skills/valchecker-expert/`
