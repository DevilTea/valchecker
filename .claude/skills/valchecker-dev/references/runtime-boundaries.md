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

A protocol that can cross a public composition boundary is runtime-owned interoperability state, not unsupported `~core` tampering. Compatible physical package copies must share a stable, namespaced, versioned identity (`valchecker.protocol.<name>.vN`) for issue-draft metadata, plugin markers/capabilities, and construction metadata they consume across copies. Keep truly local sentinels module-local. Verification must include a real two-physical-copy topology; do not treat two URLs that resolve one internal module as cross-copy evidence.

## Ownership, snapshots, and runtime freezing

Snapshot/copy and runtime freezing solve different problems. Do not use `Object.freeze()` as an automatic synonym for immutability. First classify each value:

- caller-owned configuration;
- private execution state;
- construction metadata;
- public diagnostic payload;
- shared state crossing executions.

If a fully type-correct caller can retain a mutable construction alias and later mutate it so an already-created schema changes behavior, snapshot/compile/capture the relevant state at construction. The supported guarantee is alias isolation; the snapshot does not also need runtime freezing unless runtime immutability itself is a documented contract.

Readonly low-level/internal/protocol surfaces rely on the TypeScript contract by default. Do not add per-schema or recursive freezes solely so behavior survives JavaScript, `any`, casts, or other deliberate mutation of readonly `~core`, metadata, protocol descriptors, or similar implementation state. This is the same boundary used by `~core.runtimeSteps`.

Private state used by future validation must not remain mutable through a supported public alias. Prefer copying caller configuration, compiling to a private `Set`/`Map`, exposing a separate diagnostic snapshot, or creating diagnostic copies only on failure.

Issue payloads are consumer data and do not automatically require freezing. Freeze only when runtime immutability is itself a public contract, a supported typed path can otherwise mutate shared state, or an intentionally shared implementation singleton has a concrete defensive reason. A snapshot that merely reports construction state normally needs ownership isolation, not `Object.freeze()`.

When an API promises a defensive issue snapshot, isolate the Valchecker-owned structural layer rather than generically deep-cloning the payload graph. The issue record, `path`, `context`, and plain payload record are snapshot-owned. Nested diagnostic containers are copied only when their owning protocol declares them as Valchecker-owned; opaque/user-owned values such as input objects, arrays, `Error`, `Date`, collections, callbacks, proxies, and schema references retain identity. Ownership metadata that must survive composition across physical package copies uses a versioned `Symbol.for(...)` protocol and stays non-enumerable so it does not change the public payload shape.

Never remove a freeze mechanically when one reference serves both execution and diagnostics. Separate the representations first, then benchmark.

## Construction metadata

`~core.metadata` is readonly-typed and intentionally not runtime-frozen. A step that stores mutable metadata with `utils.setMetadata()` owns any required snapshot/alias isolation for values that remain mutable through supported references. Direct mutation of readonly metadata or protocol descriptors is unsupported internal/protocol tampering and is not runtime-hardened. Metadata is final-step construction data and is dropped by the next fluent call unless redeclared.

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

Work in this order:

1. define the contract;
2. classify ownership;
3. identify the blast radius;
4. preserve runtime enforcement by default;
5. separate shared representations;
6. benchmark the exact candidate;
7. keep only changes with measured value and explicit trade-offs.
