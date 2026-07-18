# Changelog

All notable changes to Valchecker are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and published versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-rc.0] - Unreleased

This release candidate establishes the intended Valchecker 1.0 compatibility contract. It is a prerelease and is published under the npm `next` tag only after explicit approval.

### Added

- Exact length, string/array inclusion, regular-expression, strict numeric-bound, divisibility, and safe-integer validation steps.
- Primitive equality and tuple membership through `isEqualTo()` and `isOneOf()` with `Object.is` semantics and state-aware output narrowing.
- Defined, non-null, and non-nullish narrowing steps that disappear once their excluded values are impossible.
- Unicode string normalization through `toNormalized()`.
- Array mapping through `toMapped()` with typed output and structured callback-operation diagnostics.
- Standard Schema V1 support on every schema through `~standard`.
- Native `PromiseLike` assimilation for callback-driven validation and transformation steps.
- `.toAsync()` for callers that require every execution to return a native promise.
- First-success transformed-output semantics for `union()`.
- Graph-aware `intersection()` composition for compatible plain objects, cycles, aliases, enumerable symbol keys, and same-reference non-plain values.
- Safe own-property handling for declared `__proto__` fields.
- Own-property-only reads for declared object fields, explicit `*:missing_key` issues, and distinct missing-versus-present-`undefined` semantics.
- Strict-object detection of unknown enumerable symbol keys with combined unknown/missing/invalid-field reporting.
- Descriptor-preserving unknown fields in `looseObject()`.
- Immutable issue-path prepending that supports frozen and reused child issues.
- Explicit issue categories (`validation`, `operation`, and `internal`) plus optional non-data issue context, including union branch provenance.
- Deferred, single-pass message finalization with final nested paths and enclosing structure message scopes.
- Structured `core:message_exception` failures when a message handler throws.
- An explicit message-resolution order: originating step, enclosing structures, originating global resolver, default, then `"Invalid value."`.
- Public runtime and declaration export manifests for all published packages.
- Installed-tarball consumer tests for ESM, CommonJS dynamic import, TypeScript `NodeNext`, and TypeScript `Bundler` resolution.
- Coverage gates, documentation builds, cross-library benchmarks, generated benchmark reports, and immutable release-artifact validation in CI.
- npm trusted publishing through a protected, manually dispatched GitHub Actions workflow using OIDC.
- `isFinite()`, `isNaN()`, and `isNotEmpty()` built-in validation steps.
- `looseBoolean()` and `looseBigint()` initial schemas.
- Native primitive coercion transformations: `toNumber()`, `toBoolean()`, and `toBigint()`.
- Explicit conversion policies through `bigint().toSafeNumber()` and `toMappedBoolean()`.
- Typed domain issues through `check<AddedIssue>()` and `addIssue()`.
- Step-specific operation issues for callback, string-conversion, and JSON-serialization failures.

### Changed

- Standardized all message-bearing built-in step parameters around trailing options objects and removed positional messages.
- Number `isMultipleOf()` accepts ordinary decimal multiples using a documented floating-point tolerance, while bigint divisibility remains exact.
- The supported runtime is Node.js 22 or newer.
- Published packages are ESM-only. CommonJS consumers must use dynamic `import()`.
- `execute()` now has a documented sync/maybe-async contract instead of being described as universally asynchronous.
- Callback-driven steps may return direct values or thenables according to their step contract.
- `object()` omits unknown input properties from output, while `looseObject()` preserves them.
- `strictObject()` checks all enumerable own string and symbol keys.
- `use()` preserves delegated transformed output and issue types.
- `@valchecker/internal` is the semver-covered advanced root API for step-plugin authors; package-private source paths remain unsupported.
- Lint checks are non-mutating; automatic formatting is available through `pnpm lint:fix`.
- Version changes are reviewed pull requests. The release workflow no longer edits Git history or creates tags.
- Built-in step names now expose their pipeline role: initial schemas use nouns, built-in validations use `isXxx`, and concrete transformations use `toXxx`. Generic `check()` and `transform()` retain their direct names.
- `number()` now matches the TypeScript `number` primitive and accepts `NaN`, `Infinity`, and `-Infinity`; finite-number policy is explicit through `isFinite()`.
- `looseNumber()` now accepts `number` or a TypeScript-compatible number string and normalizes output to `number`, rather than duplicating the old `number()` behavior.
- Numeric bounds and length bounds are separate steps so their intent and payloads are explicit.
- Primitive `toXxx()` conversions follow JavaScript `Number()`, `Boolean()`, and `BigInt()` semantics without hidden finite, parsing, truthiness, or precision-safety policies.
- Identity primitive conversions are excluded from state-aware autocomplete; policy-bearing conversions use explicit names.
- Failure issue arrays are typed as non-empty tuples.
- `core:unknown_exception` now exposes the received execution result as `receivedResult` instead of the misleading `value` field.
- Message maps preserve same-code payload variants and allow callbacks to return `null` or `undefined` to continue resolution.
- Combinators now treat internal issues as fatal: union cannot skip them, fallback cannot recover them, and object/array sibling traversal stops immediately.
- `intersection:conflicting_outputs` reports precise conflict paths, branch indices, values, and reason codes.
- Fallback callback failures retain the original issues and append an `operation`-category `fallback:failed` issue with a required error.
- `check:failed` now discriminates returned-false and returned-message payloads; callback exceptions use `check:callback_failed`.
- `transform`, `toFiltered`, and `toSorted` callback exceptions now preserve phase or operand context in operation issues.
- `toJSONString()` reports stable reason/path payloads, performs a single-read preflight, preserves boxed primitive semantics, and classifies getter, Proxy, and `toJSON` failures as operations.
- Length validation issues include the observed `length`; mapped-boolean failures include immutable mapping snapshots.
- `literal()` uses `Object.is`, and bigint conversion failures use `toBigint:conversion_failed`.

### Renamed

- `empty()` → `isEmpty()`
- `integer()` → `isInteger()`
- `startsWith()` → `isStartingWith()`
- `endsWith()` → `isEndingWith()`
- numeric `min()` → `isAtLeast()`
- numeric `max()` → `isAtMost()`
- length `min()` → `isLengthAtLeast()`
- length `max()` → `isLengthAtMost()`
- `parseJSON()` → `toJSONValue()`
- `stringifyJSON()` → `toJSONString()`
- `toSplitted()` → `toSplit()`
- issue code `transform:failed` → `transform:callback_failed`
- issue code `toBigint:invalid_bigint` → `toBigint:conversion_failed`

Issue codes for renamed built-in steps now use the public step name, including `isAtLeast:expected_at_least`, `isLengthAtLeast:expected_length_at_least`, and `toJSONValue:invalid_json`.

### Removed

The following accidental implementation exports are no longer part of the public package surface:

- `noop`
- `returnTrue`
- `isPromiseLike`
- `runtimeExecutionStepDefMarker`
- `createPipeExecutor`
- `handleMessage`
- `prependIssuePath`
- `resolveMessagePriority`

The release workflow no longer:

- bumps package versions,
- commits or pushes changes,
- creates or pushes Git tags,
- executes unpinned release-note tooling,
- publishes directly from workspace directories,
- uses a long-lived npm token.

### Security

- npm publication is restricted to a manually dispatched workflow on `main`, protected by the `npm` GitHub environment.
- Publication uses job-scoped OIDC and rejects `NPM_TOKEN` and `NODE_AUTH_TOKEN`.
- Exact tarball paths, sizes, SHA-256 checksums, package order, commit identity, npm tag, and typed confirmation are verified immediately before publication.
- CI rejects source files, tests, benchmarks, TypeScript configuration, and unresolved workspace/catalog dependency protocols in published tarballs.

## Pre-1.0 history

Versions before `1.0.0-rc.0` were development releases and did not provide the full compatibility guarantees documented for the 1.0 line. Refer to Git history and merged pull requests for detailed pre-1.0 changes.

[1.0.0-rc.0]: https://github.com/DevilTea/valchecker/releases/tag/v1.0.0-rc.0
