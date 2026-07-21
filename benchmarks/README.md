# Cross-library benchmarks

This suite compares Valchecker with pinned releases of Zod 3, Zod 4, Zod 4 with JIT disabled, and Valibot.

## Compared versions

- Valchecker: current workspace build
- Zod 3: `3.25.76`
- Zod 4: `4.4.3`
- Zod 4 jitless: `4.4.3` with `z.config({ jitless: true })`
- Zod 4 Mini: `4.4.3` in the tree-shaking report
- Valibot: `1.4.2`

Zod 4 and Zod 4 jitless run in separate Node.js processes because the jitless configuration is global.

## Manual GitHub Actions run

Use the repository’s **Benchmark** workflow to run a controlled comparison on `ubuntu-24.04` and Node.js 24. The workflow accepts:

- `profile`: `smoke`, `standard`, or `full`
- `adapters`: a comma-separated subset of `valchecker,zod3,zod4,zod4-jitless,valibot`
- `seed`: an optional deterministic execution-order seed

A blank seed is replaced with a value derived from the commit and workflow run. The job first verifies every full-tier scenario across every adapter, then runs the requested sample profile. Use `smoke` to validate the workflow and report pipeline; use `standard` or `full` for published comparisons.

Each completed run publishes:

- `raw.json`: every sample, scenario semantic, skipped-adapter reason, and environment field; the source of truth
- `summary.md` and `summary.html`: concise benchmark-group interpretation and reliability warnings
- `report.md` and `report.html`: the complete scenario-by-scenario report

The concise Markdown report is written to the Actions job summary. The artifact retains both concise and detailed reports for 90 days. Record the commit, seed, Node.js version, runner image, and CPU model when comparing separate runs.

## Tree-shaking report

The **Tree Shaking** workflow runs on relevant pull requests and can also be started manually. It bundles equivalent Valchecker, Zod 3, Zod 4 classic, Zod 4 Mini, and Valibot schemas with one Rollup and Terser configuration, then reports minified, gzip, and Brotli sizes.

Valchecker is measured in two modes:

- default `v`, which intentionally registers every built-in method for immediate use
- selective `createValchecker({ steps })`, which retains the same chain API while allowing unused step implementations to be removed

Zod 4 Mini is included as the functional, tree-shakable Zod variant. This keeps the comparison explicit between classic chain DX, functional tree-shaking, and Valchecker’s selective chain design.

The report executes every realistic generated bundle, scans the minimal selective Valchecker bundle for unrelated step markers, and fails when the selective mode no longer shows a material reduction. Artifacts contain concise and detailed Markdown, HTML, JSON evidence, and every generated bundle for inspection.

Run the same report locally after building the workspace and installing the isolated benchmark dependencies:

```bash
pnpm --dir benchmarks treeshake --output ../artifacts/tree-shaking
```

Brotli is the primary automated comparison metric. Cross-library numbers describe bundle cost for the tested schema, not runtime throughput; use the performance suite separately for execution behavior.

## Pull request benchmark impact

Pull requests that modify runtime source or benchmark code run the **Benchmark Impact** workflow. It builds the pull request base and candidate on the same runner and measures both with the candidate benchmark harness and standard profile.

The workflow performs three paired independent process runs. Each candidate result is divided by the adjacent base result from the same repetition, and base/candidate order alternates to reduce thermal, scheduler, and runner drift. The reported change is the median of the three paired ratios. Paired RME uses a 95% Student’s t interval, which is intentionally conservative for the small sample; separate base/candidate medians, cross-run variation, and within-process sample RME remain in the JSON evidence.

The impact report classifies a scenario only when its paired-ratio RME is at or below 5%:

- less than 3%: normally noise
- 3–5%: requires corroboration from adjacent scenarios or independent workflow runs
- at least 5%: meaningful scenario-level change
- at least 10% regression: severe scenario regression
- at least 5% geometric-mean regression across two or more stable scenarios in a benchmark group: severe group regression

Severe regressions fail the workflow. Mixed improvements and regressions remain a reviewer decision. A performance change is valuable only when the target workload and tradeoff are explicit:

- construction or fresh-schema cost may increase only when warmed gains are larger and the amortization point is documented
- warmed success, library-default failure, first-issue failure, and all-issues failure are evaluated as separate groups
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

Every adapter implements the same schema families and fixtures where the libraries expose comparable behavior. Before timing a scenario, the runner verifies the expected success/failure state, transformed output where relevant, and explicit issue-count requirements for diagnostic-policy scenarios. CI executes every full-tier supported scenario once across all adapters and records unsupported adapter/scenario combinations instead of assigning synthetic behavior.

The suite separates:

1. complete schema construction, including all child schemas,
2. complete schema construction plus first validation (cold),
3. warmed successful validation,
4. warmed failure under each library’s default diagnostics,
5. warmed failure that stops after the first issue, and
6. warmed failure that exhaustively collects issues.

Scenarios cover primitive pipelines, flat and nested objects, strict and loose object behavior, arrays, Sets, Maps, ordered unions, compatible synchronous intersections, transformation pipelines, and optional-heavy configuration objects. Full mode adds 1,000-record array cases.

### Diagnostic policy comparability

Failure throughput is meaningful only when the amount of diagnostic work is explicit:

- `library-default` scenarios show the real default behavior of each product, but they are not assumed to collect the same number of issues.
- `first` scenarios require exactly one issue before timing. Valchecker and Valibot participate; Zod is omitted because it does not expose an equivalent whole-parse abort option.
- `all` scenarios require at least two issues before timing. Valchecker uses `collectAllIssues: true`, Valibot uses its exhaustive default, and Zod uses its normal exhaustive structural behavior.
- unsupported adapters are listed in the report with a reason and are not ranked.

Intersection comparisons use only compatible synchronous object outputs and ordinary branch validation. Merge-conflict and asynchronous scheduling behavior remain excluded because those semantics differ across libraries.

In addition to fixed-input ceilings, representative warm scenarios rotate through pools of same-shape objects with different identities and values. These rotating-input cases reduce the risk of keeping an optimization that only benefits one frozen object instance.

Each library runs in a dedicated Node.js process. Library order is shuffled from a recorded seed. Results include every sample, median and mean throughput, median nanoseconds per operation, relative margin of error, package versions, Node.js version, CPU, operating system, runner image, commit metadata, benchmark group, issue policy, comparison scope, and skipped-adapter reasons.

## Interpretation

Do not combine construction, cold execution, warmed success, and the different failure-policy groups into one ranking. Compare libraries only within the same scenario, benchmark group, and issue policy.

Results with relative margin of error above 5% are marked unstable in generated reports and should be rerun before drawing conclusions. `library-default` failure results include each library’s own issue construction and traversal behavior. Use explicit `first` or `all` scenarios when the diagnostic workload must be equivalent.

Zod 4’s generated object fast path can exchange expensive schema creation or first execution for exceptional warmed throughput. Fixed-input warmed scenarios therefore represent a steady-state ceiling, not cold-start latency or whole-application performance.
