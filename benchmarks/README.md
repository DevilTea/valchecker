# Cross-library benchmarks

This suite compares Valchecker with pinned releases of Zod 3, Zod 4, Zod 4 with JIT disabled, and Valibot.

## Compared versions

- Valchecker: current workspace build
- Zod 3: `3.25.76`
- Zod 4: `4.4.3`
- Zod 4 jitless: `4.4.3` with `z.config({ jitless: true })`
- Valibot: `1.4.2`

Zod 4 and Zod 4 jitless run in separate Node.js processes because the jitless configuration is global.

## Manual GitHub Actions run

Use the repository’s **Benchmark** workflow to run a controlled comparison on `ubuntu-24.04` and Node.js 24. The workflow accepts:

- `profile`: `smoke`, `standard`, or `full`
- `adapters`: a comma-separated subset of `valchecker,zod3,zod4,zod4-jitless,valibot`
- `seed`: an optional deterministic execution-order seed

A blank seed is replaced with a value derived from the commit and workflow run. The job first verifies every full-tier scenario across every adapter, then runs the requested sample profile. Use `smoke` to validate the workflow and report pipeline; use `standard` or `full` for published comparisons.

Each completed run publishes:

- `raw.json`: all samples and environment metadata; the source of truth
- `report.md`: a scenario-by-scenario report also written to the Actions job summary
- `report.html`: a standalone human-readable report

The artifact is retained for 90 days. Record the commit, seed, Node.js version, runner image, and CPU model when comparing separate runs.

## Local run

Build Valchecker first, then install the isolated benchmark dependencies without lifecycle scripts:

```bash
pnpm build
pnpm --dir benchmarks install --ignore-workspace --lockfile=false --ignore-scripts
```

Verify every adapter and full-tier scenario without timing:

```bash
pnpm --dir benchmarks verify
```

Run a benchmark profile:

```bash
pnpm --dir benchmarks bench -- --mode standard
```

Generate reports from the raw result:

```bash
pnpm --dir benchmarks report -- \
  --input results/raw.json \
  --markdown results/report.md \
  --html results/report.html
```

Profiles:

- `smoke`: correctness plus a fast execution check
- `standard`: normal comparison run
- `full`: longer samples and large-array scenarios

Raw output defaults to `benchmarks/results/raw.json`. Use `--output <path>`, `--seed <value>`, or `--adapters valchecker,zod4` to customize a run.

## Methodology

Every adapter implements the same schema families and fixtures. Before timing a scenario, the runner verifies that each adapter produces the expected success/failure state and, where outputs matter, the expected transformed output. CI also executes every full-tier scenario once across all adapters.

The suite separates:

1. complete schema construction, including all child schemas,
2. complete schema construction plus first validation (cold), and
3. validation using an already-created and warmed schema.

Scenarios cover primitive pipelines, flat and nested objects, strict unknown-key rejection, arrays, ordered unions, transformation pipelines, and optional-heavy configuration objects. Full mode adds 1,000-record array cases.

Each library runs in a dedicated Node.js process. Library order is shuffled from a recorded seed. Results include every sample, median and mean throughput, median nanoseconds per operation, relative margin of error, package versions, Node.js version, CPU, operating system, runner image, and commit metadata.

## Interpretation

Do not combine construction, cold, and warm results into one ranking. They measure different costs. Compare libraries only within the same scenario and category.

Results with relative margin of error above 5% are marked unstable in generated reports and should be rerun before drawing conclusions. Failure results include each library’s issue construction and traversal behavior.

The benchmark suite intentionally avoids asynchronous validation and intersection comparisons in the primary set: Promise scheduling would dominate the former, while intersection output semantics are not equivalent across libraries.
