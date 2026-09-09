---
description: Migrate pre-1.0 Valchecker applications to the 1.0 contract by reviewing runtime support, renamed steps, stricter issue contracts, execution modes, and structural semantics.
relatedSources:
  - package.json
  - packages/valchecker/package.json
  - packages/all-steps/package.json
  - packages/internal/package.json
  - MIGRATION.md
  - scripts/test-packages.ts
  - packages/valchecker/src/index.ts
  - packages/internal/src/core/core.ts
  - packages/internal/src/core/types.ts
  - packages/internal/src/steps/number/number.ts
  - packages/internal/src/steps/looseNumber/looseNumber.ts
  - packages/internal/src/steps/looseBoolean/looseBoolean.ts
  - packages/internal/src/steps/looseBigint/looseBigint.ts
  - packages/internal/src/steps/check/check.ts
  - packages/internal/src/steps/transform/transform.ts
  - packages/internal/src/steps/fallback/fallback.ts
  - packages/internal/src/steps/isAtLeast/isAtLeast.ts
  - packages/internal/src/steps/isAtMost/isAtMost.ts
  - packages/internal/src/steps/isLengthAtLeast/isLengthAtLeast.ts
  - packages/internal/src/steps/isLengthAtMost/isLengthAtMost.ts
  - packages/internal/src/steps/isEmpty/isEmpty.ts
  - packages/internal/src/steps/isInteger/isInteger.ts
  - packages/internal/src/steps/isStartingWith/isStartingWith.ts
  - packages/internal/src/steps/isEndingWith/isEndingWith.ts
  - packages/internal/src/steps/isFinite/isFinite.ts
  - packages/internal/src/steps/toJSONValue/toJSONValue.ts
  - packages/internal/src/steps/toJSONString/toJSONString.ts
  - packages/internal/src/steps/toSplit/toSplit.ts
  - packages/internal/src/steps/toFiltered/toFiltered.ts
  - packages/internal/src/steps/toSorted/toSorted.ts
  - packages/internal/src/steps/toNumber/toNumber.ts
  - packages/internal/src/steps/toBigint/toBigint.ts
  - packages/internal/src/steps/union/union.ts
  - packages/internal/src/steps/intersection/intersection.ts
  - packages/internal/src/steps/object/object.ts
  - packages/internal/src/steps/strictObject/strictObject.ts
  - packages/internal/src/steps/looseObject/looseObject.ts
  - packages/internal/src/steps/toAsync/toAsync.ts
---
# Migrating to Valchecker 1.0

`0.0.33` establishes the intended 1.0 compatibility contract ahead of the 1.0 version itself. Applications upgrading from earlier releases should review the breaking and newly formalized behavior below rather than relying on a successful TypeScript build as the whole migration test.

The repository's [complete migration guide](https://github.com/DevilTea/valchecker/blob/main/MIGRATION.md) remains the exhaustive issue-code mapping, removed-export list, and verification checklist. This page is the reader-facing migration path through the most important decisions.

## Migration map

| Area | What to review | Canonical destination after migration |
| --- | --- | --- |
| Runtime and packaging | Node.js 22+, ESM-only packages, dynamic CommonJS import | [1.0 Contract](/reference/v1-contract#runtime-and-module-support) |
| Step names and signatures | `isXxx` / `toXxx` naming, trailing options objects, removed legacy aliases | [API Reference](/api/overview) |
| Numeric and loose primitive policy | `number()` includes `NaN`/infinities; loose primitives follow template-literal-compatible strings | [Primitives](/api/primitives) |
| Execution | sync/maybe-async preservation, `PromiseLike`, `.toAsync()` | [Sync and Async](/core-concepts/sync-and-async) |
| Results and issues | structured operation/internal categories, renamed codes/payload fields, non-mutating paths | [Issues and Paths](/core-concepts/issues-and-paths) |
| Structures | own-property object semantics, strict/loose behavior, union/intersection changes | [Structured Data](/guides-recipes/structured-data) |
| Extension API | public root exports, plugin-name restrictions, callback/issue typing | [Extending Valchecker](/extending/custom-step-plugins) |

## Required migration review

- Runtime support is Node.js 22 or newer.
- Published packages are ESM-only; CommonJS uses dynamic `import()`.
- Built-in validations now use `isXxx` names, concrete transformations use `toXxx`, and generic `check()` / `transform()` retain their names.
- Numeric `min()` / `max()` become `isAtLeast()` / `isAtMost()`; length bounds become `isLengthAtLeast()` / `isLengthAtMost()`.
- `empty()`, `integer()`, `startsWith()`, and `endsWith()` become `isEmpty()`, `isInteger()`, `isStartingWith()`, and `isEndingWith()`.
- `parseJSON()`, `stringifyJSON()`, and `toSplitted()` become `toJSONValue()`, `toJSONString()`, and `toSplit()`.
- `number()` now matches the JavaScript/TypeScript `number` identity, including `NaN` and positive or negative infinity. Add `isFinite()` where finite values are policy.
- Loose primitives normalize only the primitive or strings accepted by the corresponding TypeScript template-literal primitive model; they are not unrestricted JavaScript coercion.
- `execute()` preserves sync or maybe-async behavior; use `.toAsync()` for an unconditional native promise.
- `check()`, `transform()`, and `fallback()` accept `PromiseLike` callback results for their documented asynchronous operation.
- `union()` returns the first successful branch's transformed output.
- `intersection()` uses graph-aware plain-object composition and rejects incompatible distinct non-plain instances.
- Object validators read declared own properties only; `strictObject()` includes unknown enumerable symbol keys; `looseObject()` preserves unknown own properties.
- Issue-path prepending does not mutate child issues.
- Plugin methods cannot collide with core names or use `then` or symbol names.
- Callback exceptions in `check()`, `transform()`, `toFiltered()`, and `toSorted()` use their step-specific `operation` issues.
- Accidental implementation helpers that were never intended as supported root exports have been removed.

For the complete step-by-step list, including JSON serialization changes, mapped-boolean payloads, `literal()` equality, conversion issue categories, and every issue-code rename, use `MIGRATION.md` rather than duplicating that leaf-level catalog here.

## Rename fluent methods

Before:

<!-- Shows the removed pre-1.0 API on purpose; it must not compile against the current declarations. -->
<!-- typecheck-skip -->
```ts
v.string()
	.min(3)
	.max(20)
	.startsWith('user_')
```

After:

```ts
import { v } from 'valchecker'

v.string()
	.isLengthAtLeast(3)
	.isLengthAtMost(20)
	.isStartingWith('user_')
```

Do the rename by semantics, not by prefix alone. Use each method's generated Reference entry when an old call mixed a semantic operand with a positional message or other removed signature shape.

## Make numeric policy explicit

`number()` is an identity check, not a finite-number policy. Code that previously relied on an implicit finite restriction must add the validation it actually needs:

```ts
import { v } from 'valchecker'

const count = v.number()
	.isFinite()
	.isInteger()
	.isAtLeast(0)
```

The same rule applies when a conversion can produce a value your domain does not accept: conversion and validation are separate pipeline responsibilities.

## Review issue consumers, not only schemas

Message maps, snapshots, API responses, and form adapters can break even when schema construction still typechecks. Review code that switches on issue codes or reads payload fields.

Important migration classes include:

- numeric bounds use explicit `minimum` / `maximum` payload fields;
- length bounds use `minimumLength` / `maximumLength`;
- `isAtLeast()` and `isAtMost()` each share one issue code across number/bigint variants while retaining discriminated payload unions;
- `toJSONString:serialization_failed`, `toNumber:conversion_failed`, and `toBigint:conversion_failed` are `operation` issues;
- `check()`, `transform()`, `toFiltered()`, and `toSorted()` use their documented step-specific callback failure code instead of a generic validation/core error.

Use [Custom Messages and Error Responses](/guides-recipes/custom-messages-and-errors) for application handling patterns and the generated step entry for the exact current payload.

## Review asynchronous call sites

Do not assume every schema with an async-capable step always returns a promise. An early synchronous failure may prevent asynchronous work from being reached.

Use `await schema.execute(input)` when either reached mode is acceptable. Append `.toAsync()` when an API boundary requires an unconditional promise. See [Synchronous and Asynchronous Execution](/core-concepts/sync-and-async) for the complete model.

## Verify structural output assumptions

Re-test code that depended on unknown object properties, prototype inheritance, symbol keys, branch output selection, or intersection merging. These are observable output contracts, not implementation details.

Prefer task-level tests that assert the output your application consumes. Use [Structured Data](/guides-recipes/structured-data) for composition patterns and the generated [Structures Reference](/api/structures) for exact per-step behavior.

## Finish with the exhaustive checklist

Before declaring a migration complete:

1. run the repository/application typecheck against the upgraded packages;
2. execute representative success and failure paths, including issue consumers;
3. review every item in [`MIGRATION.md`](https://github.com/DevilTea/valchecker/blob/main/MIGRATION.md);
4. compare any relied-on formal guarantee with the [Valchecker 1.0 Contract](/reference/v1-contract);
5. verify published-package behavior in the same module/runtime environment used in production.

## Reporting a problem

Report a problem with:

- exact Valchecker version;
- Node.js and TypeScript versions;
- module resolution mode;
- minimal schema and input;
- actual and expected result;
- whether execution used `execute()` or `~standard`.

Fixes are published under new versions; existing npm versions are never overwritten.
