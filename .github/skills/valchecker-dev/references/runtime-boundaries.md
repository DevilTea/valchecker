# Runtime Boundary Policy

Use this policy when adding, retaining, removing, or moving runtime validation, defensive copies, freezing, assertions, and invariant checks.

The goal is not to minimize runtime checks indiscriminately. The goal is to place each guarantee at the correct boundary and avoid charging every valid call for protection against unsupported behavior.

## Default position

Public runtime inputs are validated at runtime. TypeScript declarations improve developer experience but do not replace runtime validation for ordinary public APIs, JavaScript consumers, dynamically produced values, or invariants that TypeScript cannot express.

Relying only on the type system is an exception. It is appropriate only when every condition in the next section is satisfied.

## When TypeScript-only enforcement is acceptable

A runtime defense may be removed or omitted only when all of the following are true:

1. The surface is low-level, internal-facing, or an explicitly advanced integration API rather than an ordinary application API.
2. The declaration contract already forbids the operation precisely, for example through `readonly`, a constrained union, or an unavailable method.
3. Violating the contract requires an explicit escape such as `any`, a type assertion, direct mutation, or untyped JavaScript.
4. The resulting failure is confined to the code that violated the contract.
5. The violation cannot corrupt unrelated callers, future valid executions, shared state, global state, or security-sensitive data.
6. The runtime defense runs on a broad or performance-sensitive path rather than only on exceptional setup or failure paths.
7. Benchmarking or profiling demonstrates a material cost; hypothetical micro-optimization is insufficient.

When these conditions are met:

- keep the TypeScript contract explicit;
- document the operation as unsupported when the boundary is externally visible;
- retain tests for supported persistence, ownership, and execution semantics;
- prefer compile-time tests over runtime tests that exercise deliberate contract violations.

### Established example

`~core.runtimeSteps` is a readonly advanced integration surface. Fluent schema operations create independent pipelines, but consumers that cast away `readonly` and mutate the array are outside the supported contract. Freezing every schema pipeline to defend against that deliberate mutation is not required.

## When runtime enforcement must remain

Preserve runtime validation or defensive isolation when any of the following are true:

- The value comes through an ordinary public API.
- A JavaScript consumer could reasonably provide the invalid value without deliberately bypassing a documented contract.
- TypeScript cannot express the constraint completely, including numeric ranges, non-empty collections, uniqueness, overlap, sparse arrays, ownership, or cross-field relationships.
- Accepting the value would create an invalid schema, malformed execution result, or broken core invariant.
- Delaying the error until execution would materially reduce diagnostic quality.
- A mutation could affect later validations, another consumer, shared configuration, cached execution state, or security and data integrity.
- The check occurs only during schema construction or an exceptional path and no measured cost justifies removing it.
- The value originates outside the TypeScript program, including network, storage, JSON, plugin, reflection, or dynamically generated input.

Examples include validating `union()` branches, rejecting an empty or overlapping `toMappedBoolean()` configuration, and enforcing non-empty failure issue collections.

## Ownership and snapshot rules

Do not treat `Object.freeze()` as the default form of immutability.

First identify who owns each value and whether the same reference is used for execution and diagnostics.

### Private execution state

State used by future validation must not be externally mutable through result payloads or advanced introspection. Prefer one of these designs:

- copy caller-owned configuration into private execution state;
- compile configuration into a private structure such as a `Set` or `Map`;
- expose only a separate diagnostic copy;
- create diagnostic copies lazily on failure when valid-path allocation matters.

### Diagnostic payloads

Issue payloads are data returned to consumers. They do not automatically require runtime freezing.

Freezing or copying a payload is justified when:

- immutability is an explicit public contract;
- the payload shares a reference with private execution state;
- consumer mutation could alter future validation behavior;
- stable snapshots are required for asynchronous or deferred diagnostics.

Otherwise, prefer ordinary snapshots and avoid imposing schema-construction cost solely to prevent a consumer from mutating its own returned issue object.

### Shared execution and payload references

Never remove a freeze mechanically when the frozen value is also used for future execution. Separate the private execution representation from the public payload first, then benchmark the trade-off.

For example, an `isOneOf()` implementation that validates against the same array placed in an issue payload must either retain isolation or split those representations before removing protection.

## Review checklist

Every pull request that adds, removes, or relocates a runtime defense must state:

- the API boundary being protected;
- whether the value is public input, advanced integration state, private execution state, or diagnostic output;
- what TypeScript prevents and how JavaScript or `any` can bypass it;
- the blast radius of an invalid value or mutation;
- whether execution and diagnostic data share references;
- why runtime enforcement is required or why all TypeScript-only conditions are satisfied;
- benchmark or profiling evidence for any performance-based removal;
- tests that preserve supported behavior and omit guarantees for explicitly unsupported behavior;
- documentation or declaration changes required by the decision.

## Decision order

Apply this order during design and review:

1. Define the supported runtime and TypeScript contract.
2. Classify the ownership and API boundary.
3. Identify the failure or mutation blast radius.
4. Preserve runtime enforcement unless every TypeScript-only condition is met.
5. Separate execution state from diagnostic payloads before optimizing defensive copies or freezes.
6. Benchmark the exact candidate against the current implementation.
7. Keep only changes with measured value and explicit trade-offs.
