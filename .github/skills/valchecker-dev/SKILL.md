---
name: valchecker-dev
description: Guide for developing and contributing to Valchecker, including step plugins, tests, benchmarks, public API changes, and documentation.
---

# Valchecker Development Guide

Use this guide when changing the Valchecker repository itself.

## Required verification

```bash
pnpm install
pnpm build
pnpm lint
pnpm typecheck
pnpm test --coverage
pnpm docs:build
```

Run relevant benchmarks for runtime or bundle-sensitive changes.

## Project structure

```text
packages/internal/     core implementation and built-in step plugins
packages/all-steps/    automatic allSteps collection
packages/valchecker/   public package and default v instance
docs/                  VitePress documentation
benchmarks/             cross-library and tree-shaking reports
api-surface.json        recorded public exports
```

## Step implementation pattern

Every built-in step uses:

1. `Meta` — method name, expected current schema, and self issue type.
2. `PluginDef` — state-aware public method type and JSDoc.
3. `implStepPlugin` — runtime implementation.

A normal step directory contains:

```text
packages/internal/src/steps/<module>/
├── <module>.ts
├── <module>.test.ts
├── <module>.bench.ts
└── index.ts
```

Some historical module directory names may differ from the current public method name. Public exports and `Meta.Name` define the API; avoid file moves that add noise without architectural value.

## Built-in naming contract

### Initial schemas

Use nouns or noun phrases:

```text
string, number, boolean, bigint, object, strictObject,
looseNumber, looseBoolean, looseBigint
```

Primitive initial schemas align with TypeScript primitive identities. `number()` therefore accepts `NaN` and positive or negative infinity.

Loose primitive schemas accept the primitive or its matching TypeScript template-literal string representation and normalize to the primitive. They must not use unrestricted JavaScript coercion.

### Built-in validations

Use natural `isXxx` boolean propositions and preserve the successful value:

```text
isEmpty, isNotEmpty, isInteger, isFinite, isNaN,
isAtLeast, isAtMost, isLengthAtLeast, isLengthAtMost,
isStartingWith, isEndingWith
```

Do not mechanically create grammatically invalid names such as `isStartsWith`. A validation must enforce only the condition named by the method; do not add hidden finite-number or non-empty requirements.

### Concrete transformations

Use `toXxx` and name the resulting representation:

```text
toTrimmed, toLowercase, toSplit, toJSONValue,
toJSONString, toSorted, toFiltered
```

### Generic and flow-control steps

Keep the most direct semantic verb:

```text
check, transform, fallback, use, generic, as, toAsync
```

`check()` and `transform()` are generic escape hatches and intentionally do not use synthetic `isValid` or `toTransformed` names.

## Issue codes

Use:

```text
<public-step-name>:<snake_case_description>
```

Examples:

```text
string:expected_string
isFinite:expected_finite
isAtLeast:expected_at_least
toJSONValue:invalid_json
check:failed
```

The type-level `SelfIssue`, runtime `createIssue()` call, tests, docs, and migration notes must agree.

## Adding or changing a step

1. Define the runtime and type-level contract.
2. Confirm where the method is available in the state-aware chain.
3. Implement the step and tree-shaking annotation.
4. Add success, failure, message, async, and edge-case tests as applicable.
5. Add a benchmark file.
6. Export it from `packages/internal/src/steps/index.ts`.
7. Update `api-surface.json` for intentional public export changes.
8. Update README files, VitePress pages, examples, agent skills, and migration/changelog material.
9. Run full repository verification.

`allSteps` discovers exported plugin objects through the runtime marker; do not manually maintain a second static list unless its implementation changes.

## Testing requirements

Step implementations require 100% coverage. Test:

- successful and failed execution,
- default and custom messages,
- payload and issue code shape,
- state-aware type availability,
- transformed output inference,
- synchronous, asynchronous, and early-failure paths when relevant,
- exact boundary behavior for TypeScript-aligned loose primitives.

For loose primitives, keep compile-time template-literal expectations and runtime grammar fixtures aligned.

## Public API review

A public rename or semantic change must update:

- implementation exports,
- `api-surface.json`,
- default and selective instance tests,
- benchmark adapters and tree-shaking scenarios,
- package README and root README,
- all VitePress references and examples,
- agent skills and contributor guidance,
- changelog and migration documentation when applicable.

Search the entire repository for removed method names and issue codes before merging.

## Performance and tree-shaking

Keep runtime checks direct and allocation-conscious. Preserve `/* @__NO_SIDE_EFFECTS__ */` annotations. For selective-import changes, run the tree-shaking report and verify unselected method markers are absent from the minimal bundle.

Do not trade semantic correctness for microbenchmark wins. Keep only changes with measured value and documented trade-offs.

## References

- [Architecture](./references/architecture.md)
- [Conventions](./references/conventions.md)
- [Testing](./references/testing.md)
- [Benchmarking](./references/benchmarking.md)
- [PR Checklist](./references/checklist.md)
- [Implementation Examples](./references/examples.md)
- [Repository documentation](../../../docs/index.md)
