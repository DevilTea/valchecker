# Runtime Boundary Policy

Use this policy when adding, retaining, removing, or relocating runtime validation, defensive copies, freezing, assertions, and invariant checks.

## Default position

Ordinary public runtime inputs are validated at runtime. TypeScript declarations improve developer experience but do not replace checks for JavaScript callers, dynamic values, or invariants TypeScript cannot express.

TypeScript-only enforcement is acceptable only when every condition below holds:

1. the surface is low-level, internal-facing, or explicitly advanced;
2. the declaration precisely forbids the operation;
3. violating it requires `any`, an assertion, direct mutation, or untyped JavaScript;
4. the failure is confined to the violating caller;
5. unrelated callers, future valid executions, shared state, security, and data integrity cannot be affected;
6. the defense runs on a broad or performance-sensitive path;
7. profiling or benchmarks demonstrate material cost.

When these conditions hold, keep the TypeScript contract explicit, document externally visible unsupported behavior, and test supported behavior rather than deliberate contract violations.

## Runtime enforcement must remain when

- an ordinary public API receives the value;
- JavaScript can reasonably provide the invalid value without bypassing a documented advanced contract;
- TypeScript cannot express the invariant, including ranges, non-empty collections, uniqueness, sparse arrays, ownership, or cross-field relationships;
- acceptance would create invalid schema state, malformed results, or a broken core invariant;
- delayed failure materially harms diagnostics;
- mutation can affect later validation, another consumer, shared configuration, or data integrity;
- the check is construction-only or exceptional and has no measured hot-path cost;
- the value originates from network, storage, JSON, plugins, reflection, or generated input.

Examples include validating non-empty failure issue collections, structural options, mapping overlap, and public schema configuration that would otherwise create an invalid runtime pipeline.

## Advanced integration boundaries

`~core.runtimeSteps` is readonly advanced state. Fluent operations create independent pipelines; a caller that casts away readonly and mutates the array is outside the supported contract. Freezing every pipeline solely to defend that deliberate mutation is not required.

Schema instances use a shared prototype. Registered methods are non-enumerable prototype properties; fixed schema properties are own enumerable properties. Method enumeration and own-property identity are therefore not public plugin-discovery mechanisms. Do not describe the current implementation as a `Proxy`.

`constructor`, `toString`, and `valueOf` are not reserved plugin names. An advanced plugin may deliberately shadow those inherited object members. Core schema names and `then` remain reserved, and duplicate or symbol step names are rejected.

Structural branch configuration uses the schema execution protocol rather than nominal class identity. Construction must still validate every invariant explicitly documented by the public method, such as non-empty arrays, sparse arrays, discriminator configuration, and required callable schema execution.

## Ownership and snapshots

Do not use `Object.freeze()` as an automatic synonym for immutability. First classify each value:

- caller-owned configuration;
- private execution state;
- construction metadata;
- public diagnostic payload;
- shared state crossing executions.

Private state used by future validation must not remain externally mutable through issue payloads or introspection. Prefer copying caller configuration, compiling to a private `Set`/`Map`, exposing a separate diagnostic snapshot, or creating diagnostic copies only on failure.

Issue payloads are consumer data and do not automatically require freezing. Copy or freeze when immutability is a documented contract, the payload shares private state, consumer mutation could alter future validation, or async/deferred diagnostics require a stable snapshot.

Never remove a freeze mechanically when one reference serves both execution and diagnostics. Separate the representations first, then benchmark.

## Construction metadata

`~core.metadata` is readonly-typed but not frozen. A step that stores mutable metadata with `utils.setMetadata()` owns any required snapshot or freeze. Metadata is final-step construction data and is dropped by the next fluent call unless redeclared.

## Review requirements

A PR that changes a runtime defense must document:

- the API boundary and ownership class;
- what TypeScript prevents and how JavaScript can bypass it;
- failure or mutation blast radius;
- shared execution/diagnostic references;
- why runtime enforcement remains or why every TypeScript-only condition is satisfied;
- measured performance evidence for removal;
- supported-behavior tests retained;
- declaration and documentation changes.

Apply this order: define the contract, classify ownership, identify blast radius, preserve runtime enforcement by default, separate shared representations, benchmark the exact candidate, and keep only changes with measured value and explicit trade-offs.
