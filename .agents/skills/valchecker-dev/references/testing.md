# Testing Strategy

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

Cross-step contract tests import the source barrel (`./index`), never the package self-reference (`../..`), which resolves to built `dist/` and makes results depend on a stale build. Colocated step tests in `steps/<name>/` may use `../..` because that path reaches the source barrel from their directory. Published `dist` correctness belongs to package smoke tests.

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

For ordered or ranged behavior, cover the exact boundary and one representative value on each side. Avoid enumerating arbitrary values that do not add a semantic class.

A named validation must be tested independently from adjacent policy. For example, `isAtLeast(0)` accepts positive infinity, while `isFinite().isAtLeast(0)` rejects it through `isFinite`.

## Primitive and loose-primitive contracts

Primitive initial schemas align with TypeScript and JavaScript identity. `number()` must accept `NaN`, positive and negative infinity, and negative zero.

TypeScript-aligned loose primitive fixtures must keep compile-time template-literal expectations and runtime grammar synchronized. Include counter-intuitive cases that a seemingly reasonable parser tightening could break:

- `looseNumber` accepts `'+1'`, `'0b101'`, `'0o17'`, `'5.'`, and `'01'`;
- `looseNumber` rejects `'1_000'`, empty strings, `'NaN'`, and `'Infinity'`;
- `looseBigint` accepts lowercase radix forms such as `'0b101'`;
- primitive pass-through includes numeric `NaN` and infinity where the primitive contract permits them.

Keep these fixtures synchronized with the reference-semantics comments and compile-time tests in the implementation.

## Native conversion contracts

Native conversion tests must distinguish JavaScript coercion from parsing or validation. Cover applicable cases such as:

- `NaN` and infinities;
- empty and whitespace-only strings;
- truthiness and falsiness;
- symbols and native exceptions;
- bigint precision loss through `Number(bigint)`;
- synchronous throws versus asynchronous callback rejection.

Generic conversion names must not acquire hidden parsing, finite-number, safe-integer, or mapping policy.

## Assertions

Prefer assertions that state the contract directly.

- Use one exact assertion for each owned issue shape.
- Use `toMatchObject` in composition tests when only code, path, context, category, or selected payload fields matter.
- Verify reference identity, immutability, call count, or execution order when those are part of the contract.
- Exercise configured message handlers on an actual failure path.
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
- documented parallel work starts before the gate is released;
- `.toAsync()` makes synchronous success and early failure return native promises.

Use `execute()`; there is no `runAsync()` method.

## Structural and combinator requirements

Structural schemas must cover nested paths, issue aggregation, required and optional keys, own versus inherited properties, string and symbol keys, asynchronous children, output materialization, and their documented extra-key policy.

Combinators must cover branch order, selected output, recoverable issue aggregation, internal-failure short-circuiting, issue context, mixed synchronous and asynchronous branches, and reference topology when outputs are merged.

Collection and structural tests must preserve documented behavior for sparse arrays, duplicate transformed keys or items, live iteration, collect-all execution, and output materialization when those contracts apply.

## Transformation requirements

Transformation tests assert both runtime output and the resulting type-state. They must verify the next fluent methods and inferred output available after the transformation.

JSON transformations cover successful parsing or serialization, malformed input, unsupported values, circular structures, native exceptions, and custom messages as applicable.

## Coverage policy

Coverage identifies untested code and accidental erosion. It does not define the test plan.

- Threshold numbers have one source of truth in `scripts/coverage-policy.ts`.
- Vitest applies aggregate repository thresholds from that policy.
- `scripts/check-coverage.ts` applies default and overridden per-file floors from the same policy to the generated summary.
- Per-file floors prevent large untested islands.
- Critical core and combinator areas may have higher thresholds.
- An uncovered line must be investigated, but it does not automatically justify a test.
- Unreachable or defensive branches may remain uncovered when the reason is documented and the surrounding public contract is protected.

Changes must not lower thresholds merely to pass CI. Recalibrate thresholds only as an intentional test-system change with an explained baseline.

## Running tests

Use the repository scripts rather than bypassing quality checks:

```bash
pnpm test
pnpm test:coverage
pnpm typecheck
```

Focused Vitest execution is appropriate while developing, but the full `pnpm test:coverage` command must run before completion because it includes repository test-quality checks and the coverage policy.

For public API changes, also run the relevant build, lint, API-surface, installed-consumer, package, documentation, benchmark, and tree-shaking checks defined by `AGENTS.md` and the development skill.

## Review checklist

Reviewers should reject a test when:

- another layer already owns the complete contract;
- the assertion would still pass after a plausible broken mutation;
- the test follows an implementation branch instead of public behavior;
- a table-driven case would express the same semantic class more clearly;
- an `as any` cast hides an API-state error;
- timing or ordering relies on an uncontrolled delay;
- the name does not explain the protected behavior.

Before merge, confirm:

- no skipped tests were introduced;
- owned issue codes and payloads have one complete assertion;
- default and selective instances expose the intended methods;
- type-state, operation-mode, and transformed-output contracts are synchronized;
- removed public names and issue codes remain only in explicit migration examples;
- `api-surface.json` matches generated output when the public surface changed;
- benchmark fixtures compile against the same public API;
- coverage thresholds and quality checks pass without coverage-only tests.

For complex changes, inspect coverage as a map and use mutation testing selectively to evaluate assertion strength. Mutation score is a diagnostic signal, not a reason to encode implementation details into tests.
