# Type performance

Valchecker uses state-aware fluent types, distributed issue unions, registration-aware methods, and transformed input/output inference. Runtime benchmarks do not detect regressions in TypeScript compiler complexity, so this suite measures a fixed synthetic workload separately.

The generated fixture covers:

- an 80-field required object with validation and transformation steps,
- 40 optional object fields,
- a 40-branch literal union,
- a 30-branch directly dispatched variant,
- a 12-level nested object,
- a long string transformation and validation chain,
- forced input, output, and issue inference.

`pnpm typeperf` runs the pinned workspace TypeScript compiler with `--extendedDiagnostics` and writes its report to `artifacts/type-performance`.

## Gating policy

The committed budget gates deterministic structural metrics:

- `Types`
- `Instantiations`
- compiler memory usage

`Check time` and `Total time` remain report-only because wall-clock timings on shared runners are noisy. A TypeScript version change requires a reviewed baseline refresh rather than silently comparing unrelated compiler implementations.

The initial Draft CI run intentionally operates without a budget and prints a baseline candidate. Before the pull request becomes Ready, that candidate is reviewed, rounded upward to allow ordinary minor variation, and committed as `budget.json`.
