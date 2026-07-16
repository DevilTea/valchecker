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

- `raw.json`: every sample and environment field; the source of truth
- `summary.md` and `summary.html`: concise category-level interpretation and reliability warnings
- `report.md` and `report.html`: the complete scenario-by-scenario report

The concise Markdown report is written to the Actions job summary. The artifact retains both concise and detailed reports for 90 days. Record the commit, seed, Node.js version, runner image, and CPU model when comparing separate runs.

## Pull request benchmark impact

Pull requests that modify runtime source or benchmark code run the **Benchmark Impact** workflow. It builds the pull request base and candidate on the same runner and measures both with the candidate benchmark harness and standard profile.

The workflow performs three paired independent process runs. Each candidate result is divided by the adjacent base result from the same repetition, and base/candidate order alternates to reduce thermal, scheduler, and runner drift. The reported change is the median of the three paired ratios. Paired RME uses a 95% Student’s t interval, which is intentionally conservative for the small sample; separate base/candidate medians, cross-run variation, and within-process sample RME remain in the JSON evidence.

The impact report classifies a scenario only when its paired-ratio RME is at or below 5%:

- less than 3%: normally noise
- 3–5%: requires corroboration from adjacent scenarios or independent workflow runs
- at least 5%: meaningful scenario-level change
- at least 10% regression: severe scenario regression
- at least 5% geometric-mean regression across two or more stable scenarios in a category: severe category regression

Severe regressions fail the workflow. Mixed improvements and regressions remain a reviewer decision. A performance change is valuable only when the target workload and tradeoff are explicit:

- construction or fresh-schema cost may increase only when warmed gains are larger and the amortization point is documented
- added implementation complexity or package size should normally buy at least 10% in a representative hot path or broad gains across multiple scenarios
- semantic correctness, API stability, coverage, and package integrity remain hard constraints

The workflow uploads all six raw results plus Markdown, HTML, and JSON impact reports.

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
pnpm --dir benchmarks bench --mode standard
```

Generate the full and concise reports from the raw result:

```bash
pnpm --dir benchmarks report \
  --input results/raw.json \
  --markdown results/report.md \
  --html results/report.html

pnpm --dir benchmarks summary \
  --input results/raw.json \
  --markdown results/summary.md \
  --html results/summary.html
```

Compare repeated Valchecker benchmark results by passing each paired run in matching order:

```bash
pnpm --dir benchmarks compare \
  --baseline results/base-1.json \
  --baseline results/base-2.json \
  --baseline results/base-3.json \
  --candidate results/head-1.json \
  --candidate results/head-2.json \
  --candidate results/head-3.json \
  --markdown results/impact.md \
  --json results/impact.json \
  --html results/impact.html
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

In addition to fixed-input ceilings, representative warm scenarios rotate through pools of same-shape objects with different identities and values. These rotating-input cases reduce the risk of keeping an optimization that only benefits one frozen object instance.

Each library runs in a dedicated Node.js process. Library order is shuffled from a recorded seed. Results include every sample, median and mean throughput, median nanoseconds per operation, relative margin of error, package versions, Node.js version, CPU, operating system, runner image, and commit metadata.

## Interpretation

Do not combine construction, cold, and warm results into one ranking. They measure different costs. Compare libraries only within the same scenario and category.

Results with relative margin of error above 5% are marked unstable in generated reports and should be rerun before drawing conclusions. Failure results include each library’s issue construction and traversal behavior.

Zod 4’s generated object fast path can exchange expensive schema creation or first execution for exceptional warmed throughput. Fixed-input warmed scenarios therefore represent a steady-state ceiling, not cold-start latency or whole-application performance.

The benchmark suite intentionally avoids asynchronous validation and intersection comparisons in the primary set: Promise scheduling would dominate the former, while intersection output semantics are not equivalent across libraries.
