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

Profiles are `smoke`, `standard`, and `full`. A run can select adapters, scenario ids, or benchmark groups. The generated raw JSON is the source of truth for samples, environment, semantic metadata, skipped-adapter reasons, isolation, and sharding.

### Isolation and sharding

Every (adapter, scenario) cell is measured in its own process (`"isolation": "cell"`), one cell at a time, with the adapters of one scenario measured back to back. That is the fix for the intra-process position artefact four findings during the scenario expansion had to work around: under the previous one-process-per-adapter runner an identical array pipeline measured 83.5 ns as the first array-carried scenario and 261.9 ns after three others, and `schema-kind/unknown-valid` measured 6.4 ns alone and 14.8 ns behind two other scenarios.

Measuring the whole standard tier both ways on one machine sized it: 684 of 773 cells more than 5% faster in isolation, a median 19.0% move in the adapter-versus-Valchecker ratios, and 153 of the 1,232 adapter pairs the report presented as *separated* reversed — 12.4% against the 2.3% rate the 5% threshold was calibrated to. Those pairs are not independent — they are the separated pairs of about 167 scenarios, and every pair inside one scenario rests on the same five cell measurements — so read the sample as about 167, at which 12.4% against 2.3% is still roughly nine standard errors. Counts of changed scenario orderings are deliberately not quoted, because they have no null baseline — the `zod4`/`zod4-jitless` pair alone flips in 31.6% of comparisons between two same-isolation runs. It was adapter-dependent — Zod 4 −38.5% against Valibot −13.5% — so it biased the within-scenario comparison rather than only adding noise, which is why it could not be documented instead of fixed; what replaced it is position independence rather than realism, so a number from either runner is a number about a different thing rather than a better or worse estimate of one thing. It cost 110 s on that pair of runs (143 ms per cell, 7.6% of that profile's budget; roughly 3% on a full-tier `full` run). `--isolation adapter` reproduces the old behaviour for reading an archived number, and nothing else. Absolute numbers from before 2026-07-28 are not comparable with numbers after it.

The **Performance Comparison** workflow shards by scenario, never by adapter: every adapter of one scenario must be measured on one machine because that is the only comparison the report makes, and runners vary between jobs. Assignment is positional round-robin (`p % count`), deterministic from the selection and count alone, so rerunning one shard measures the same scenarios; it is also exactly invertible, which is how `merge` rebuilds the run order without the registry. `merge` refuses a differing mode, seed, profile, isolation, filter, adapter order, adapter version, commit, or Node.js version; shard sizes no `p % count` assignment could produce, or a shard whose recorded scenario list is not its own catalog, because `interleaveShards` would otherwise reorder them into a catalog the report presents as the run order; overlapping or duplicated shards; an already-merged input; and a missing shard. Only the machine may differ. Each adapter reports the version of the build it loaded rather than a source literal — read from the nearest `package.json` above the resolved entry — so the version guards compare something that can actually differ, and a published report's versions are traceable. For the Valchecker adapter that is `packages/valchecker`'s version, which does not identify a build within one version; `environment.commit` is what catches a mixed-build merge.

The **Performance Impact** gate is deliberately unsharded — see `benchmarks/README.md` for the argument. `compare.mjs` refuses to pair runs whose isolation or shard count differs, the same guard that already refuses a differing mode or profile; it lives in `benchmarks/src/comparability.mjs` so it can be tested against results differing in exactly one field.

Each measurement takes between `minSamples` and `maxSamples` samples and stops as soon as its 95% confidence interval is within `targetRelativeMarginOfError` of the mean. `smoke` sets no target and always takes its three. The interval uses Student's t, which is what makes the target mean what it says at these sample sizes. `pnpm --dir benchmarks test` checks the rule, and CI runs it in the `Benchmark-Smoke` job.

Two consequences to keep in mind when reading a report. Rows compared inside one scenario can rest on different numbers of samples — the `Samples` column says how many, and `†` marks a measurement that never reached the target — so their standard errors differ by up to √(max/min). And the RME of a measurement that stopped early is the value at the moment it first crossed the target: at most the target by construction, and therefore an understatement of the spread a longer run would have found. In the 2026-07-27 replay, 30 of the 346 cells that would stop early had a full-twelve-sample RME above 0.75%, the worst reporting 0.23% where twelve samples give 1.23%.

The target is 0.75%, chosen by replaying the 440 cells of that run. What the replay bounds is movement in a reported ratio: at most 1.22% in that run's sample order, and 1.34% replaying the same samples in reverse, against the 5% threshold the harness uses for calling a difference meaningful at all. It does not bound rankings, and a criterion that appeared to would be measuring ties rather than precision — 28 of the 345 adjacent ranking pairs in that run sit closer together than 1.22%, and a stricter 0.5% target perturbs one ordering where 0.75% perturbs none. `minSamples` is 5 because 4 puts an 8% shift into a ratio.

Both profiles save: on the CI runners, 59 to 65 of the 80 `standard` cells stop at five samples. Changing any profile field changes what a number means, so `compare` refuses to pair runs whose profile, isolation, or shard count differs rather than reporting the difference as a performance change.

Switching the runner to Student's t also widened every published RME by about 12%, which moved one cell (`optional-heavy/sparse` on Zod 4 jitless, 4.72% to 5.31%) across the 5% stability line. Because a scenario counts as stable only when every row is, that scenario drops out of the summary's stable set and its group counts fall by one — including one Valchecker win. The measurements did not change; what changed is that their uncertainty is no longer understated.

The report refuses to present an ordering it cannot reproduce. Rows within 5% of the one above them are marked `≈`, and the summary counts Valchecker's wins twice — once plainly, once as **clear wins** where the lead over the runner-up exceeds 5%. Quote the clear count when the claim is that Valchecker is faster.

5% is calibrated, not chosen: across four `full` runs from 2026-07-26 and 2026-07-27, 74 of the 840 adapter pairs present in all four changed their ordering at least once, and 55 of those 74 were closer than 5% in the run being reported, against 18 of the 766 settled pairs wrongly marked. Confidence-interval overlap was tried first and predicted worse — a single run's interval describes spread within that run, not whether a ranking would recur. The number also matches the `meaningfulThreshold` that `compare.mjs` already applies to before/after changes.

The limit belongs next to the marker: 19 unreproducible orderings have gaps above 5%, mostly on cells whose own measurements are unstable, so an unmarked row is only *not obviously* unreproducible. Ranking churn is real and mostly one pair — `zod4` against `zod4-jitless` flipped in 163 of 516 comparisons at a median gap of 2.74%, while every other pair flipped 3 to 28 times.

One run produces two perspectives when it measures a generated-code validator: interpreted libraries only, and every library. The rule lives in `benchmarks/src/perspectives.mjs` and keys on each adapter's `capabilities.generatedCode`. It collapses to a single ranking when no generated-code validator was measured, and also when excluding them would leave fewer than two libraries — that second case still warns that the run mixes execution strategies. Cite the interpreted perspective when comparing execution strategies, and read `Rank`/`Fastest` and `Rank (interpreted)`/`Fastest (interpreted)` as pairs; mixing one perspective's rank with the other's share is the mistake the split exists to prevent.

A scenario also declares how it is measured and through which entry point, and both reach `raw.json`. `executionMode` is `sync` or `async`: an async cell is measured by awaiting the operation inside the timed loop, one at a time, because the microtask turn is part of what an asynchronous caller pays. It is declared rather than detected — a maybe-async pipeline returns a promise for some inputs and not others — and the harness rejects a mismatch in either direction, including handing `measure` a promise or `measureAsync` a plain value. Async cells take their own benchmark groups (`warm/async/success`, …) so no aggregate mixes them with synchronous work. `entry` is `native` or `standard`, the latter calling `schema['~standard'].validate(input)` over a build key a native scenario already measures; keep `adapter.parse` referenced rather than wrapped in `scenarios/define.mjs`, so adding an entry point never costs an existing cell a call frame.

Keep these groups separate:

1. schema construction;
2. construction plus first validation (`cold`);
3. warmed success;
4. warmed library-default failure;
5. warmed first-issue failure;
6. warmed all-issues failure;
7. the same warmed groups measured asynchronously.

Library-default failure modes may perform different diagnostic work. Compare equivalent first/all policies only where the adapter exposes them.

`benchmarks/README.md` lists the scenario families and every `compatible-subset` rationale; keep that list as the single description and these rules here:

- existing scenario ids, fixtures, schemas, and tiers are stable — earlier runs are the baseline for the open performance issues, so add a new id instead of editing an old scenario;
- stability is per scenario. Group aggregates, including the geometric means behind the performance-impact verdict, are not comparable across a scenario-set change;
- keep `smoke` small because it gates every pull request, and prefer `full` for a secondary or failure variant so the standard-tier gate stays affordable;
- when a library lacks a schema kind entirely, declare a required feature on the scenario and add the adapter to that feature in `benchmarks/src/capabilities.mjs`; the runner skips with a stated reason, and the Zod adapters fail to load if the installed build disagrees with the declaration. Never substitute a hand-rolled stand-in — verify first whether the library really lacks it, because a wrong assumption silently penalizes that library, and the two allowlist entries removed since this suite began were both wrong assumptions;
- a step is covered only when some scenario naming it has a *competitor* participating. `pnpm bench:coverage` enforces that, so a family every competitor is gated out of — `schema-kind/json-*` — puts its step in the allowlist rather than in the covered count;
- an output assertion is worth only as much as `canonicalizeOutput`. It needs a branch for every value `JSON.stringify` cannot separate, and it refuses an object with no own enumerable properties instead of comparing it as `{}`; the `File` and `Blob` branches exist because without them a `text/plain` File passed as the expected output of an `image/png` check;
- when the family exists everywhere but differs in detail, declare `compatible-subset` and pick fixtures every implementation agrees on;
- a new tree-shaking scenario is not covered until `analyze()` gains a check for it and `markdown()` lists its group; otherwise it burns a bundle and asserts nothing;
- do not add a field to `raw.json` that changes what a number means without extending the identity in `benchmarks/src/comparability.mjs`; a number must never be readable as comparable to one produced differently.

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
