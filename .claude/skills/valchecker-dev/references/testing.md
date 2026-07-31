# Testing Strategy

Valchecker tests protect observable runtime behavior, state-aware TypeScript contracts, interoperability, and regressions. Coverage is a diagnostic guardrail, never the sole reason for a test.

## Ownership

- Core tests own pipeline execution, sync/async transitions, PromiseLike assimilation, result normalization, issue finalization, message priority, plugin registration, and Standard Schema behavior.
- A step's colocated tests own its success semantics, distinct failure reasons, exact boundaries, JavaScript edge cases, owned issue shapes, custom messages, transformation invariants, and applicable async behavior.
- Type tests own input/output/issue inference, operation mode, fluent availability, and expected compile-time failures.
- Family contract tests own shared initial/validation/transform/callback/structural/combinator plumbing.
- Integration tests own cross-instance schemas, nested message scopes, package exports, selective registration, and installed-package behavior.
- Regression tests name and preserve the observable symptom that previously failed.

Higher layers may assert fields relevant to composition but must not duplicate a lower layer's complete issue contract.

Root-level cross-step tests under `packages/internal/src/steps/` are named `<family>.<aspect>.test.ts` and import the source barrel through `../index`. Colocated tests under `steps/<name>/` are the step's single `<name>.test.ts` plus an optional `<name>.types.test.ts`, and may import `../..`, which resolves to that same source barrel from their directory. Which file a test belongs in, and what a step directory may hold at all, is [the step unit](./step-unit.md). Published `dist` behavior belongs to package smoke tests.

## Case design

Before adding a case, identify:

1. the public/runtime/type contract protected;
2. its owning test layer;
3. a plausible broken production mutation that would make it fail;
4. the semantic equivalence class or exact boundary represented;
5. why the assertion distinguishes correct behavior from a broken implementation.

Use `it.each` for equivalent inputs. Keep separate cases for materially different JavaScript semantics such as `NaN`, infinities, negative zero, symbols, native exceptions, inherited/symbol/accessor/`__proto__` properties, aliases/cycles/prototypes, and synchronous throws versus asynchronous rejections.

For ranges, test the boundary and one representative value on each side. Test named validations independently from adjacent policy; for example, `isAtLeast(0)` accepts positive infinity while `isFinite().isAtLeast(0)` rejects it through `isFinite`.

## Issues and results

Each owned issue code, category, payload shape, path/context behavior, default message, and custom message needs one complete owning assertion. Failure results are non-empty tuples. Composition tests should use partial matching when only selected fields matter.

Message-handler tests must reach a real failure. Include enclosing structure and global tiers where the contract is under test. Verify handler exceptions become `core:message_exception` at the public boundary.

Internal-issue fatality is a contract every structure, combinator, and recovery path must be tested against; see [architecture](./architecture.md#structural-execution).

## Primitive and conversion contracts

`number()` accepts every JavaScript number, including `NaN`, infinities, and negative zero.

Keep loose-primitive runtime fixtures synchronized with their TypeScript template-literal input types. Cover counter-intuitive accepted and rejected forms, primitive pass-through, whitespace/empty-string distinctions, radix strings, and bigint grammar.

Native conversions must distinguish coercion from parsing or policy. Cover applicable `NaN`, infinities, empty/whitespace strings, truthiness, symbols/native exceptions, and `Number(bigint)` precision loss.

## Async tests

Use resolved promises, controlled thenables, or explicit deferred gates. Do not use arbitrary timers merely to force asynchrony.

Test separately when applicable:

- an earlier failure remains synchronous;
- a reached callback returns a native promise or assimilated PromiseLike;
- throw and rejection phases remain distinct;
- later work is skipped or continued according to the public contract;
- `.toAsync()` makes success and early failure return native promises.

Use `execute()`; there is no `runAsync()` API.

## Structures and combinators

Cover nested paths, own versus inherited properties, string and symbol keys, missing versus present-`undefined`, optional output materialization, extra-key policy, sparse arrays, duplicate transformed collection entries, live iteration, first versus collect-all traversal, async children, internal-failure short-circuiting, branch order, provenance context, and output reference topology where applicable.

## Coverage policy

`scripts/coverage-policy.ts` is the single source of threshold values. Vitest aggregate thresholds and `scripts/check-coverage.ts` per-file floors consume that policy. Do not lower thresholds solely to pass CI, and do not add coverage-only fixtures or implementation-branch tests.

Use focused Vitest runs (`pnpm test <path>`) while working; `pnpm verify` covers the rest.
