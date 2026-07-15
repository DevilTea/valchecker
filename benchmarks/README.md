# Cross-library benchmarks

This suite compares Valchecker with pinned releases of Zod 3, Zod 4, Zod 4 with JIT disabled, and Valibot.

## Compared versions

- Valchecker: current workspace build
- Zod 3: `3.25.76`
- Zod 4: `4.4.3`
- Zod 4 jitless: `4.4.3` with `z.config({ jitless: true })`
- Valibot: `1.4.2`

Zod 4 and Zod 4 jitless run in separate Node.js processes because the jitless configuration is global.

## Running

Build Valchecker first, then install the isolated benchmark dependencies and run a profile:

```bash
pnpm build
pnpm --dir benchmarks install --ignore-workspace --lockfile=false
pnpm --dir benchmarks bench -- --mode standard
```

Profiles:

- `smoke`: correctness plus a fast execution check
- `standard`: normal comparison run
- `full`: longer samples and large-array scenarios

Raw output defaults to `benchmarks/results/raw.json`. Use `--output <path>`, `--seed <value>`, or `--adapters valchecker,zod4` to customize a run.

## Methodology

Every adapter implements the same schema families and fixtures. Before timing a scenario, the runner verifies that each adapter produces the expected success/failure state and, where outputs matter, the expected transformed output.

The suite separates:

1. schema construction,
2. schema construction plus first validation (cold), and
3. validation using an already-created and warmed schema.

Scenarios cover primitive pipelines, flat and nested objects, strict unknown-key rejection, arrays, ordered unions, transformation pipelines, and optional-heavy configuration objects. Full mode adds 1,000-record array cases.

Each library runs in a dedicated Node.js process. Library order is shuffled from a recorded seed. Results include every sample, median and mean throughput, median nanoseconds per operation, relative margin of error, package versions, Node.js version, CPU, operating system, and commit metadata.

## Interpretation

Do not combine construction, cold, and warm results into one ranking. They measure different costs. Failure results are also reported separately because libraries differ substantially in issue construction and branch traversal.

The benchmark suite intentionally avoids asynchronous validation and intersection comparisons in the primary set: Promise scheduling would dominate the former, while intersection output semantics are not equivalent across libraries.
