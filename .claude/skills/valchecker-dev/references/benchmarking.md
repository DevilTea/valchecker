# Benchmarking Guide

Every built-in step directory has a colocated `<step>.bench.ts`, and it is the unit the **Performance Impact** gate selects and measures. It declares its cells as data:

```ts
import { createValchecker, isAtLeast, number } from '../..'
import { stepBench } from '../../test-utils/step-bench'

const v = createValchecker({ steps: [number, isAtLeast] })
const schema = v.number()
	.isAtLeast(0)

stepBench('isAtLeast', [
	{ name: 'valid', group: 'warm/success', expect: { success: true }, batch: 100, run: () => schema.execute(42) },
	{ name: 'below', group: 'warm/failure/library-default', expect: { success: false, issues: ['isAtLeast:expected_at_least'] }, batch: 100, run: () => schema.execute(-1) },
])
```

**One declaration, two drivers.** `pnpm bench` is `vitest bench` over the TypeScript source; the gate compares two builds of `packages/valchecker/dist/index.mjs`, one process per cell, and a vitest `bench()` over source measures neither of them and produces no paired ratio. `stepBench()` registers the cells with vitest for the local loop and with a registry the gate reads, and the gate imports the same file in a plain Node process under two resolution hooks — `vitest` resolves to a shim, and the `'../..'` every bench file already has resolves to the dist under test. So a cell cannot exist for one driver and not the other. Those hooks are Node's own ESM resolution, which is why a caller running under another loader (a vitest worker, for instance) must spawn `benchmarks/src/cells/catalog.mjs` rather than import `collect.mjs`.

A cell carries what `bench(name, fn)` cannot: the `group` it aggregates into, the `expect` that is verified by executing it outside every timed region, and the `batch` that makes the unit worth timing.

**The required set, and its ceiling.** Per step: one success cell on a representative input; one failure cell producing one of *this step's own* issue codes; construction hoisted above the cells; a batch sized so one unit is roughly 1–10 µs. Where the feature exists: one cell per *distinct algorithm* behind an option (not per option value), a non-empty shape or element set plus one `collectAllIssues` cell for a structure, and one async cell for a step with an async path. Deliberately **not** required, and rejected in review: every issue code, every boundary, every size variant, every option value. Those belong in `<name>.test.ts`. Two to four cells per step is the norm.

Batching is not optional. `measure.mjs` reads `process.hrtime.bigint()` every 16 iterations and that read costs about 15 ns, so an unbatched cell measures the harness: on `native-typeof` the real work was 12% of the number and on `kind-unknown/valid` 20%, which turns a real 25% regression into about 5% — at the threshold. Batching does not make a cell more stable (the noise is between processes, and a sample already fills a fixed 300 ms); it removes the dilution, and it is free for the same reason.

`pnpm bench:cells` enforces the part of this a script can decide, by running the cells. It cannot decide whether a cell measures work worth measuring — a success cell on a degenerate input, a structure over an empty shape, and a transform whose enclosing collection dominates the unit all pass it — which is what review is for, and why the cell set is kept small enough to read.

```bash
pnpm bench packages/internal/src/steps/isAtLeast
pnpm bench
pnpm bench:cells
```

Do not compare a validation policy with a primitive identity, include construction in a warmed cell, omit issue construction from failure work, or leave a JavaScript baseline in the gate set — a baseline measures neither build under comparison, so `group: 'baseline'` excludes it.

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

The **Performance Impact** gate shards four ways and merges before the verdict, so the group aggregate is computed once over the complete cell set. It used to say it was deliberately unsharded; both objections were checked and neither held. The severe-group trigger does become a cross-runner aggregate, and nothing breaks — every input to it is already a dimensionless machine-cancelled paired ratio and the aggregate is a bare geometric mean with no confidence interval, so there is no statistic a between-machine term can enter; the real effect is that a noisier runner leaves fewer of its own cells decisive, which the gate already reports as `groupsWithoutTrigger`. And the fixed cost was measured rather than estimated: 55m12s of measurement against about 40s of checkout, setup, both builds, and scoping, so wall time is `40s + measurement/N` and four shards is about 28.5 minutes. `compare.mjs` still refuses to pair runs whose isolation or shard count differs, so sharding one side only fails loudly.

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
- a scenario's `steps` declaration is checked against what its `build()` really calls. `benchmarks/src/step-audit.mjs`, run by `pnpm --dir benchmarks verify`, drives every build key through a recording instance and fails on a declared set that is missing an observed call — the direction that silently removes a scenario from the impact selection. A declaration may exceed what is observed, because a step can be reached without its method being called: `templateLiteral` declares `literal` because `v.union(['px', 'em', 'rem'])` resolves its string branches through a runtime registry lookup;
- an output assertion is worth only as much as `canonicalizeOutput`. It needs a branch for every value `JSON.stringify` cannot separate, and it refuses an object with no own enumerable properties instead of comparing it as `{}`; the `File` and `Blob` branches exist because without them a `text/plain` File passed as the expected output of an `image/png` check;
- when the family exists everywhere but differs in detail, declare `compatible-subset` and pick fixtures every implementation agrees on;
- a new tree-shaking scenario is not covered until `analyze()` gains a check for it and `markdown()` lists its group; otherwise it burns a bundle and asserts nothing;
- do not add a field to `raw.json` that changes what a number means without extending the identity in `benchmarks/src/comparability.mjs`; a number must never be readable as comparable to one produced differently.

## Before/after impact

The **Performance Impact** workflow compares a baseline and candidate with interleaved paired independent processes. Pull requests run the standard profile with five paired repetitions and fail on the workflow's severe-regression verdict. Every merge to `main` that can change either build runs the same comparison unscoped, so what a scoped run missed surfaces within a day against the merge that caused it.

Both triggers are written as `**` minus the paths `scripts/impact-selection.ts` proves cannot reach either bundle, rather than as a list of source directories. A rule the workflow never starts for cannot fire, and listing directories left the selector's most conservative rules — a lockfile, a package manifest, a `tsdown.config.ts`, a `tsconfig.json`, an unrecognised path, and the gate's own five files — unreachable on both events. `scripts/check-impact-triggers.ts` classifies every tracked path plus the change classes no file currently represents, and fails when one the selector forces a full run for does not match both filters; it also fails when a documentation-only path does match, so the filter cannot be repaired by widening it to everything.

Five, because the gate can only pass a scenario it cannot judge. It classifies a scenario only when its paired-ratio interval is at most 5% wide, and three repetitions rarely achieve that: across four historical runs only 27 to 44 of 80 scenarios were classifiable, so more than half of what the gate watched was invisible to it. Five puts 56 to 68 of the same 80 inside the threshold, and costs about ten minutes of the job's runtime. Raising it further keeps helping — 6 reaches 59 to 73 — so the number is a cost decision, not a limit; the counts above come from replaying stored `impact.json` artifacts under the interval each repetition count would produce.

A pull-request run is **scoped to its diff**: `scripts/impact-selection.ts` maps each changed file through the internal import graph to the steps that transitively import it, and then to the scenarios whose declared `steps` name them. Attribution follows imports rather than directories, because three grammar files are shared across step directories and a directory rule would drop the second step of each pair. Under-selection is the failure mode, so the default for anything the mapping cannot place is a full run; the exclusions are enumerated in `benchmarks/README.md` and each one is justified by why it cannot reach either bundle. A canary set — every `construction` and `cold` scenario plus eleven core-path scenarios, 30 in all, about ten minutes — runs regardless of the diff, because module initialisation and prototype shape are not attributable through `steps` at all, and because it keeps every benchmark group at two scenarios so the severe-group trigger is always possible. Selection tops a thin group back up to two, and `impact.md` names any group that still ended with fewer than two *stable* scenarios rather than presenting it as cleared. Reproduce a selection with `pnpm bench:impact-scope --base <ref> --head <ref>`.

Every one of those rules is keyed on what a changed file **means**. `scripts/inert-change.ts` compares the two revisions of each changed path — a parsed YAML document deep-compared, or a TypeScript file reprinted from the compiler's AST with the comments no tool reads blanked first — and a path whose revisions come out equal is ignored, so a comment-only edit to a gate-defining file no longer forces a complete comparison and a JSDoc fix to a step no longer selects its scenarios. Bundler annotations are excluded from that, because `@__NO_SIDE_EFFECTS__` and `@__PURE__` change which code the bundle holds; a `@ts-expect-error`, an `eslint-disable`, or a `v8 ignore` is not, because none of them changes the emitted JavaScript and each is enforced by a gate that fails loudly by itself. A path with no canonical form, and a file the diff added or deleted, are never inert.

Scoping changes what a group aggregate is over, so every group row in `impact.md` and `impact.json` carries `measured/total` beside its geometric mean, and a partly covered run says outright that the mean cannot contain a regression in a scenario that did not run. There is deliberately **no coverage floor below which the trigger is reported as unavailable**: the scenarios a scoped run leaves out are the ones the diff cannot move, dropping unaffected scenarios makes the mean more sensitive rather than less, and declaring a trigger unavailable catches nothing. What is genuinely unavailable is a trigger with fewer than two stable scenarios, and that is reported by name. `benchmarks/src/comparability.mjs` includes the selection in the measurement identity, so a scoped run and an unscoped one are refused as a pair rather than compared.

Scoping does not make an individual scenario harder to judge, which is the property the repetition count was raised for. Replaying the 169-scenario, five-repetition run 30296929034 under each of ten historical merges' selections, 76% to 88% of the selected scenarios were classifiable against 78% for the whole suite, and the small perf-focused diffs the gate exists for came out best at 82% to 88%. The *count* necessarily falls — 28 to 41 classifiable in a 32-to-48-scenario selection against 131 of 169 — because scoping changes the denominator by design, so the criterion to hold it to is the per-scenario one. The replay assumes what #127 established, that cell isolation makes a scenario's number independent of what else ran.

The comparison tool:

- classifies a scenario only when paired-ratio RME is at most 5%;
- treats an absolute change of at least 5% as meaningful;
- treats a stable scenario regression of at least 10% as severe;
- treats a geometric-mean regression of at least 5% across two or more stable scenarios in one group as severe, and reports the groups that had fewer than two;
- states how many scenarios of each group ran, so a group aggregate is never read as coverage of the group.

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
