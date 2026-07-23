# Testing strategy

Valchecker tests protect observable runtime behavior, type-state contracts, interoperability, and regressions. Coverage is a diagnostic guardrail; it is never the sole reason to add a test.

## Test ownership

Every contract has one owning test layer. Higher layers may assert the part of a nested result that matters to their scenario, but they must not duplicate a lower layer's complete contract.

### Core runtime contracts

Core tests own result discrimination, pipeline execution, synchronous and asynchronous transitions, PromiseLike assimilation, issue path and context handling, message resolution, plugin registration, exception normalization, and final result cleanup.

Core tests must not duplicate the domain semantics of individual built-in steps.

### Step runtime contracts

A step's colocated `<step>.test.ts` owns:

- successful runtime semantics;
- each distinct failure reason produced by the step;
- exact boundaries and JavaScript-specific edge cases;
- one complete assertion for every issue code owned by the step;
- custom message behavior for owned issues;
- output preservation or transformation invariants;
- asynchronous behavior only when the step accepts callbacks or child schemas that may be asynchronous.

Other tests that receive the same issue should assert only the fields relevant to their composition scenario.

### Step-family conformance

Shared plumbing belongs to family-level conformance tests instead of being repeated in every step module. Families include:

- initial schemas;
- predicate validations;
- pure transformations;
- native conversions;
- callback operations;
- structural schemas;
- combinators.

Family tests verify common invariants. Local step tests retain semantics that distinguish one step from the rest of the family.

### Type contracts

Type-only tests own:

- output inference;
- issue inference and discriminated payload narrowing;
- operation-mode inference;
- fluent method availability;
- expected compile-time failures.

Runtime tests should not use `as any` to bypass a type contract unless they intentionally exercise a JavaScript-only or hostile runtime boundary. Such casts require an inline explanation.

### Integration contracts

Cross-cutting tests own behavior that cannot be proven by one core or step module, including:

- Standard Schema interoperability;
- schemas composed from different Valchecker instances;
- nested message-scope priority;
- operation-mode propagation through structural and combinator steps;
- package exports and selective registration;
- published-package behavior.

Cross-step contract tests import the source barrel (`./index`), never the package self-reference (`../..`), which resolves to the built `dist/` and makes results depend on a stale build. `dist` correctness belongs to the package smoke tests.

### Regression tests

A regression test records the external symptom or invariant that previously failed. Reference the relevant issue or pull request when available.

Name the observable behavior, not the implementation branch that caused the bug.

## Required case design

Before adding a test, identify:

1. the production mutation that would make it fail;
2. the runtime, type, interoperability, or regression contract it protects;
3. the owning test layer;
4. whether the input represents a new equivalence class;
5. whether the assertion distinguishes a broken implementation from a correct one.

A test that cannot answer these questions should not be added.

## Equivalence classes and boundaries

Use `it.each` for inputs that exercise the same behavior. Keep separate cases when JavaScript semantics differ materially, such as:

- `NaN`, infinities, and negative zero;
- `null` and arrays in object classification;
- symbols and native conversion exceptions;
- inherited, symbol, accessor, and `__proto__` properties;
- aliases, cycles, and prototype differences;
- synchronous throws and asynchronous rejections.

For ordered or ranged behavior, cover the exact boundary and one representative value on each side. Avoid enumerating arbitrary values that do not add a new semantic class.

For TypeScript-aligned loose primitives, fixtures must include the counter-intuitive template-literal cases a "tightening" would silently break — for example `looseNumber` accepting `'+1'`, `'0b101'`, `'0o17'`, `'5.'`, `'01'` while rejecting `'1_000'`. See the loose primitive grammar section of the contributor testing guide.

## Assertions

Prefer assertions that state the contract directly.

- Use one exact assertion for each owned issue shape.
- Use `toMatchObject` in composition tests when only code, path, context, category, or selected payload fields matter.
- Verify reference identity, immutability, call count, or execution order when those are part of the contract.
- Exercise configured error handlers on an actual failure path.
- Exercise methods and interoperability surfaces instead of only asserting that properties are defined.

Do not add:

- tautological comparisons;
- existence-only assertions for behavior that can be executed;
- arbitrary timers;
- duplicated full issue snapshots;
- tests named after coverage, branches, fast paths, loop lengths, or implementation details;
- fixtures whose only purpose is to execute an uncovered line.

## Asynchronous tests

Use resolved promises, explicit deferred gates, or controlled thenables. Do not use `setTimeout` merely to make a callback asynchronous.

Test these as separate contracts when applicable:

- an earlier synchronous failure remains synchronous;
- a successful callback changes the result to a native Promise;
- a returned PromiseLike is assimilated;
- a synchronous throw and an asynchronous rejection report different phases;
- later work is skipped or continued according to the public step contract;
- documented parallel work actually starts before the gate is released.

## Structural and combinator requirements

Structural schemas must cover nested paths, issue aggregation, required and optional keys, own versus inherited properties, string and symbol keys, asynchronous children, output materialization, and their documented extra-key policy.

Combinators must cover branch order, selected output, recoverable issue aggregation, internal-failure short-circuiting, issue context, mixed synchronous and asynchronous branches, and reference topology when outputs are merged.

## Coverage policy

Coverage identifies untested code and accidental erosion. It does not define the test plan.

- Threshold numbers have one source of truth in `scripts/coverage-policy.ts`.
- Vitest applies the aggregate repository thresholds from that policy.
- `scripts/check-coverage.ts` applies the default and overridden per-file floors from the same policy to the generated summary.
- Per-file floors prevent large untested islands.
- Critical core and combinator areas may have higher thresholds.
- An uncovered line must be investigated, but it does not automatically justify a test.
- Unreachable or defensive branches may remain uncovered when the reason is documented and the surrounding public contract is protected.

Changes should not lower thresholds merely to pass CI. Recalibrate thresholds only as an intentional test-system change with an explained baseline.

## Review checklist

Reviewers should reject a test when:

- another layer already owns the complete contract;
- the assertion would still pass after a plausible broken mutation;
- the test follows an implementation branch instead of public behavior;
- a table-driven case would express the same semantic class more clearly;
- an `as any` cast hides an API-state error;
- timing or ordering relies on an uncontrolled delay;
- the name does not explain the protected behavior.

For complex changes, inspect coverage as a map and use mutation testing selectively to evaluate assertion strength. Mutation score is a diagnostic signal, not a reason to encode implementation details into tests.
