# Benchmarking Guide

Every built-in step directory has a colocated `<step>.bench.ts`. A benchmark must preserve the public semantic contract and cover representative success and failure work rather than only the cheapest path.

## Focused Vitest benchmarks

Construct reusable schemas outside the benchmark callback unless construction is the subject:

```ts
import { bench, describe } from 'vitest'
import { createValchecker, isAtLeast, number } from '../..'

const v = createValchecker({ steps: [number, isAtLeast] })
const schema = v.number().isAtLeast(0)

describe('isAtLeast benchmarks', () => {
	bench('success at boundary', () => schema.execute(0))
	bench('success above boundary', () => schema.execute(42))
	bench('failure below boundary', () => schema.execute(-1))
})
```

Run focused or complete Vitest benchmarks with the root script:

```bash
pnpm bench packages/internal/src/steps/isAtLeast
pnpm bench
```

Do not compare a validation policy with a primitive identity, include construction in a warmed execution case, omit issue construction from failure work, or benchmark a schema that no longer compiles against the public API.

## Cross-library suite

The isolated `benchmarks/` package compares the current workspace build with pinned Zod 3, Zod 4, Zod 4 jitless, and Valibot adapters. Its scenarios verify result state, transformed output where applicable, and explicit issue counts before timing.

```bash
pnpm build
pnpm --dir benchmarks install --ignore-workspace --lockfile=false --ignore-scripts
pnpm --dir benchmarks verify
pnpm --dir benchmarks bench --mode standard
pnpm --dir benchmarks report \
	--input results/raw.json \
	--markdown results/report.md \
	--html results/report.html
```

Profiles are `smoke`, `standard`, and `full`. A run can select adapters, scenario ids, or benchmark groups. The generated raw JSON is the source of truth for samples, environment, semantic metadata, and skipped-adapter reasons.

Each measurement takes between `minSamples` and `maxSamples` samples and stops as soon as its 95% confidence interval is within `targetRelativeMarginOfError` of the mean. `smoke` sets no target and always takes its three. The interval uses Student's t, which is what makes the target mean what it says at these sample sizes. `pnpm --dir benchmarks test` checks the rule, and CI runs it in the `Benchmark-Smoke` job.

Two consequences to keep in mind when reading a report. Rows compared inside one scenario can rest on different numbers of samples — the `Samples` column says how many, and `†` marks a measurement that never reached the target — so their standard errors differ by up to √(max/min). And the RME of a measurement that stopped early is the value at the moment it first crossed the target: at most the target by construction, and therefore an understatement of the spread a longer run would have found. In the 2026-07-27 replay, 30 of the 346 cells that would stop early had a full-twelve-sample RME above 0.75%, the worst reporting 0.23% where twelve samples give 1.23%.

The target is 0.75%, chosen by replaying the 440 cells of that run. What the replay bounds is movement in a reported ratio: at most 1.22% in that run's sample order, and 1.34% replaying the same samples in reverse, against the 5% threshold the harness uses for calling a difference meaningful at all. It does not bound rankings, and a criterion that appeared to would be measuring ties rather than precision — 28 of the 345 adjacent ranking pairs in that run sit closer together than 1.22%, and a stricter 0.5% target perturbs one ordering where 0.75% perturbs none. `minSamples` is 5 because 4 puts an 8% shift into a ratio.

Both profiles save: on the CI runners, 59 to 65 of the 80 `standard` cells stop at five samples. Changing any profile field changes what a number means, so `compare` refuses to pair runs whose profiles differ rather than reporting the difference as a performance change.

Switching the runner to Student's t also widened every published RME by about 12%, which moved one cell (`optional-heavy/sparse` on Zod 4 jitless, 4.72% to 5.31%) across the 5% stability line. Because a scenario counts as stable only when every row is, that scenario drops out of the summary's stable set and its group counts fall by one — including one Valchecker win. The measurements did not change; what changed is that their uncertainty is no longer understated.

One run produces two perspectives when it measures a generated-code validator: interpreted libraries only, and every library. The rule lives in `benchmarks/src/perspectives.mjs` and keys on each adapter's `capabilities.generatedCode`. It collapses to a single ranking when no generated-code validator was measured, and also when excluding them would leave fewer than two libraries — that second case still warns that the run mixes execution strategies. Cite the interpreted perspective when comparing execution strategies, and read `Rank`/`Fastest` and `Rank (interpreted)`/`Fastest (interpreted)` as pairs; mixing one perspective's rank with the other's share is the mistake the split exists to prevent.

Keep these groups separate:

1. schema construction;
2. construction plus first validation (`cold`);
3. warmed success;
4. warmed library-default failure;
5. warmed first-issue failure;
6. warmed all-issues failure.

Library-default failure modes may perform different diagnostic work. Compare equivalent first/all policies only where the adapter exposes them.

`benchmarks/README.md` lists the scenario families and every `compatible-subset` rationale; keep that list as the single description and these rules here:

- existing scenario ids, fixtures, schemas, and tiers are stable — earlier runs are the baseline for the open performance issues, so add a new id instead of editing an old scenario;
- stability is per scenario. Group aggregates, including the geometric means behind the performance-impact verdict, are not comparable across a scenario-set change;
- keep `smoke` small because it gates every pull request, and prefer `full` for a secondary or failure variant so the standard-tier gate stays affordable;
- when a library lacks a schema kind entirely, declare a required feature on the scenario and the supported features on the adapter; the runner skips with a stated reason. Never substitute a hand-rolled stand-in — verify first whether the library really lacks it, because a wrong assumption silently penalizes that library;
- when the family exists everywhere but differs in detail, declare `compatible-subset` and pick fixtures every implementation agrees on;
- a new tree-shaking scenario is not covered until `analyze()` gains a check for it and `markdown()` lists its group; otherwise it burns a bundle and asserts nothing.

## Before/after impact

The **Performance Impact** workflow compares a baseline and candidate with interleaved paired independent processes. Pull requests that change runtime or benchmark source run the standard profile with five paired repetitions and fail on the workflow's severe-regression verdict.

Five, because the gate can only pass a scenario it cannot judge. It classifies a scenario only when its paired-ratio interval is at most 5% wide, and three repetitions rarely achieve that: across four historical runs only 27 to 44 of 80 scenarios were classifiable, so more than half of what the gate watched was invisible to it. Five puts 56 to 68 of the same 80 inside the threshold, and costs about ten minutes of the job's runtime. Raising it further keeps helping — 6 reaches 59 to 73 — so the number is a cost decision, not a limit; the counts above come from replaying stored `impact.json` artifacts under the interval each repetition count would produce.

The comparison tool:

- classifies a scenario only when paired-ratio RME is at most 5%;
- treats an absolute change of at least 5% as meaningful;
- treats a stable scenario regression of at least 10% as severe;
- treats a geometric-mean regression of at least 5% across two or more stable scenarios in one group as severe.

Inspect raw runs, paired RME, group trade-offs, and more than one workflow run when the margin is small. Do not rewrite the harness while evaluating a runtime candidate unless the harness change is independently justified.

## Tree-shaking and bundle size

The **Bundle Size Impact** workflow bundles public selective/default Valchecker scenarios and competitor scenarios with one Rollup/Terser configuration. Brotli is the primary automated size metric.

```bash
pnpm build
pnpm --dir benchmarks install --ignore-workspace --lockfile=false --ignore-scripts
pnpm --dir benchmarks treeshake --output ../artifacts/tree-shaking
```

Selective scenarios must import public plugin exports and register exactly the required steps. The report executes generated bundles and verifies required/forbidden issue or method markers. A smaller bundle without elimination of unrelated plugin markers is insufficient evidence.

## Review rules

A performance change is acceptable only when:

- runtime and type semantics remain unchanged or the intentional change is documented;
- correctness, package, API-surface, and coverage gates pass;
- the measured effect exceeds noise for the target workload;
- construction, cold, success, and failure-policy trade-offs are explicit;
- type performance, bundle size, and runtime throughput are evaluated independently;
- added complexity has a documented, measured payoff.
