# AGENTS.md

## Project overview

Valchecker is a modular TypeScript validation library with state-aware fluent steps, transformed-output inference, structured issues, Standard Schema V1 support, and selective tree-shakable plugin registration.

```text
packages/internal/      core and built-in step plugins
packages/all-steps/     dynamic allSteps collection
packages/valchecker/    public package and default v instance
docs/                   VitePress documentation
benchmarks/             runtime and tree-shaking reports
```

## Verification

```bash
pnpm install
pnpm build
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm docs:build
```

Run relevant benchmarks for performance or bundle-sensitive changes.

## Code style

- TypeScript strict mode
- single quotes and no semicolons
- tabs for indentation
- functional and immutable patterns
- `/* @__NO_SIDE_EFFECTS__ */` on tree-shakable plugin exports
- follow existing core and step patterns

## Step naming contract

### Initial schemas

Use nouns or noun phrases: `string`, `number`, `object`, `looseNumber`, `looseBoolean`, `looseBigint`.

Primitive initial schemas align with TypeScript primitive identities. `number()` accepts every JavaScript number, including `NaN` and positive or negative infinity.

Loose primitives accept the primitive or its corresponding TypeScript template-literal string representation and normalize to the primitive. Do not implement them with unrestricted JavaScript coercion.

### Built-in validations

Use natural `isXxx` names and preserve the successful value:

```text
isEmpty, isNotEmpty, isInteger, isFinite, isNaN,
isAtLeast, isAtMost, isLengthAtLeast, isLengthAtMost,
isStartingWith, isEndingWith
```

Each validation must enforce only the condition named by the method. Do not add hidden finite-number, integer, or non-empty policies.

### Concrete transformations

Use `toXxx` and describe the resulting representation:

```text
toTrimmed, toLowercase, toSplit, toJSONValue, toJSONString,
toNumber, toBoolean, toBigint, toSafeNumber, toMappedBoolean,
toSorted, toFiltered
```

Native primitive conversions must delegate to their corresponding JavaScript operation without hidden policy:

```text
toNumber  -> Number(value)
toBoolean -> Boolean(value)
toBigint  -> BigInt(value)
```

Native exceptions become structured issues when applicable. Special values such as `NaN` and infinity remain successful `number` outputs. Precision loss from `Number(bigint)` is not blocked by `toNumber()`.

Policy-bearing conversions require explicit names. `toSafeNumber()` enforces the safe integer range; `toMappedBoolean()` uses caller-provided mappings. Identity primitive conversions are unavailable in the state-aware API.

### Generic and flow-control operations

Keep the direct semantic name: `check`, `transform`, `fallback`, `use`, `generic`, `as`, `toAsync`.

`check()` and `transform()` are generic escape hatches and intentionally do not use artificial `isValid` or `toTransformed` names.

Message-bearing steps keep at most one required semantic operand positional. All optional configuration and `message` belong to one trailing options object; direct positional messages are forbidden.
- message-bearing steps keep one required operand positional and place all optional configuration plus `message` in one trailing options object; direct positional messages are forbidden;

## Step structure

A normal built-in step module contains:

```text
packages/internal/src/steps/<module>/
├── <module>.ts
├── <module>.test.ts
├── <module>.bench.ts
└── index.ts
```

Module directory and file names must match the public step name. Public exports, `Meta.Name`, and the plugin object define API identity.

Steps use three layers:

1. `Meta` for method name, expected current schema, and self issue.
2. `PluginDef` for state-aware TypeScript signatures and JSDoc.
3. `implStepPlugin()` for runtime behavior.

## Testing requirements

Follow [`.github/TESTING.md`](.github/TESTING.md). Tests must protect observable runtime, type-state, interoperability, or regression contracts. Coverage is a guardrail and must not be the sole reason for a case.

For every modified step:

- cover each distinct success and failure semantic;
- cover exact boundaries and JavaScript-specific edge cases;
- assert every owned issue code and payload shape once in the step's owning test;
- verify custom messages for owned issues;
- keep output, issue, operation-mode, and fluent-availability type contracts synchronized;
- cover asynchronous, early-failure, ordering, and short-circuit behavior only where the public contract requires it.

Use table-driven tests for equivalent inputs. Do not add tautological assertions, arbitrary timers, duplicated complete issue snapshots, or tests named after coverage and implementation branches.

For TypeScript-aligned loose primitives, keep compile-time template-literal expectations and runtime fixtures synchronized.

For native conversion steps, include edge cases that distinguish JavaScript coercion from parsing or validation, including `NaN`, infinity, empty strings, truthiness, native exceptions, and bigint precision loss.

## Issue codes

Format:

```text
<public-step-name>:<snake_case_description>
```

Examples:

```text
string:expected_string
isFinite:expected_finite
isAtLeast:expected_at_least
toJSONValue:invalid_json
toBigint:conversion_failed
toSafeNumber:out_of_safe_integer_range
toMappedBoolean:unmapped_value
check:failed
check:callback_failed
transform:callback_failed
toFiltered:callback_failed
toSorted:callback_failed
toString:conversion_failed
toJSONString:serialization_failed
```

Type declarations, runtime creation, tests, docs, and migration notes must agree.

## Public API changes

Intentional additions, removals, renames, or semantic changes must update:

- implementation exports and `packages/internal/src/steps/index.ts`,
- `api-surface.json`,
- default and selective instance tests,
- benchmark adapters and tree-shaking scenarios,
- root and package README files,
- all VitePress references and examples,
- agent skills and contributor guidance,
- changelog and migration material when applicable.

Search the full repository for removed method names and issue codes before merging.

`allSteps` discovers exported plugin objects through the runtime marker; do not manually maintain a duplicate static list.

## Pull requests

Use conventional commit intent, run full verification, inspect the complete diff, resolve review feedback, and confirm CI plus relevant benchmark workflows before merge.

## Detailed skills

- `.github/skills/valchecker-dev/`
- `.github/skills/valchecker-expert/`
