# Cross-library benchmarks

This suite compares Valchecker with pinned releases of Zod 3, Zod 4, Zod 4 with JIT disabled, and Valibot.

## Compared versions

- Valchecker: current workspace build
- Zod 3: `3.25.76`
- Zod 4: `4.4.3`
- Zod 4 jitless: `4.4.3` with `z.config({ jitless: true })`
- Zod 4 Mini: `4.4.3` in the tree-shaking report
- Valibot: `1.4.2`

The pins live in `package.json`; each adapter reads the version of the package it actually loaded rather than repeating it as a literal, so `raw.json`, `verify`, and every report state the version that was measured. `verify` prints it per adapter, which is the cheapest way to confirm an install matches the pins above.

Zod 4 and Zod 4 jitless run in separate Node.js processes because the jitless configuration is global.

## Measurement isolation

**Every (adapter, scenario) cell is measured in its own Node.js process.** A cell's number therefore does not depend on which scenarios ran before it, and `raw.json` records `"isolation": "cell"` so it cannot be read as comparable to a number produced any other way.

This replaced one process per adapter running every scenario, under which a cell's number depended on its position in that process — by far more than the 5% the report needs to call an ordering reproducible. Four separate findings during the 2026-07 scenario expansion had to work around it:

- an identical Zod 3 schema moved 13% purely by scenario position;
- `schema-kind/unknown-valid` measured 6.4 ns alone and 14.8 ns behind `primitive/valid` and `any-valid`, moving its ratio against Zod 3 from 2.01× to 2.29×;
- the first array-carried `collection-transform/*` scenario in a process measured 83.5 ns on Valchecker where an identical schema after three other array pipelines measured 261.9 ns — 3.1× for the same work, visible on Zod 4 and not on Valibot;
- a 26 ns Standard Schema "overhead" that turned out to be position rather than interop.

The same three-scenario selection measured under cell isolation reports 6.4 ns for `unknown-valid` in both positions and holds its Zod 3 ratio at 2.02×, so the artefact is gone rather than reduced.

### How much it was moving

The whole standard tier was measured both ways back to back on one machine — 168 scenarios, 773 cells, standard profile. The artefact was not a caveat on a handful of rows:

- 684 of the 773 cells were more than 5% faster with nothing else in their process, and 5 were more than 5% slower. The median cell moved 24.5%;
- 496 of the 605 adapter-versus-Valchecker ratios moved by more than 5%, 412 by more than 10%, with a median move of 19.0% and a maximum of 165%;
- most decisively, of the 1,232 adapter pairs the report would have presented as *separated* — a gap above 5% in both runs — 153 reversed. That is 12.4%, against the 2.3% false-mark rate the 5% threshold was calibrated to. Those pairs are **not independent**: they are the separated pairs of about 167 scenarios, at most ten per scenario and averaging seven, and every pair inside one scenario is built from the same five cell measurements. Read the sample as about 167 rather than 1,232 — the excess survives that, since 12.4% against a 2.3% rate over 167 trials is roughly nine standard errors. What the excess says is that the bulk of the reversals came from the isolation change rather than from run-to-run noise. It does not say that one of the two runs was measuring correctly: the two measured different things, a cell alone in its process and a cell sharing one, and what the change bought is position independence rather than [realism](#what-it-costs-and-what-it-does-not-fix).

Two figures that were quoted here have been dropped rather than corrected: 106 of 167 scenario rankings changing, and 27 scenarios naming a different fastest library. Both are counts of orderings that differ between two runs, and neither has a null baseline — the methodology reference records that `zod4` against `zod4-jitless` alone flipped in 163 of 516 comparisons, 31.6%, between runs measured the *same* way, so a large number of orderings change between any two runs and a count of them says nothing on its own. The pair-reversal figure above is kept because it does have one: the 2.3% rate the 5% threshold was calibrated against.

The reason it damaged the within-scenario comparison and not only cross-scenario reading is that it was **adapter-dependent**. Median per-cell improvement under cell isolation: Zod 4 −38.5%, Zod 4 jitless −33.2%, Valchecker −32.6%, Zod 3 −23.9%, Valibot −13.5%. Valibot barely shows it, for the reason `collection-transform/*` recorded — `safeParse` gives it no per-schema call site to lose — so a shared process was systematically flattering Valibot against every other library. A bias that differs by adapter is not something a reader can be warned about; it had to be removed.

### What it costs, and what it does not fix

Those two runs took 1,456 s and 1,566 s: 110 s more, 143 ms per cell, 7.6% of the sampling budget at this profile. Process start plus module load measured on its own is 40.6 to 57.3 ms depending on the adapter; the rest is compiled code V8 no longer carries from one scenario to the next. On a full-tier `full`-profile run, where a cell costs about 4.5 s of sampling rather than 1.9 s, the same per-cell overhead is about 2.6 minutes out of roughly 81 — near 3%.

Cell isolation buys position independence, not realism. Every cell is now measured as the only schema in its process, which is the position-free measurement and not a model of an application holding many schemas at once; the polluted numbers were arguably closer to that steady state, but they were not comparable to each other and not comparable across adapters, which is what a benchmark has to be. A many-schema steady state, if it is wanted, belongs in its own scenario family.

Two other things are unchanged. Cells still run strictly one at a time, because overlapping two would change what every number means. And cross-scenario reading is still not a comparison the suite supports: different scenarios do different work, and `smoke`-tier and `full`-tier scenarios are not measured with the same sampling budget.

Absolute numbers from before 2026-07-28 are therefore lower bounds on nothing and upper bounds on nothing — they are numbers from a different measurement. Every figure this file quotes from an earlier run says so.

`--isolation adapter` reproduces the old behaviour. It exists because the archived runs were measured that way, so reproducing one of their numbers has to be asked for explicitly — and `compare` refuses to pair an `adapter`-isolated run with a `cell`-isolated one, so it can never happen by accident.

## Sharding across machines

A full-tier run is 1,104 cells — 241 scenarios across five adapters, less the 101 capability-gated combinations `verify` reports — so the **Performance Comparison** workflow splits the scenarios across machines. The split is **by scenario, never by adapter**: every adapter of one scenario is measured on one machine, because ranking adapters within a scenario is the only comparison the report makes and GitHub runners vary between jobs. Sharding by adapter would put each library on different hardware and destroy exactly that comparison.

The assignment is positional round-robin — the scenario at position `p` of the selected list belongs to shard `p % count`. It depends on nothing but the selection and the count: no seed, no measurement, no file order, so rerunning shard 2 of a failed run measures the same scenarios as the first attempt. It is also exactly invertible, which is what lets `merge` reconstruct the run order from the shard files without consulting the scenario registry. Round-robin balances the shards for free, because scenario families are contiguous in the registry and interleaving spreads each family's expensive large-collection cases across every shard.

`merge` refuses anything that is not one run's shards: a differing mode, seed, profile, isolation, scenario filter, adapter order, adapter version, commit, or Node.js version; overlapping scenario sets; a duplicated shard; an already-merged input; and a missing shard, because an incomplete merge would publish a fraction of the scenarios as a whole run. The merged file has the shape a one-shard run writes, so `report`, `summary`, and `compare` read it unchanged.

The commit and the Node.js version are refused for the same reason the profile is, and they are not hypothetical: rerunning one failed shard is a supported operation, and the rerun job checks out whatever the branch points at then and installs whatever its runner image ships. Neither difference is visible in the merged file, whose top-level environment is shard 0's. The adapter-version guard used to be unable to fire at all, because every adapter reported a source literal; each one now reports the version of the package it actually loaded, so two shards that installed different competitor builds are refused, and the versions a published report states are traceable to an install rather than to a string in the adapter. The Valchecker adapter reports `packages/valchecker`'s version, which within one version does not identify a build — `environment.commit` is the guard that catches a mixed build.

The shard sizes are checked against the shape positional round-robin produces: read in shard-index order they are non-increasing and span at most one scenario. Any other set of sizes did not come from one selection, and `interleaveShards` would silently reorder it into a catalog `report` accepts and presents as the run order. A shard whose recorded scenario list is not its own catalog is refused for the same reason. What the merge still cannot detect is two shards whose *assignments* were swapped, since equal sizes make that shape-identical; reconstructing the intended assignment would need the scenario registry, which is exactly what the merge is designed not to consult.

What sharding costs is recorded rather than hidden. `raw.json` carries a `shards` entry per shard with its index, its scenario ids, its window, and its own environment; the report prints a **Shards** table, names each scenario's shard and runner in its section, and warns that cross-scenario reading is invalid here for a second reason — the two numbers came from two machines. The summary's group columns pool scenarios and therefore pool machines, and say so.

## Manual GitHub Actions run

Use the repository’s **Performance Comparison** workflow to run a controlled cross-library comparison on `ubuntu-24.04` and Node.js 24. The workflow accepts:

- `profile`: `smoke`, `standard`, or `full`
- `adapters`: a comma-separated subset of `valchecker,zod3,zod4,zod4-jitless,valibot`
- `shards`: how many machines to split the scenarios across, 1 to 8 (default 4)
- `seed`: an optional deterministic execution-order seed

A blank seed is replaced with a value derived from the commit and workflow run; every shard receives that one seed, so all of them agree on the adapter execution order. Each shard job verifies every full-tier scenario across every adapter, then measures its own share of the requested profile; a final job merges the shards, reports, and publishes. Use `smoke` to validate the workflow and report pipeline; use `standard` or `full` for published comparisons.

Each completed run publishes:

- `raw.json`: every sample, scenario semantic, skipped-adapter reason, environment field, the measurement isolation, and the per-shard record of which machine measured which scenario; the source of truth

A rank marked `≈` is one the run does not separate from the rank above it — the two medians are within 5%, which is where orderings stop reproducing between runs. The summary's `Clear wins` column counts only wins with more than a 5% lead over the runner-up.
- `summary.md` and `summary.html`: concise benchmark-group interpretation and reliability warnings
- `report.md` and `report.html`: the complete scenario-by-scenario report

### Two perspectives over one run

Zod 4 compiles each schema into generated code. That is a different execution strategy rather than a faster version of the same work, so a single ranking would answer two questions at once.

When a run measures a generated-code validator, both artifacts present the same measurements twice:

- **Interpreted validators only** — ranks the libraries that interpret their schemas at execution time. This is the like-for-like comparison, and the one most performance issues reason about.
- **Including generated-code validators** — ranks everything, to be read together with the construction and cold groups, where generated code pays for its warmed throughput.

In `summary.md` these are two sections. In `report.md` each scenario table carries a `Rank` and a `Rank (interpreted)` column, plus a `Fastest` and a `Fastest (interpreted)` share, so no row mixes a generated-code number into an interpreted comparison and one scenario still means one table. A library outside a perspective shows `—` in its columns.

The split is driven by each adapter's own `capabilities.generatedCode` claim — the Zod adapter derives it from the live `z.config().jitless` setting rather than from its name, so the jitless adapter cannot contradict itself.

Two adapter selections produce a single undivided ranking instead:

- no generated-code validator was measured (for example dropping `zod4` from `adapters`) — the artifacts return to exactly the output they produced before this existed;
- excluding generated-code validators would leave fewer than two libraries to rank (for example `valchecker,zod4`). A ranking of one library is meaningless, but the run still mixes execution strategies, so both artifacts carry a warning saying no interpreted-only comparison is possible with that selection.

The concise Markdown report is written to the Actions job summary. The artifact retains both concise and detailed reports for 90 days. Record the commit, seed, Node.js version, runner image, and CPU model when comparing separate runs.

## Tree-shaking report

The **Bundle Size Impact** workflow runs on relevant pull requests and can also be started manually. It bundles equivalent Valchecker, Zod 3, Zod 4 classic, Zod 4 Mini, and Valibot schemas with one Rollup and Terser configuration, then reports minified, gzip, and Brotli sizes.

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

## Before/after benchmark comparison

The **Performance Impact** workflow measures the impact of a change and runs three ways:

- **Pull request (automatic gate).** Pull requests that can change either build compare the pull request base (`before`) against the head (`after`) with the standard profile, Valchecker only, five paired repetitions, and `fail_on_regression` enabled. Five rather than three because the gate classifies a scenario only when its paired-ratio interval is at most 5% wide, and three repetitions leave most scenarios unclassified and therefore unwatched. The scenario set is [scoped to the diff](#scoping-a-gate-run-to-its-diff).
- **Push to `main` (post-merge full run).** Every merge that can change either build compares the previous `main` tip against the merged commit over **every** scenario, so whatever the scoping missed surfaces within a day, attributed to the merge that caused it rather than to a day of them.
- **Manual dispatch.** `workflow_dispatch` compares two arbitrary revisions on demand and lets you choose exactly what to measure:
  - `before`: baseline git ref (branch, tag, or SHA); required
  - `after`: candidate git ref; defaults to the dispatched ref
  - `adapters`: competitor adapters to show alongside Valchecker (for example `valibot,zod3`); empty measures Valchecker only
  - `scenarios`: scenario ids or group names to run; empty runs every scenario for the profile
  - `profile`: `smoke`, `standard`, or `full`
  - `runs`: paired repetitions for the impact comparison (minimum three, default five)
  - `fail_on_regression`: fail the job when the impact verdict is a regression

The comparison scripts always come from the checked-out ref (the pull request merge ref, or the dispatched ref), so scenario selection and the compare tooling stay fixed; `before` and `after` are only two Valchecker builds the fixed scripts point at via `VALCHECKER_DIST_URL`.

### Scoping a gate run to its diff

Measuring all 170 standard-tier scenarios costs 55 minutes against a 90-minute timeout, and neither of the decisions that put it there can be reverted: five paired repetitions are what make a scenario classifiable at all, and one process per cell is what makes a subset of scenarios measure the same numbers as the whole suite. So a pull-request run measures the scenarios its diff can move instead:

> changed file → the steps that transitively import it → the scenarios whose declared `steps` name any of them.

`scripts/impact-selection.ts` holds the mapping and `scripts/select-impact-scenarios.ts` runs it. Replaying the last twelve merges that touched package source, the perf-focused changes this gate exists for attribute 2 to 24 scenarios, a change to a widely used step attributes 153 to 155, and a core change attributes all of them.

**Attribution follows imports, never directories.** `steps/isIsoDate/iso-calendar-date.ts` is reached by `isIsoDate` *and* `isIsoDateTime`, `steps/isIsoTime/iso-time-source.ts` by `isIsoTime` *and* `isIsoDateTime`, and `steps/isBase64Url/base64url.ts` by `isBase64Url` *and* `isJwt`. A rule keyed on the directory would drop the second step of each pair and with it every scenario that only that step names.

Under-selection is the failure mode — a scenario that should have run and did not is a regression reaching `main` behind a green gate — so three things break toward measuring more.

**Anything the mapping cannot place is a full run.** That is the default, and the exclusions are enumerated rather than inferred:

- a file under `packages/*/src/` that the published build entry (`packages/valchecker/src/index.ts`, the single entry `tsdown` bundles) does not reach. It cannot be in either bundle. Today that is 273 of the 522 files there, every one a `*.test.ts`, a `*.bench.ts`, or a `src/test-utils/` fixture — a fact the graph establishes rather than a pattern that is trusted. The pattern is consulted only for a path the diff *deleted*, which has no tree entry left to compute reachability from, and the attribution refuses itself if it ever finds a file the pattern excuses reachable from the entry;
- a re-export barrel, which has no runtime code of its own. What one can change is which modules the bundle holds — adding a step adds a method to the shared prototype — and that is what the canary's construction and cold scenarios measure. This is the one judged exclusion; making it a full run instead would have taken 3 of the last 12 merges from a scoped run to a complete one;
- `benchmarks/**`, because one checked-out copy of the measuring apparatus measures both revisions, so a change there moves both sides together;
- `docs/**`, `scripts/**`, `.github/**`, `type-performance/**`, Markdown, and editor or lint configuration, none of which is an input to `tsdown`'s compilation. The files that decide how this gate itself runs are the exception: changing one measures everything.

Everything else — a lockfile, a package manifest, a `tsdown.config.ts`, a `tsconfig.json`, a new top-level path, a shipped module no step reaches such as `packages/valchecker/src/default.ts` — is a full run.

**Every rule above is about what a file means, not about whether its bytes moved.** `scripts/inert-change.ts` compares the two revisions of each changed path and the selector ignores the ones that come out equal: a YAML file is parsed and deep-compared, since comments and formatting are not part of a parsed document, and a TypeScript file is reprinted from the compiler's own AST with the comments no tool reads blanked out first, which also absorbs indentation, line endings, and blank lines. The rule this fixed was costing what it was written to buy: syncing a scenario count in prose touched the workflow and both selection scripts, and three comment lines bought a 55-minute comparison. It cuts the other way too — a JSDoc correction to a step no longer selects that step's scenarios, which is what three of the twelve replayed merges had been paying for. This is stricter rather than looser: the question is now "did anything that can change behaviour change", so a behaviour-changing edit to any of those files still measures everything, and a path with no canonical form — JSON, a manifest, anything unrecognised — is never inert. A file the diff added or deleted has no counterpart to compare and is never inert either, so a deleted source file is still a full run.

**Some comments are not comments.** `@__NO_SIDE_EFFECTS__` and `@__PURE__` decide what the bundler may drop, so adding, removing, or moving one changes which code the bundle holds and what runs when it is imported — `check-step-parameter-style.ts` requires the first around every tree-shakable plugin construction and `treeshake.mjs` gates the result. Those are compared, in place, and a moved annotation is a change. A `@ts-expect-error`, an `eslint-disable`, a `v8 ignore`, and a legal comment are not: none of them changes the JavaScript in either bundle, and each one is read by a gate that fails loudly on its own — a suppression that stops suppressing fails `pnpm typecheck` and the gate's own build of both revisions before anything is measured. The canary runs whatever the diff says, so an inert change is still measured against the core paths.

**Both `paths` filters are the complement of that list, not a list of source directories.** A rule the workflow never starts for cannot fire, and the first version of this gate filtered both events to `packages/*/src/**`, `benchmarks/**`, and two `.github` files — so every rule in the paragraph above was unreachable, a dependency bump got no comparison before or after merge, and a pull request touching only `scripts/impact-selection.ts` triggered nothing at all. The filters are now `**` minus the exclusions, with the five gate-defining files re-included after the `scripts/**` and `.github/**` exclusions that would otherwise swallow them. `scripts/check-impact-triggers.ts` classifies every tracked path plus the change classes no file currently represents, and fails on any full-run path the filters miss — and, in the other direction, on a documentation-only path that matches, so the check cannot be satisfied by widening the filter to everything. The post-merge event excludes `benchmarks/**` as well, because both revisions then build the same library.

**A canary set runs whatever the diff says:** every `construction` and `cold` scenario, plus `primitive/valid`, `flat-object/valid`, `schema-kind/unknown-valid`, `primitive/invalid-type`, `flat-object/invalid-first`, `issue-policy/{object,array}/invalid/{first,all}`, `async/check-valid`, and `async/wrapper-valid`. Thirty scenarios, about ten minutes of the job. Construction and cold are taken whole because module initialisation, step registration, and the shape of the prototype every schema shares are not attributable through a scenario's `steps` at all — no scenario declares them — and those two groups are the only ones that measure construction. The named scenarios are the core machinery every other scenario is built on, so a broad regression cannot hide behind a mapping that missed it.

**Every benchmark group keeps at least two measured scenarios.** The severe-*group* trigger needs two, and a group left with one has no trigger — a one-row aggregate is that row's own number wearing an aggregate's authority. The canary covers all seven groups, and selection tops any group with a single scenario back up to two, so the trigger is never silently absent. The prerequisite is two *measured* rows, decided by the selection before anything runs, rather than two decisive ones: a count of decisive rows would make the group verdict conditional on how the measurement turned out, which is the bias the group estimator exists to remove. `impact.md` names any group with fewer instead of presenting it as a group the trigger cleared.

**A group is estimated directly.** Per repetition, the log ratios of every cell selected into the group are averaged into `G_r`; the group's change is `exp(mean(G)) - 1` and its verdict is the Student-t interval across `G_1 ... G_5`, severe when that whole interval is at or below -5%. A cell verdict answers "did this cell regress?" and this answers "did this affected group broadly regress?", independently rather than one derived from the other. Two consequences: an inconclusive row's cell is still in its group's estimate, widening the interval rather than being dropped from it; and a group can be decisive where none of its rows is, because averaging within a repetition cancels noise that is not common to its cells.

**A group aggregate carries its denominator.** `warm/success` has 114 of the standard tier's 170 scenarios, so a scoped run can compute its geometric mean over 5 of them, and `2/2 stable` beside that mean is indistinguishable from a complete comparison of a two-scenario group. Every group row in `impact.md`, `impact.json`, and the **Scenario scope** table now reads `measured/total`, and a partly covered run states that the mean is over what ran and cannot contain a regression in a scenario that did not.

There is deliberately **no coverage floor below which the trigger is reported as unavailable.** The scenarios a scoped run leaves out are the ones the diff cannot move — that is the selection's premise, defended by an import graph whose default for anything it cannot place is a full run — so a low fraction is evidence that the group was mostly irrelevant to the diff, not that the trigger is blind. Dropping unaffected scenarios also makes the mean *more* sensitive: two scenarios down 6% move an aggregate over five that 111 flat ones would have buried. And declaring a trigger unavailable detects nothing; it converts a pass into an unknown, and the unknown would be wrong in the common case. What is genuinely unavailable is a trigger over fewer than two measured scenarios, which is reported by name. `benchmarks/src/comparability.mjs` also carries the selection in the measurement identity, so a scoped run and an unscoped one are refused as a pair instead of compared.

**Scoping does not make a scenario harder to judge.** Replaying the 169-scenario, five-repetition run 30296929034 under ten historical merges' selections, 76% to 88% of the selected scenarios were classifiable, against 78% for the whole suite; the small perf-focused diffs this gate exists for came out best, at 82% to 88%. The absolute count falls — 28 to 41 classifiable in a 32-to-48-scenario selection against 131 of 169 — because scoping changes the denominator on purpose, so the per-scenario rate is the criterion the design can be held to. The replay rests on what the cell-isolation work established: a scenario's number does not depend on what else ran.

The job summary opens with a **Scenario scope** section stating how many scenarios ran of how many, which steps the diff reached, what each changed path did, and the per-group counts. A reader of a passing gate can see that it measured 34 scenarios and which ones, rather than assume it measured everything.

**The `steps` declarations are checked, not trusted.** They are load-bearing twice over — for step coverage and for this selection — and `benchmarks/src/step-audit.mjs` drives every build key through a recording Valchecker instance and compares the methods observed against the declaration. An under-declaration fails, because it silently removes a scenario from the selection; an over-declaration is listed and allowed, because a step can be reached without its method being called, as `templateLiteral` reaches `literal` through a registry lookup inside `v.union(['px', 'em', 'rem'])`. It runs in `pnpm --dir benchmarks verify`, and it found one under-declaration on its first run: `builtinFlatObject` also calls `check`, because the adapter spreads `createFields()` before overriding the email field.

Run the same selection locally:

```bash
pnpm bench:impact-scope --base main --head HEAD
```

**The impact gate is deliberately not sharded.** Its per-scenario classifier would survive sharding — the split is by scenario, so all five repetitions of both sides for one scenario would still be measured adjacently on one machine, and a paired ratio cancels machine speed. What would not survive is the severe-*group* trigger, a 5% geometric-mean regression across two or more stable scenarios in a group: sharding makes that an aggregate over several runners, and it is the trigger that catches broad moderate regressions the per-scenario 10% threshold misses. The cost side does not favour sharding either, because every shard job would have to install and build *both* revisions — a fixed several minutes that does not shard — so the wall-time saving is well under 1/N while runner minutes multiply, and 5 repetitions × 2 sides × N shards of artefacts would have to be fanned out, merged, and paired for a gate whose failure mode has to stay legible. `compare` refuses to pair runs whose shard count differs, so if one side is ever sharded the gate fails loudly instead of comparing across machines silently. Sharding by *repetition* rather than by scenario was also considered and rejected: it would put the repetitions of one scenario on different machines, which is precisely what the paired design exists to avoid.

Isolation still applies: the gate measures each scenario in its own process like every other run, which at 143 ms per cell costs about 4 minutes across the 1,690 cells of an unscoped run's ten side-runs, and proportionally less for a scoped one. A scenario therefore costs about 19.7 s of the job — 1.83 s of sampling plus 0.14 s of process isolation, ten times over — which is the number to multiply when reading a **Scenario scope** count: the 30-scenario canary floor is about ten minutes, and the full 170 about 55.

Valchecker before/after uses paired independent process runs. Each candidate result is divided by the adjacent base result from the same repetition, and base/candidate order alternates by repetition parity to reduce thermal, scheduler, and runner drift.

**One estimator, in log space.** Each repetition contributes `d_r = ln(candidate_r / baseline_r)`; the estimate is `mean(d)` with a 95% Student’s t interval, and both are converted back with `exp`. So the reported change is `exp(mean(d)) − 1` and the interval is the same statistic's bounds — not, as before, an interval centred on the mean of the paired ratios beside a point estimate that was their median. Two estimands could disagree about a row, and the one that decided was not the one on display. The log form also makes improvement and regression multiplicatively symmetric (a doubling and a halving are `±ln 2`, not `+1.0` and `−0.5`) and composes with the geometric aggregate the group verdict uses. Student’s t stays: five repetitions estimate their own spread, and the normal quantile understates a five-sample interval by 42%. `pairedRme` is that half-width in percent, reported as a diagnostic; separate base/candidate medians, cross-run variation, and within-process sample RME remain in the JSON evidence.

A row is judged by **where its whole interval lies**, never by the point estimate alone:

- the whole interval inside ±5%: `cleared`, however imprecise
- the whole interval at or below −5%: `regression`
- a regression whose point estimate is also at or below −10%: `severe`, which fails the gate
- an interval spanning a threshold: `inconclusive` — not a pass, named in the report, and the input to the confirmation stage
- at least a 5% geometric-mean regression across a benchmark group, judged as its own interval: severe group regression

Severe regressions fail the workflow when `fail_on_regression` is enabled (always on for pull requests). Mixed improvements and regressions remain a reviewer decision. A performance change is valuable only when the target workload and tradeoff are explicit:

- construction or fresh-schema cost may increase only when warmed gains are larger and the amortization point is documented
- warmed success, library-default failure, first-issue failure, and all-issues failure are evaluated as separate groups
- added implementation complexity or package size should normally buy at least 10% in a representative hot path or broad gains across multiple scenarios
- semantic correctness, API stability, coverage, and package integrity remain hard constraints

When `adapters` is set (manual dispatch), the job also publishes each build’s ranking against the selected competitors so the standing versus peers is visible before and after. The job summary shows the impact verdict, per-scenario changes, and any competitor rankings; the artifact retains every raw result and report.

## Local run

Build Valchecker first, then install the isolated benchmark dependencies without lifecycle scripts:

```bash
pnpm build
pnpm --dir benchmarks install --ignore-workspace --lockfile=false --ignore-scripts
```

Verify every adapter and full-tier scenario without timing, and audit every `steps` declaration against what its `build()` calls:

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

Compare repeated Valchecker benchmark results by passing each paired run in matching order, plus the cell catalog the measuring run persisted:

```bash
pnpm --dir benchmarks compare \
  --baseline results/base-1.json \
  --baseline results/base-2.json \
  --baseline results/base-3.json \
  --candidate results/head-1.json \
  --candidate results/head-2.json \
  --candidate results/head-3.json \
  --cell-catalog results/cell-catalog.json \
  --markdown results/impact.md \
  --json results/impact.json \
  --html results/impact.html
```

`--cell-catalog` is required, and it is the point rather than a parameter. Coverage denominators used to be built here by collecting the cells, which imports every `<name>.bench.ts` under a loader that resolves the library to a build under test — so the first sharded CI run measured all 245 cells across four shards and then failed in `compare` for want of `VALCHECKER_DIST_URL`. A stage that reports on two builds must not execute either, so `pnpm --dir benchmarks cells --catalog-output <path>` writes the catalog as data during measurement and this stage reads the file. The artifact carries a hash of the cell set; every shard records the hash it measured against, `merge` refuses shards that disagree, `comparability.mjs` carries it in the measurement identity, and `compare` refuses a catalog that is not the one the runs were measured against — so the one thing persisting a denominator could have made worse, reading a stale copy, fails loudly. Reading an archived cross-library comparison instead is `--catalog scenarios`, which takes no cell catalog and is the only case that loads the scenario registry at all.

Every comparison prints `measured N / added M / removed K` whether or not any of them is zero. `measured` is the cells with a number on both sides, the only kind that can produce a paired ratio; `added` executed against the candidate build and not the baseline's, which is what a new step looks like; `removed` executed against the baseline and not the candidate's, which is a cell whose subject stopped working. Both lists are named, not just counted. One ceiling: cell *definitions* come from the checked-out ref only, because they are the apparatus, so a cell deleted from the candidate tree is not in the catalog at all and appears in none of the three counts.

Profiles:

- `smoke`: correctness plus a fast execution check
- `standard`: normal comparison run
- `full`: longer samples and large-array scenarios

`standard` and `full` sample each measurement until its 95% confidence interval is within 0.75% of the mean, between five samples and the profile's cap, so measurements in one run rest on different numbers of samples. The report's `Samples` column records how many, and `†` marks a measurement whose interval never reached the target. A measurement that stopped early reports the interval it had at that moment, which is at most the target and therefore understates the spread a longer run would find. `smoke` sets no target and always takes three samples.

Raw output defaults to `benchmarks/results/raw.json`. Use `--output <path>`, `--seed <value>`, or `--adapters valchecker,zod4` to customize a run.

Measure one shard of a run and merge the pieces with `--shard-index`/`--shard-count` and `merge`. All shards need the same seed, mode, adapters, scenario selection, and isolation, and every shard must be present:

```bash
pnpm --dir benchmarks bench --mode standard --seed fixed --shard-count 2 --shard-index 0 \
  --output results/shard-0.json
pnpm --dir benchmarks bench --mode standard --seed fixed --shard-count 2 --shard-index 1 \
  --output results/shard-1.json
pnpm --dir benchmarks merge \
  --input results/shard-0.json \
  --input results/shard-1.json \
  --output results/raw.json
```

`--isolation adapter` reproduces the pre-2026-07-28 behaviour of one process per adapter, for reproducing an archived number; see [Measurement isolation](#measurement-isolation).

Restrict a run to specific scenarios with `--scenarios`, accepting a comma-separated list of scenario ids (for example `primitive/valid`) or benchmark-group names (for example `warm/failure/first`); the union of matches runs and every other scenario is skipped. Explicit selection ignores the sampling tier, so a named scenario always runs regardless of `--mode`, and an unknown id or group is a hard error.

```bash
pnpm --dir benchmarks bench --mode standard --adapters valchecker,valibot \
  --scenarios primitive/valid,warm/failure/first
```

## Methodology

Every adapter implements the same schema families and fixtures where the libraries expose comparable behavior. Before timing a scenario, the runner verifies the expected success/failure state, transformed output where relevant, and exact issue-count requirements for diagnostic-policy scenarios. CI executes every full-tier supported scenario once across all adapters and records unsupported adapter/scenario combinations instead of assigning synthetic behavior.

An output assertion is only worth as much as the comparison behind it, so `canonicalizeOutput` in `src/scenarios/define.mjs` has a branch for every value `JSON.stringify` cannot separate: a Map, a Set, a bigint, a symbol, a property valued `undefined`, and — because they have no own enumerable properties and would all serialize to `{}` — a `Date`, a `File`, and a `Blob`. Any other object with no own enumerable properties is refused with a message asking for a branch, rather than compared as an empty object, so the next fixture of that shape cannot pass an assertion vacuously. `report` and `summary` both refuse a result row naming a scenario outside the run's catalog or naming one twice, which would otherwise shrink or double a group count with nothing to show it.

The suite separates:

1. complete schema construction, including all child schemas,
2. complete schema construction plus first validation (cold),
3. warmed successful validation,
4. warmed failure under each library’s default diagnostics,
5. warmed failure that stops after the first issue, and
6. warmed failure that exhaustively collects issues.

Scenarios cover primitive pipelines, flat and nested objects, strict and loose object behavior, arrays, Sets, Maps, ordered unions, discriminated unions dispatched by tag, recursive schemas, failure recovery, nullish narrowing, compatible synchronous intersections, transformation pipelines, optional-heavy configuration objects, open records, tuples with a rest region, template literals, date validation, string-to-date conversion, date bounds, files, a file MIME-type check, every built-in string-format validator, finite membership, every built-in numeric, string, equality, and collection-size constraint validator, the coercing initial schemas with their conversion-step counterparts, the string case and shape transformations, the remaining initial schemas, the collection and Map reshaping transformations, JSON parsing and serialization, asynchronous validation, the Standard Schema V1 entry point, and schema delegation. Full mode adds 1,000-element array and record cases plus the secondary and failure variants of the newer families.

The string-format scenarios cover one built-in format validator each: `isEmail`, `isUuid`, `isIsoDateTime`, `isUrl`, `isIp`, `isIsoDate`, `isIsoTime`, `isEmoji`, `isBase64`, `isBase64Url`, `isNanoid`, `isUlid`, `isCuid2`, `isJwt`, `isHex`, `isMac`, and `isHostname`. `isMimeType` reads a value's own `type` string rather than validating a string, so it is measured over a `File` as `file-mime-type/*` instead. `isEmoji` is the one validator with two scenario pairs, because it has two accepted sets: `string-format/emoji-*` for the default UTS #51 grammar and `string-format/emoji-registered-*` for `{ registered: true }`. Both are needed — a step with an opt-in second semantics has a second cost, and one measured row would leave the other free to regress unseen.

The `constraint/*` scenarios do the same for the constraint validators, one per scenario pair: `isAtMost`, `isGreaterThan`, `isLessThan`, `isMultipleOf`, `isFinite`, `isSafeInteger`, `isNaN`, `isStartingWith`, `isEndingWith`, `isIncluding`, `isLengthExactly`, `isNotEmpty`, `isEmpty`, `isEqualTo`, `isSizeAtLeast`, `isSizeAtMost`, and `isSizeExactly`. Every one of them exists in all four pinned libraries — Zod spells them as schema methods, Valibot as pipe actions — so nothing in the family is capability-gated. Each is carried by the smallest schema that can hold it, and each invalid fixture is a value of the right type sitting just outside the bound under test rather than a wrong-typed value that would fail earlier. The numeric bound fixtures are all ordinary finite numbers, because the four base number schemas disagree about non-finite input — `v.number()` admits `NaN` and `±Infinity`, Zod 3's rejects `NaN`, Zod 4's rejects both, and Valibot's rejects `NaN` — and that difference belongs to `constraint/finite` and `constraint/nan` rather than to a bound.

`constraint/stack-*` is the deliberately separate case: five constraints on one string field, which is what a real schema does. The single-constraint scenarios measure the cheapest possible refinement — already past the point where the competitors lose the bare-schema fast path noted under date bounds below — while the stack is what shows how the cost grows from there.

`coercion/*` covers reading a value out of a query string, a form body, or an environment variable: the coercing initial schemas `looseNumber`, `looseBoolean`, and `looseBigint`, and the conversion steps `toNumber`, `toBoolean`, `toBigint`, `toString`, `toSafeNumber`, and `toMappedBoolean`. No two libraries accept the same set here, so every fixture was executed through each participating adapter and kept only where accept, reject, and transformed output all agreed; the differences are recorded under compatible-subset scopes below. Two consequences are worth stating up front. `z.coerce.*` performs no input type check at all — `z.coerce.number()` accepts `true` and `null`, which `looseNumber()` rejects — so it is the comparison for the loose schemas but not for the conversion steps, whose Valchecker chains keep a type check the competitors can only keep by wrapping the same native function in a `transform` callback. And most conversions cannot fail: `Number('abc')` is `NaN` rather than a throw, so `toNumber`, `toBoolean`, and `toString` fail only where their leading type check fails. `primitive/invalid-type` and `transform/invalid-type` already measure `v.string()` rejecting a non-string, so the family adds exactly one type-check failure, `coercion/to-string-invalid-type`, for the `v.number()` check no existing scenario measures.

`coercion/to-safe-number-*` measures `toSafeNumber`, which was wrongly excluded from the suite until 2026-07-28 on the claim that no pinned library has an equivalent. All three do, spelled with built-ins: `z.bigint().transform(Number).pipe(z.number().safe())` on both Zod pins and `v.pipe(v.bigint(), v.transform(Number), v.safeInteger())` on Valibot. Valchecker range-checks the bigint and then converts while the competitors convert and then range-check, which reaches the same decision because `Number(bigint)` rounds to a double outside the safe integer range exactly when the bigint was outside it. Executed rather than argued: the four agree on `42n`, `2n ** 53n - 1n`, `2n ** 53n`, `±(2n ** 60n)`, and on 500,000 random bigints spanning the boundary, with no divergence in accept, reject, output, or issue count. The two claims behind the old exclusion were both false — `z.coerce.number()` is not Zod's only spelling, and `Number(2n ** 60n)` loses no precision; it is exactly 2^60, printed as `1152921504606847000` only because that is the shortest decimal that round-trips. The invalid row is the one conversion failure in this family that belongs to the step rather than to a leading type check, so unlike the other conversions it has a real invalid twin, and all four report exactly one issue for it.

`variant/*` and `union-large/*` are one branch set measured two ways. Every participant ships a tagged union — `variant()` here, `z.discriminatedUnion()` in both Zods, `v.variant()` in Valibot — and the suite measured none of them before: `union/*` has five branches, which cannot separate a lookup from a linear scan. The two build keys share twenty tagged object branches, built by every adapter from the same ordered list in `fixtures.mjs`, so `union-large/last` and `variant/late` are the same branches reached two ways. Twenty is a realistic tagged-event union and large enough for the dispatch difference to exceed the 5% the harness needs to call an ordering reproducible; every branch carries the same `{ type, id, size, enabled }` payload so that an early hit and a late hit differ in dispatch and nothing else. Read from the four sources rather than assumed: Valchecker keeps a Map of branch executors, Zod 3 an `optionsMap`, and Zod 4 a cached discriminator Map, so all three dispatch by lookup, while Valibot's `variant` runs each option's discriminator schema in order until one matches. `union-large/first`, `/middle`, and `/last` measure the same twenty branches without a discriminator, where branch order is normative for Valchecker and `/last` is therefore the worst case everywhere.

`recursion/*` and `construct/recursive-tree` are the suite's only recursive schemas: `generic(factory)` against `z.lazy()` and `v.lazy()`, which all four libraries ship. The fixture is a complete binary tree of depth five — 63 nodes over six levels — which keeps per-operation cost near the existing `nested-object` and 100-element collection scenarios while making the recursion rather than one object the subject. `children` is a required array and leaves carry an empty one, because optional-field semantics belong to `optional-heavy/*`. Each adapter defines the cycle inside its build function so construction rebuilds it. The four resolve the cycle differently and the scenarios are meant to show it: Valchecker's `generic(factory)`, Zod 3's `ZodLazy`, and Valibot's `lazy` invoke the getter on every execution, while Zod 4 caches the resolved inner schema. Resolving per execution is also why the Valchecker pipeline is maybe-async here even though every step completes synchronously.

`fallback/*` measures both sides of recovery: `fallback/unused` is the production-common path where a valid input never invokes the callback, and `fallback/recovers` is the path that builds a failure and then replaces it. All three libraries take a getter callback and every adapter passes one, so no side of the comparison is a user closure standing in for a built-in.

`nullish/*` measures `isDefined()`, `isNonNull()`, and `isNonNullish()` on `unknown()`. Their opponents are `nonOptional`/`nonNullable`/`nonNullish`, not `optional`/`nullable`/`nullish`: the wrappers accept what these steps reject, so measuring one against the other would compare opposite decisions. The suite's existing coverage is the accepting direction only, and it is the `[v.string()]` shorthand inside `optional-heavy/*`, which is `object`'s own optional handling rather than a `union` branch.

`schema-kind/*` covers the initial schemas nothing else measured — `any`, `unknown`, `never`, `null`, `undefined`, `bigint`, `symbol`, `instance`, and `blob` — plus `json`, grouped with them as the last unmeasured schema kind even though it is a step on a string. These are the cheapest schemas every library ships, so the family exists for two reference numbers and one failure path rather than for the ranking inside any single row. `any-valid` and `unknown-valid` accept every value and run no check, so they time each library's per-call overhead with nothing validated: the floor every other scenario's number sits on top of. `never-invalid` rejects every value and validates nothing, which makes it the matching floor for the failure path — error construction with no validation in front of it — and it declares an issue count, because a row claiming to be pure error construction has to hold the diagnostic work fixed; all four libraries report exactly one issue there. Outside the explicit issue-policy families it is one of only two scenarios that declare a count — `coercion/to-safe-number-invalid` is the other, for the same reason. `json-invalid` adds the throw `JSON.parse` raises and the `catch` that turns it into an issue, a failure path nothing else in the suite runs.

These floors are where the intra-process position artefact was first isolated, and reading them is what [cell isolation](#measurement-isolation) fixed. Under the previous one-process-per-adapter measurement, `unknown-valid` reported 6.4 ns measured on its own and 14.8 ns behind `primitive/valid` and `any-valid` — roughly twice, reported identically by both floors because they do identical work — and its ratio against Zod 3 moved from 2.01× to 2.29×. The effect applied to every scenario and only became visible where there was no validation work to hide it. Under cell isolation both positions report 6.4 ns and the ratio holds at 2.02×, so a floor from one run is now a floor. A number quoted from an `adapter`-isolated run still carries the artefact; check the `isolation` field before comparing one.

The family adds no failure counterpart for `null`, `undefined`, `bigint`, `symbol`, `instance`, or `blob`: each is one comparison plus one issue, which `primitive/invalid-type` already measures. `any` and `unknown` cannot fail and `never` cannot succeed, so neither gets an invented scenario in the direction it does not have.

`string-shape/*` measures one string transformation each — `toUppercase`, `toTrimmedStart`, `toTrimmedEnd`, and `toNormalized` — where `transform/*` measures three of them together with a closure. Every participant spells its transformation as a built-in and all of them produce identical output, so these scenarios are `equivalent`. The family has no failure scenario: each step is one `String.prototype` call that cannot fail, and its only failure path is the same `v.string()` check the two scenarios named above already measure.

`collection-transform/*` is the mirror image of `primitive-builtin`. There the Valchecker side of an older scenario ended in a `check()` closure while the competitors used a built-in pattern action, which flattered them; here the built-in is Valchecker's. Zod has no transformation action for any of `toArray`, `toSize`, `toKeys`, `toValues`, `toEntries`, `toMappedKeys`, `toMappedValues`, `toMapped`, `toFiltered`, `toSorted`, `toSliced`, `toSplit`, or `toLength`, so every Zod cell is `.transform()` around the same native call the step delegates to. That is a real difference in what the libraries provide rather than a benchmark defect, so it is measured, and every scenario declares `compatible-subset` so the row cannot be read as equivalence. Valibot is not uniformly on the closure side: `mapItems`, `filterItems`, and `sortItems` are built-in transformation actions that hand the callback straight to `Array.prototype.map`/`filter`/`sort`, so three rows compare a built-in against a built-in on that adapter and against a closure on both Zods. All the callbacks, the slice range, and the separator come from one shared fixture, so the four adapters call the same function objects.

Ten items everywhere, matching `array/10-valid`: a 1,000-element `toSorted` would measure `Array.prototype.sort` rather than the library. Each step then sits on the smallest schema that can carry it, as in `constraint/*` — a Set for `toArray`/`toSize`, a Map for the five Map steps, a ten-number array for the four array steps, a string for `toSplit` and `toLength`.

**Do not read the rows of `collection-transform/*` against each other.** Sharing a base schema makes them look comparable and they are not: thirteen different steps on four different carriers are thirteen different amounts of work, which is the same reason no two scenarios in the suite are comparable.

This family is also where the position artefact was worst, and it is what forced [cell isolation](#measurement-isolation). Measured under the previous one-process-per-adapter runner, the first array-carried scenario in a process reported 83.5 ns on Valchecker while an identical schema measured after three other array pipelines reported 261.9 ns — 3.1× worse for the same work. Zod 4 showed the same effect from 132.7 to 285.2 ns, and Valibot did not show it at all (275.5 to 272.1 ns), because `safeParse` gives it no per-schema call site to lose. It keyed on the carrier rather than on position in the process — a Set and two Map scenarios in front of `collection-transform/to-mapped-valid` left it fast, one more array pipeline did not — so under that runner the first row of each carrier group was the most favourable position Valchecker and Zod 4 could be measured in rather than a typical one. With each cell in its own process there is no preceding array pipeline to lose the call site to, so the row order no longer decides the number. Any figure quoted above from an `adapter`-isolated run still carries the artefact.

The family adds no failure scenario. Eight of the thirteen steps own no issue at all, so their only failure is the type check in front of them, which `primitive/invalid-type` and `transform/invalid-type` already measure. The five callback-bearing steps fail only when a callback throws, and a throw inside a Zod or Valibot callback escapes `safeParse` — the same finding `fallback/*` and `coercion/*` recorded — so such a scenario would be a Valchecker-only row duplicating a focused benchmark. The Set branches of `toMapped` and `toFiltered` are left out for a stronger reason: Valibot's `mapItems`/`filterItems` are array-only, and `new Set([...set].map(f))` silently deduplicates where `toMapped` rejects with `toMapped:duplicate_mapped_item`, so the closure makes a different decision rather than the same one more cheaply. Those paths are measured by the colocated focused benchmarks.

`serialization/*` measures `toJSONValue` and `toJSONString`, the two transformations in that batch with a failure of their own. All five adapters run the valid cases; the two invalid cases are gated, because Zod's only spelling lets `JSON.parse`'s `SyntaxError` and `JSON.stringify`'s circular-structure `TypeError` escape `safeParse`. `toJSONValue` is `JSON.parse` in a `try`/`catch` on both participating sides and the rows land within about 6% of each other, with the invalid one dominated by the `SyntaxError` itself (3,692.2 ns against Valibot's 3,895.2 ns). `toJSONString` is the substantial `compatible-subset`: it performs a single-read preflight over own enumerable JSON properties before calling `JSON.stringify`, which is what turns a cycle, a bigint, a symbol, a function, an explicit `undefined`, or an array hole into a structured issue carrying the nested `at` path instead of a throw, an omitted key, or a `null`. The two rows are the two ends of that decision and should be quoted together: serializing the valid payload costs Valchecker 1,274.9 ns against Valibot's 218.5 ns, while rejecting the cycle costs Valchecker 252.3 ns against Valibot's 4,157.6 ns. The paths where the libraries disagree — an explicit `undefined` property, an array hole, or a throwing getter or `toJSON` — have no fixture every participant agrees on and are left to the focused benchmark.

`async/*` is the asynchronous execution path, which nothing in the suite measured before — no scenario and no fixture contained an `async` or an `await`. All five adapters participate on all four rows. The libraries reach asynchrony from opposite places, which is the point of the family: in Valchecker it belongs to the schema, because a `check` or `transform` callback returning a `PromiseLike` makes the pipeline maybe-async and `toAsync()` forces a promise even for a synchronous success, so `execute` is unchanged; in Zod it belongs to the call, because an async `refine`/`transform` callback makes the schema parseable only through `safeParseAsync` and a synchronous `safeParse` of one throws; in Valibot it is both, because `pipeAsync` with `checkAsync`/`transformAsync` is the only pipe that can hold an async action and it must be run through `safeParseAsync`. Both callbacks resolve immediately — `async` with nothing awaited inside — and both come from `fixtures.mjs`, so the three libraries await the same function object and the subject is the promise machinery rather than a timer.

These cells are measured with the `await` inside the timed loop, which is the measurement rather than an artifact of it: an asynchronous caller cannot avoid the microtask turn that delivers the result. They therefore carry their own benchmark groups (`warm/async/success`, `warm/async/failure/library-default`) so that no aggregate averages an awaited number with a synchronous one, and every result and catalog entry records `executionMode`. Two pairs are meant to be read across the sync/async line and only these two: `async/wrapper-valid` against `primitive-builtin/valid`, which is the same schema and fixture on all five adapters made asynchronous in the only way each library offers, so the difference is the promise machinery and nothing else; and, much more loosely, `async/check-valid` against `primitive/valid`. Quote both from one run: they are the two pairings the suite supports across the sync/async line, and nothing else is. A maybe-async pipeline that fails *before* its async callback has no honest cross-library row — Valchecker answers synchronously where neither competitor can run the schema synchronously at all — and asynchronous structural, union, and intersection scheduling stays out for the reason the methodology already gives for intersections.

`standard-schema/*` is the Standard Schema V1 entry point, `schema['~standard'].validate(input)`, which all four libraries implement and which is how tRPC, TanStack Form, and similar libraries reach a schema. Every other scenario in the suite calls the native entry, so the interop path was unmeasured. Each of the four scenarios reuses an existing build key — `primitive`, `flatObject`, `asyncCheck` — and changes nothing but the entry point, so it pairs with a native row over the identical schema and fixture. Read from each implementation: Valchecker installs `'~standard' = { version: 1, vendor: 'valchecker', validate: execute }`, where `validate` is the *same function object* as the public `execute` and the public result is already the Standard Schema result, so the layer is an alias; Zod calls the synchronous parse inside a `try`, falls back to the asynchronous parse on a throw, and rebuilds the result; Valibot returns its internal dataset, so a typed failure arrives as `{ value, typed: true, issues }` — with a `value` present. Success is therefore the absence of `issues`, as the specification says, and the harness normalizes the standard result once for all four rather than per adapter, because Standard Schema is one contract and not four spellings. `~standard.validate` can return a promise on all four, and only for a schema whose work is asynchronous, so the entry point does not decide the execution mode and `standard-schema/async-check-valid` declares `async` like any other awaited cell.

Measured alone at the standard profile — which needed a deliberate one-scenario-per-process run at the time, and is now what every cell gets — the valid path costs Valchecker 62.9/62.1 ns natively against 61.5/62.0 ns through the entry point (no measurable difference, which is what an alias should show), Zod 3 61.6 → 62.5 ns, Zod 4 93.4 → 100.9 ns, and Valibot 94.4 → 110.5 ns. Under the old one-process-per-adapter runner a twelve-scenario smoke selection read the same Valchecker pair as 61.7 → 87.8 ns, and that 26 ns was position rather than interop: it is the finding that made [cell isolation](#measurement-isolation) worth its cost. The one place the implementations diverge sharply is an asynchronous schema: Zod 4 costs about 5,500 ns per call through `~standard.validate` against 336 ns through `safeParseAsync`, because the failed synchronous attempt constructs and throws a `$ZodAsyncError` on every call.

`delegation/*` composes one already-built schema into another: `unknown().use(inner)` in Valchecker, `.pipe(inner)` on both Zod pins, and a nested schema inside `pipe()` in Valibot — a schema is a valid pipe item, so Valibot needs no wrapper either. All five adapters participate on both rows, and the delegated schema is the `primitiveBuiltin` chain each adapter already builds, so each row pairs with `primitive-builtin/valid` over the identical fixture and the difference is the delegation layer alone. Measured in a three-scenario smoke selection under the old one-process-per-adapter runner, so carrying the position artefact and quotable only as an order of magnitude: the layer costs Valchecker 47.7 → 58.4 ns, Zod 3 63.2 → 93.3 ns, Zod 4 92.2 → 116.2 ns, Zod 4 jitless 93.4 → 116.6 ns, and Valibot 94.2 → 144.2 ns. The failure row is the inner schema's issue travelling back out through that layer, and it separates the libraries much more sharply than the valid one: Valchecker 118.5 ns and Valibot 182.3 ns against Zod 3's 552.3 ns and Zod 4's roughly 7.6–7.9 µs, where `ZodPipe` constructs a full error on every call. Both Zod 4 numbers exceeded the 5% stability target in that run, so re-measure them before quoting a ratio.

### Declared step coverage

Every scenario declares `steps`, the Valchecker public step methods its Valchecker schema calls, and the field is carried into each scenario's `raw.json` catalog entry. This makes step coverage of the suite a fact tooling can read rather than something inferred from scenario ids. Declaring it is mandatory: a scenario that omits it fails to build.

`pnpm bench:coverage` (`scripts/check-benchmark-coverage.ts`, part of `pnpm test:quality` and therefore of `pnpm verify`) turns that field into a gate. It reads the declared step names from each built-in step's `Meta.Name` and the covered set from the scenario catalog — not from adapter source, which a rename or a respelling would carry into silence — and fails when a declared step is named by no scenario, and equally when a scenario's `steps` names something that is not a declared step, since a typo would otherwise report coverage for a method that does not exist. It needs neither a build nor `benchmarks/node_modules`: the module graph it reaches — the catalog, `define.mjs`, `fixtures.mjs`, and `capabilities.mjs` — contains no bare specifier.

A scenario only counts as covering a step if at least one **competitor** participates in it. A scenario every competitor is capability-gated out of ranks Valchecker against nothing, which is the same situation as a step no scenario names, so such a step belongs in the allowlist rather than in the covered count. The gate decides participation with the runner's own `supportFor` over the declarations in `src/capabilities.mjs`, so it cannot disagree with what the runner would really skip, and it fails on a `requiredFeatures` entry no adapter declares — a misspelled feature name would otherwise gate every competitor out and turn the scenario into a Valchecker-only row that still reported coverage.

The gate's allowlist is for steps no pinned competitor can express, so no comparison exists to build, and each entry carries the verified reason. It currently holds four: `as`, which is a compile-time cast whose implementation is `noop` and installs no runtime step at all; `isIncludingKey` and `isIncludingValue`, because no competitor has a Map membership check — Zod 3 exports no `includes`, and Zod 4's and Valibot's throw on a Map because they reach `Array.prototype.includes` — so the only competitor spelling is a hand-rolled `refine` closure, which for `isIncludingValue` would also have to reimplement the step's SameValueZero match; and `json`, whose scenarios exist but gate out all four competitors for the reason under `JSON string validation` below. `toSafeNumber` was on this list until 2026-07-28 on a reason that turned out to be false, and is now measured. The list cannot rot in either direction: an entry for a step some scenario now compares against a competitor fails, so it shrinks as the suite grows, and an entry for a step that no longer exists fails too.

The list describes the schema the scenario measures, so it names what that schema actually calls and nothing else. Two consequences are easy to get wrong in both directions: the `[v.string()]` optional-field shorthand is `object`'s own optional handling and not a `union` branch, while `v.union(['px', 'em', 'rem'])` really does resolve its raw branches through `literal`.

`pnpm --dir benchmarks verify` checks the declaration rather than taking it on trust. `src/step-audit.mjs` points the Valchecker adapter at `src/step-recorder.mjs` — an instance whose step methods record their own names and unwrap every argument before forwarding it, so the library never sees a proxy and builds exactly what it would have built — then drives all 241 scenarios through their build keys with each scenario's own context, and diffs the observed calls against `steps`. The step-name set comes from the loaded build itself, as the own property names of the prototype every schema shares, so the audit cannot go stale against a renamed or added step. A missing name is an error, because the impact gate would not select that scenario when the step changes; an extra one is listed and allowed, which is how the `templateLiteral` case above passes: the branches resolve through the `literal` plugin without `v.literal` ever being called, so the declaration is right and the observation is short.

One scenario family per module under `src/scenarios/`, listed in `src/scenarios/registry.mjs`; fixtures used by a single family live with it, and the rest are in `src/fixtures.mjs`.

### Comparability across runs

Existing scenario ids, fixtures, schema shapes, and tiers are treated as stable. A new framing is added under a new id rather than by editing an old scenario, and `smoke` stays small because every pull request runs it.

That stability is **per scenario**. Group-level aggregates — including the geometric means the performance-impact verdict uses — are not comparable across versions that changed the scenario set, because the group composition itself changed.

### Adapter capabilities

An adapter declares what it is, so the harness never has to infer behaviour from its name:

- `issuePolicies` — which explicit diagnostic policies it can express (`first`, `all`);
- `features` — schema kinds it supports that at least one other adapter lacks (see below);
- `generatedCode` — whether it compiles schemas into generated code, which drives the two report perspectives above.

`issuePolicies` and `features` are declared in `src/capabilities.mjs` and the adapters take theirs from it, rather than each adapter stating its own list. Two readers need these facts and only one of them can load a library: the coverage gate has to know which adapters can participate in a scenario without importing zod or valibot. It is one declaration and not a duplicate, because the Zod adapters still detect every capability from the live module and refuse to load when detection disagrees with the declaration — which is where a pin bump would otherwise make the file quietly wrong. `generatedCode` stays with the adapter, since it is read from the live `z.config()`.

### Capability gating

Some scenarios need a schema kind that not every library ships. A scenario may declare required features, an adapter declares the features it supports, and unsupported combinations are skipped with a stated reason instead of being approximated:

- `template literal` — Valchecker and both Zod 4 adapters; Zod 3 and Valibot have no equivalent schema;
- `file` — Valchecker, both Zod 4 adapters, and Valibot; Zod 3 has no file schema;
- `combined IPv4/IPv6` — Valchecker, Zod 3, and Valibot; Zod 4 ships `z.ipv4()` and `z.ipv6()` separately and has no schema accepting either, which is what `isIp()` does by default;
- `base64url`, `JWT` — Valchecker and every Zod adapter; Valibot has neither action;
- `hex`, `MAC address` — Valchecker, both Zod 4 adapters, and Valibot; Zod 3 has neither string method;
- `hostname` — Valchecker and both Zod 4 adapters only;
- `boolean string parsing` — Valchecker and both Zod 4 adapters, through `z.stringbool()`. Zod 3 has none, and `z.coerce.boolean()` is not one: it is `Boolean()` truthiness and maps `'false'` to `true`. Valibot has none either, and unlike the number case below there is no native function to delegate to, so a mapping table written in the adapter would be a stand-in for a built-in;
- `bigint coercion` — Valchecker and every Zod adapter. Valibot's only spelling, `v.transform(BigInt)`, throws a `SyntaxError` out of `safeParse` on an unparseable string instead of reporting an issue, so the invalid scenario cannot be expressed there at all;
- `one-sided trim` — Valchecker and Valibot; neither Zod pin has `trimStart`/`trimEnd`;
- `Unicode normalization` — Valchecker, both Zod 4 adapters, and Valibot; Zod 3 has no `normalize()`;
- `undefined rejection` — Valchecker, both Zod 4 adapters, and Valibot, through `z.unknown().nonoptional()` and `v.nonOptional()`. Zod 3 has no `nonoptional`, and a `.refine(value => value !== undefined)` closure would be a stand-in for the built-in the other three ship;
- `null rejection`, `nullish rejection` — Valchecker and Valibot only. Neither Zod pin has a `nonnullable` or a non-nullish schema, as a method or a top-level function, so `isNonNull()` and `isNonNullish()` have no Zod opponent;
- `Blob` — Valchecker and Valibot. Neither Zod pin has a blob schema. This is deliberately not the `file` feature: Zod 4 ships `z.file()` and declares `file`, so a scenario gated that way would demand a build key Zod 4 cannot provide. Both implementations are `value instanceof Blob`, so the accepted sets match exactly, including a `File` — every `File` is a `Blob` — and excluding an `ArrayBuffer`;
- `JSON conversion failure reporting` — Valchecker and Valibot. `toJSONValue()`/`toJSONString()` and Valibot's `parseJson()`/`stringifyJson()` report a failed conversion as an issue. Zod has no transformation action for either direction, and executed on both pins a `transform` callback that throws lets the error escape `safeParse`, so the two invalid `serialization/*` scenarios cannot be expressed there. The valid scenarios are not gated: `.transform(text => JSON.parse(text))` is a fair spelling of the same native call;
- `JSON string validation` — Valchecker only. Zod 3 and Valibot have nothing comparable, and Zod 4's `z.json()` is not the same schema: it is a recursive JSON-*value* schema that accepts anything JSON can represent, so it accepts the string `'not json'`, accepts `42`, `null`, arrays, and plain objects, and rejects a `Date`. `v.string().json()` requires a string and checks that `JSON.parse` accepts it, so pairing the two would compare a recursive structural walk against one native parse call.

`instance` needs no gate: `z.instanceof(C)` in both Zod pins and `v.instance(C)` in Valibot are built-ins, so nothing there is a user closure standing in for one. Zod 3 builds its version on `z.custom()` and reports a `custom` issue where the others report a dedicated one, but the accepted set is the same `instanceof` test, so the scope stays `equivalent`.

A hand-rolled stand-in would compare different work, so an adapter without the capability is skipped rather than substituted. A feature name exists only for a capability at least one adapter genuinely lacks, so every entry in an adapter's feature list is a real claim, and a scenario whose build key is missing from an adapter that claims support fails the run instead of quietly shrinking the comparison.

Within a supported family the spelling still follows each library's own idiom, detected rather than hardcoded: Zod 3 uses `z.string().email()` while Zod 4 uses the top-level `z.email()`, and both are exercised through the same scenario. Where a library offers several granularities of one format, the adapter picks the one matching the Valchecker step: Valibot's `isoTime()` accepts only `HH:MM`, so the ISO-time scenario uses `isoTimeSecond()`, which requires the seconds `isIsoTime()` also requires.

### Compatible-subset scopes

Where a family exists everywhere but the semantics differ in detail, the scenario declares `compatible-subset` instead of pretending equivalence:

- string formats and template literals — each library ships its own accepted set, so the fixtures are values every implementation agrees on, checked against every participating adapter before the fixture is committed. The differences are real and often large: Valibot's `isoDate()` performs no calendar check and accepts `2024-02-30`, Zod accepts a cuid2 that starts with a digit, Zod 3's `base64url()` accepts padding, Valibot's `hexadecimal()` accepts a `0x` prefix, Zod 4's `mac()` rejects hyphen separators, and only Valchecker's `isUrl()` restricts the scheme;
- `string-format/emoji-*` against `string-format/emoji-registered-*` — the only pair in the suite where the two rows differ on the *Valchecker* side. `emoji-*` measures `isEmoji()`, whose accepted set is the UTS #51 emoji sequence grammar: every structurally valid emoji sequence, registered or not. `emoji-registered-*` measures `isEmoji({ registered: true })`, whose accepted set is `\p{RGI_Emoji}` minus bare components — the sequences Unicode registers as ones vendors are expected to render. The registered set is a strict subset, and what it costs depends on the input, because a property-of-strings matcher enumerates every longer registered sequence its input is a prefix of: 113× the default on a bare `😀`, 43× on the flag `🇹🇼`, and 1.3× on the ZWJ family `👨‍👩‍👧‍👦`, which is already specific enough to match one alternative and stop. Read the pair's ratio against the fixtures the two rows actually use rather than as a single multiplier. The competitor schema is deliberately identical in both rows: neither Zod pin nor Valibot has a registered-set mode, so their cells are one schema measured against two Valchecker semantics, and the pair should be read as what each semantics costs rather than as two independent comparisons. Neither competitor set matches either Valchecker set — Zod's `^(\p{Extended_Pictographic}|\p{Emoji_Component})+$` accepts `123`, `1`, `#`, `*`, a lone ZWJ, and `❤` without VS16, while Valibot's grammar accepts a lone skin-tone modifier and a combining keycap on any base — so the fixtures are the two values all five agree on;
- open records — Valchecker maintains a transformed-key uniqueness map that Zod and Valibot do not;
- tuples — Valchecker's rest region is a nested array schema rather than an in-place loop;
- string-to-date conversion — `z.coerce.date()` performs no input type check, so the Zod cells are a lower bound;
- date bounds — `isAfter`/`isBefore` are strict while `z.date().min/max` and `minValue`/`maxValue` are inclusive, so the accepted sets differ at the bound itself. Note also that this scenario largely measures the cost of attaching any refinement: the competitors lose their bare-schema fast path as soon as one is present;
- finite membership — the benchmark measures Valchecker's `string().isOneOf()` chain against a single `enum`/`picklist` dispatch. Valchecker's one-step `union([...])` shorthand exists but is slower here and reports one issue per member, so the chain is both the idiomatic and the fairer comparison;
- `flat-object-builtin` — the same validation as `flat-object`, with the Valchecker side spelled using the format validator that shipped after the original scenario was written. Competitor schemas are unchanged, because they already used a built-in pattern action;
- `primitive-builtin` — the same for `primitive`: its Valchecker side ends in a `check()` closure while Zod and Valibot were always spelled with a built-in pattern action, so the original scenario compares a user closure against a built-in on one side only. The new key swaps in `isMatching` and changes nothing else, including keeping the pattern an inline literal, so the two Valchecker spellings differ in nothing but the final step. `primitive/*` is left exactly as it was, so the closure cost and the built-in cost are both readable;
- `constraint/multiple-of` — all four accept integer multiples alike, but Valchecker, Zod 3, and Zod 4 apply a floating-point tolerance that accepts `0.3` as a multiple of `0.1` while Valibot's `multipleOf()` is exact remainder arithmetic and rejects it, and rejects `1` as a multiple of `0.1` too. The divisor is 5, where all four agree;
- `constraint/finite` — the composed schemas accept and reject the same values but not in the same place: `z.number()` in Zod 4 already excludes non-finite input, so its `finite()` is redundant and the Zod 4 failure cell measures a base type check. Valchecker's `number()` is a bare `typeof` check, so `isFinite()` is what rejects;
- `constraint/safe-integer` — Zod 3's `.safe()` bounds the value to the safe-integer range without requiring an integer, so it accepts non-integers that `isSafeInteger()`, Zod 4's `.safe()`, and `safeInteger()` reject. Both fixtures are integers;
- `constraint/nan` — Valchecker validates the number and then `NaN`-ness, which is possible only because `v.number()` admits `NaN`; Zod and Valibot dispatch a dedicated `nan()` schema instead;
- `constraint/empty` — neither Zod version has an `.empty()` action, so the Zod side is `.length(0)`: the same `length === 0` predicate `isEmpty()` applies, and still a built-in rather than a refinement closure;
- `constraint/equal-to` — as with finite membership, Valchecker validates the string and then equality while the competitors dispatch a single `literal()`. Valchecker's own one-step `literal()` exists, but the scenario is there to measure `isEqualTo`;
- `coercion/loose-number-*` — the three accepted sets differ and the fixtures sit in the intersection: `looseNumber()` follows TypeScript's `${number}` grammar and rejects `''`, `'NaN'`, `'Infinity'`, booleans, and `null`; `z.coerce.number()` type-checks nothing and accepts `''`, booleans, and `null`, with Zod 3 accepting `'Infinity'` as well and both pins rejecting `'NaN'`; Valibot accepts strings only. Valibot's cells also carry a cost the others do not. It has no coercing schema, so `v.pipe(v.string(), v.transform(Number), v.number())` is not a stand-in for a Valibot built-in — there is none to stand in for, and this is what a Valibot user writes — but it pays for a user callback, and for the trailing `v.number()` that rejects the `NaN` the other two reject inside the coercion itself. Reporting it that way is more informative than excluding Valibot, which would say "Valibot cannot coerce"; the precedent is `z.coerce.date()` being included as a lower bound rather than dropped;
- `coercion/loose-boolean-*` — `z.stringbool()` also accepts `'1'`, `'yes'`, and `'on'`, lowercases its input, and rejects the real booleans `looseBoolean()` accepts. The fixtures are lowercase strings both agree on;
- `coercion/loose-bigint-*` — `z.coerce.bigint()` type-checks nothing and accepts `''` and numbers, which `looseBigint()` rejects;
- `coercion/to-*` — the accepted sets and outputs agree exactly, but Valchecker converts with a built-in step while Zod and Valibot wrap the same native function in a user callback, which is the only conversion spelling either has that keeps an input type check. `coercion/to-boolean-valid` is also the scenario to read for what `toBoolean` is: it maps the string `'false'` to `true`, because it is native truthiness;
- `coercion/to-safe-number-*` — the accepted sets, outputs, and issue counts agree exactly, established by execution over the boundary values and 500,000 random bigints, but the competitors reach the decision through a user callback piped into a second schema, and they apply the range guard to the converted number where Valchecker applies it to the bigint;
- `optional-heavy/sparse` and `optional-heavy/sparse-rotating` — the libraries do not do the same amount of work on a sparse input, and that is what these two rows measure. Valchecker's `object` materializes each declared-but-absent optional key as an own enumerable property valued `undefined`, so the two-key input produces a sixteen-key output; all four competitors omit the fourteen absent keys and return a two-key object. Fourteen extra property writes are the difference. It cannot be expressed as an asserted output, because the outputs are genuinely different values and a scenario asserts one expectation for every adapter — and until 2026-07-28 it was not even visible, because the harness canonicalized outputs through `JSON.stringify`, which drops a property valued `undefined`, so a sixteen-key and a two-key object compared equal. `optional-heavy/full` stays `equivalent`: with every field present there is nothing to materialize;
- `coercion/mapped-boolean-*` — as with `constraint/equal-to`, Valchecker validates the string and then maps it while Zod dispatches one schema that does both. The Zod side is configured with the same two value lists and with `case: 'sensitive'`, because `toMappedBoolean()` compares with SameValueZero and normalizes nothing while `stringbool()` lowercases by default;
- `variant/*` — two differences, both established by execution. Valchecker requires the discriminator to be an **own** property, while both Zods read `input[discriminator]` and Valibot tests `key in input`, so an inherited tag is accepted there and rejected here; and Valchecker accepts any string, number, or symbol property key as a variant key, where Zod needs each branch to expose a literal value at the discriminator and Valibot needs the key in each option's entries. The fixtures are plain objects with their own string tag. A non-object input needs no gate — all four reject it before any discriminator work — but it measures a container check rather than dispatch, so it has no scenario;
- `fallback/*` — the recoverable sets differ in both directions. Valchecker recovers `validation` and `operation` failures and leaves `internal` ones fatal, a three-category taxonomy neither competitor has. Zod's `.catch()` and Valibot's `fallback()` recover the issues their wrapped schema reports, but a callback that throws is not one of them: `z.number().refine(throws).catch(() => 0)` and the Valibot equivalent let the `Error` escape `safeParse`, while `v.number().check(throws).fallback(() => 0)` turns it into an operation issue and recovers it. Both fixtures sit where all four agree;
- `collection-transform/*` — Valchecker spells all thirteen as built-in steps, Valibot three of them, and Zod none, so most cells are a `transform` closure around the same native call. Two steps also do more than the closure does and are declared rather than equalized: `toMappedKeys()` maintains a mapped-key uniqueness map with per-key provenance and rejects a SameValueZero collision, where `new Map(…)` keeps the last entry — the same difference `openRecord` carries — and `toMapped()`, `toFiltered()`, and `toSorted()` wrap the callback so a throw becomes a `*:callback_failed` operation issue, which costs the wrapper on these fixtures and cannot be compared on the failure itself. Reimplementing either in an adapter closure would be a hand-rolled stand-in for a built-in, which the suite refuses to build;
- `serialization/*` — `toJSONString()` preflights the value before serializing it, so the valid path traverses twice and buys the structured-issue contract described above; `toJSONValue()` differs only by built-in against closure.
- `async/wrapper-valid` — the accepted set and the output are identical, but the two sides reach the promise from opposite places: a step inside the schema (`toAsync()`) against a second entry point on the call (`safeParseAsync`). Neither library has the other's spelling, so the row is one decision reached two ways rather than one API measured twice.

`union-large/*`, `recursion/*`, `nullish/*`, `schema-kind/*`, `standard-schema/*`, and the three `async/*` callback rows are `equivalent` by contrast: accepted sets, outputs, and failure positions agree exactly on every participating adapter. For `standard-schema/*` that follows from the reused build keys plus a specified entry-point contract; what differs between the rows is how much each implementation does to satisfy it, which is the measurement.

### Diagnostic policy comparability

Failure throughput is meaningful only when the amount of diagnostic work is explicit:

- `library-default` scenarios show the real default behavior of each product, but they are not assumed to collect the same number of issues.
- `first` scenarios require exactly one issue before timing. Valchecker and Valibot participate; Zod is omitted because it does not expose an equivalent whole-parse abort option.
- `all` scenarios declare and require an exact top-level issue count before timing. Valchecker uses `collectAllIssues: true`, Valibot uses its exhaustive default, and Zod uses its normal exhaustive structural behavior.
- unsupported adapters are listed in the report with a reason and are not ranked.

Intersection comparisons use only compatible synchronous object outputs and ordinary branch validation. Merge-conflict behavior and asynchronous scheduling *inside a structure* — ordering, short-circuiting, and continuation after a reached thenable — remain excluded because those semantics differ across libraries. The asynchronous callback path itself is measured, by `async/*`.

An asynchronous cell is measured by awaiting the operation inside the timed loop, one operation at a time, so a sample is the latency of a complete validation including the microtask turn an asynchronous caller cannot avoid. Everything else about it is the synchronous path: the same profile, the same warmup, the same stopping rule, and the same reported fields. The harness declares rather than detects which it is — a Valchecker maybe-async pipeline returns a promise for some inputs and a plain result for others, so a probe would classify a cell by its fixture — and then checks the declaration against reality in both directions: a promise from a scenario declared synchronous and a synchronous result from one declared asynchronous are both hard errors, as is handing either measurement function the other's kind of operation. `pnpm --dir benchmarks test` covers both loops, including a parity check that drives the synchronous and asynchronous sampling loops with the same scripted samples and requires identical results.

In addition to fixed-input ceilings, representative warm scenarios rotate through pools of same-shape objects with different identities and values. These rotating-input cases reduce the risk of keeping an optimization that only benefits one frozen object instance.

Each (adapter, scenario) cell runs in a dedicated Node.js process, one at a time, and the adapters of one scenario are measured back to back so that a drift across the run moves all of them together. Library order is shuffled from a recorded seed. Results include every sample, median and mean throughput, median nanoseconds per operation, relative margin of error, package versions, Node.js version, CPU, operating system, runner image, commit metadata, benchmark group, issue policy, comparison scope, skipped-adapter reasons, the measurement isolation, and which shard on which machine produced each scenario.

## Interpretation

Do not combine construction, cold execution, warmed success, and the different failure-policy groups into one ranking. Compare libraries only within the same scenario, benchmark group, and issue policy. Asynchronous cells sit in their own groups for the same reason, and every scenario section in the report states its `Execution` mode and `Entry` point.

Check `isolation` before comparing two numbers from different runs. A `cell`-isolated number was measured with nothing else in its process; an `adapter`-isolated one carries the position artefact described under [measurement isolation](#measurement-isolation) and is not a measurement of the same thing. `compare` refuses to pair the two, and so should a reader.

Results with relative margin of error above 5% are marked unstable in generated reports and should be rerun before drawing conclusions. `library-default` failure results include each library’s own issue construction and traversal behavior. Use explicit `first` or `all` scenarios when the diagnostic workload must be equivalent.

Zod 4’s generated object fast path can exchange expensive schema creation or first execution for exceptional warmed throughput. Fixed-input warmed scenarios therefore represent a steady-state ceiling, not cold-start latency or whole-application performance.
