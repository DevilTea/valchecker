# Performance

## Reuse schemas

Construct schemas once outside hot loops. Fluent calls create new immutable schemas; execution reuses the compiled pipeline.

## Order work deliberately

Place cheap deterministic validation before expensive callbacks when the ordering does not change semantics. An earlier synchronous failure can avoid later callback and promise work.

Use named constraints and concrete transformations when they express the contract; they are easier to audit and benchmark than repeated compound callbacks.

Filter before sorting when discarded elements do not need ordering. Do not repeat equivalent normalization steps.

## Async work

Parallelize independent external calls inside one callback only when the external system and application semantics permit it. Valchecker structural child traversal has its own documented ordering; do not assume object fields run concurrently.

A maybe-async schema may fail synchronously before async work is reached. `.toAsync()` provides a stable native-promise boundary but allocates a promise on every invocation.

## Bundle size

The default `v` registers all built-ins. Selective `createValchecker({ steps })` instances make inclusion explicit and are preferred for bundle-sensitive applications. Verify generated bundles and marker elimination with the repository tree-shaking workflow rather than inferring from source layout.

## Measurement

Separate schema construction, first/cold execution, warmed success, and warmed failure policy. Compare equivalent semantics, inspect uncertainty, run more than once, and evaluate type performance and bundle size independently from runtime throughput.

Never trade correctness, API stability, issue contracts, or maintainability for an isolated microbenchmark result.
