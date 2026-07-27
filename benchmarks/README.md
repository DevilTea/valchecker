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

Use the repository’s **Performance Comparison** workflow to run a controlled cross-library comparison on `ubuntu-24.04` and Node.js 24. The workflow accepts:

- `profile`: `smoke`, `standard`, or `full`
- `adapters`: a comma-separated subset of `valchecker,zod3,zod4,zod4-jitless,valibot`
- `seed`: an optional deterministic execution-order seed

A blank seed is replaced with a value derived from the commit and workflow run. The job first verifies every full-tier scenario across every adapter, then runs the requested sample profile. Use `smoke` to validate the workflow and report pipeline; use `standard` or `full` for published comparisons.

Each completed run publishes:

- `raw.json`: every sample, scenario semantic, skipped-adapter reason, and environment field; the source of truth

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

The **Performance Impact** workflow measures the impact of a change and runs two ways:

- **Pull request (automatic gate).** Pull requests that modify runtime source or benchmark code compare the pull request base (`before`) against the head (`after`) with the standard profile, Valchecker only, all scenarios, five paired repetitions, and `fail_on_regression` enabled. Five rather than three because the gate classifies a scenario only when its paired-ratio interval is at most 5% wide, and three repetitions leave most scenarios unclassified and therefore unwatched.
- **Manual dispatch.** `workflow_dispatch` compares two arbitrary revisions on demand and lets you choose exactly what to measure:
  - `before`: baseline git ref (branch, tag, or SHA); required
  - `after`: candidate git ref; defaults to the dispatched ref
  - `adapters`: competitor adapters to show alongside Valchecker (for example `valibot,zod3`); empty measures Valchecker only
  - `scenarios`: scenario ids or group names to run; empty runs every scenario for the profile
  - `profile`: `smoke`, `standard`, or `full`
  - `runs`: paired repetitions for the impact comparison (minimum three, default five)
  - `fail_on_regression`: fail the job when the impact verdict is a regression

The comparison scripts always come from the checked-out ref (the pull request merge ref, or the dispatched ref), so scenario selection and the compare tooling stay fixed; `before` and `after` are only two Valchecker builds the fixed scripts point at via `VALCHECKER_DIST_URL`.

Valchecker before/after uses paired independent process runs. Each candidate result is divided by the adjacent base result from the same repetition, and base/candidate order alternates to reduce thermal, scheduler, and runner drift. The reported change is the median of the paired ratios. Paired RME uses a 95% Student’s t interval, which is intentionally conservative for the small sample; separate base/candidate medians, cross-run variation, and within-process sample RME remain in the JSON evidence.

The impact report classifies a scenario only when its paired-ratio RME is at or below 5%:

- less than 3%: normally noise
- 3–5%: requires corroboration from adjacent scenarios or independent workflow runs
- at least 5%: meaningful scenario-level change
- at least 10% regression: severe scenario regression
- at least 5% geometric-mean regression across two or more stable scenarios in a benchmark group: severe group regression

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

`standard` and `full` sample each measurement until its 95% confidence interval is within 0.75% of the mean, between five samples and the profile's cap, so measurements in one run rest on different numbers of samples. The report's `Samples` column records how many, and `†` marks a measurement whose interval never reached the target. A measurement that stopped early reports the interval it had at that moment, which is at most the target and therefore understates the spread a longer run would find. `smoke` sets no target and always takes three samples.

Raw output defaults to `benchmarks/results/raw.json`. Use `--output <path>`, `--seed <value>`, or `--adapters valchecker,zod4` to customize a run.

Restrict a run to specific scenarios with `--scenarios`, accepting a comma-separated list of scenario ids (for example `primitive/valid`) or benchmark-group names (for example `warm/failure/first`); the union of matches runs and every other scenario is skipped. Explicit selection ignores the sampling tier, so a named scenario always runs regardless of `--mode`, and an unknown id or group is a hard error.

```bash
pnpm --dir benchmarks bench --mode standard --adapters valchecker,valibot \
  --scenarios primitive/valid,warm/failure/first
```

## Methodology

Every adapter implements the same schema families and fixtures where the libraries expose comparable behavior. Before timing a scenario, the runner verifies the expected success/failure state, transformed output where relevant, and exact issue-count requirements for diagnostic-policy scenarios. CI executes every full-tier supported scenario once across all adapters and records unsupported adapter/scenario combinations instead of assigning synthetic behavior.

The suite separates:

1. complete schema construction, including all child schemas,
2. complete schema construction plus first validation (cold),
3. warmed successful validation,
4. warmed failure under each library’s default diagnostics,
5. warmed failure that stops after the first issue, and
6. warmed failure that exhaustively collects issues.

Scenarios cover primitive pipelines, flat and nested objects, strict and loose object behavior, arrays, Sets, Maps, ordered unions, discriminated unions dispatched by tag, recursive schemas, failure recovery, nullish narrowing, compatible synchronous intersections, transformation pipelines, optional-heavy configuration objects, open records, tuples with a rest region, template literals, date validation, string-to-date conversion, date bounds, files, a file MIME-type check, every built-in string-format validator, finite membership, every built-in numeric, string, equality, and collection-size constraint validator, the coercing initial schemas with their conversion-step counterparts, the string case and shape transformations, the remaining initial schemas, the collection and Map reshaping transformations, JSON parsing and serialization, asynchronous validation, and the Standard Schema V1 entry point. Full mode adds 1,000-element array and record cases plus the secondary and failure variants of the newer families.

The string-format scenarios cover one built-in format validator each: `isEmail`, `isUuid`, `isIsoDateTime`, `isUrl`, `isIp`, `isIsoDate`, `isIsoTime`, `isEmoji`, `isBase64`, `isBase64Url`, `isNanoid`, `isUlid`, `isCuid2`, `isJwt`, `isHex`, `isMac`, and `isHostname`. `isMimeType` reads a value's own `type` string rather than validating a string, so it is measured over a `File` as `file-mime-type/*` instead.

The `constraint/*` scenarios do the same for the constraint validators, one per scenario pair: `isAtMost`, `isGreaterThan`, `isLessThan`, `isMultipleOf`, `isFinite`, `isSafeInteger`, `isNaN`, `isStartingWith`, `isEndingWith`, `isIncluding`, `isLengthExactly`, `isNotEmpty`, `isEmpty`, `isEqualTo`, `isSizeAtLeast`, `isSizeAtMost`, and `isSizeExactly`. Every one of them exists in all four pinned libraries — Zod spells them as schema methods, Valibot as pipe actions — so nothing in the family is capability-gated. Each is carried by the smallest schema that can hold it, and each invalid fixture is a value of the right type sitting just outside the bound under test rather than a wrong-typed value that would fail earlier. The numeric bound fixtures are all ordinary finite numbers, because the four base number schemas disagree about non-finite input — `v.number()` admits `NaN` and `±Infinity`, Zod 3's rejects `NaN`, Zod 4's rejects both, and Valibot's rejects `NaN` — and that difference belongs to `constraint/finite` and `constraint/nan` rather than to a bound.

`constraint/stack-*` is the deliberately separate case: five constraints on one string field, which is what a real schema does. The single-constraint scenarios measure the cheapest possible refinement — already past the point where the competitors lose the bare-schema fast path noted under date bounds below — while the stack is what shows how the cost grows from there.

`coercion/*` covers reading a value out of a query string, a form body, or an environment variable: the coercing initial schemas `looseNumber`, `looseBoolean`, and `looseBigint`, and the conversion steps `toNumber`, `toBoolean`, `toBigint`, `toString`, and `toMappedBoolean`. No two libraries accept the same set here, so every fixture was executed through each participating adapter and kept only where accept, reject, and transformed output all agreed; the differences are recorded under compatible-subset scopes below. Two consequences are worth stating up front. `z.coerce.*` performs no input type check at all — `z.coerce.number()` accepts `true` and `null`, which `looseNumber()` rejects — so it is the comparison for the loose schemas but not for the conversion steps, whose Valchecker chains keep a type check the competitors can only keep by wrapping the same native function in a `transform` callback. And most conversions cannot fail: `Number('abc')` is `NaN` rather than a throw, so `toNumber`, `toBoolean`, and `toString` fail only where their leading type check fails. `primitive/invalid-type` and `transform/invalid-type` already measure `v.string()` rejecting a non-string, so the family adds exactly one type-check failure, `coercion/to-string-invalid-type`, for the `v.number()` check no existing scenario measures.

`toSafeNumber` is deliberately absent from the cross-library suite: it converts a bigint to a number only inside the safe integer range, and none of the three pinned libraries has an equivalent, so its cost is measured by the focused benchmark at `packages/internal/src/steps/toSafeNumber/toSafeNumber.bench.ts` instead of against an invented opponent.

`variant/*` and `union-large/*` are one branch set measured two ways. Every participant ships a tagged union — `variant()` here, `z.discriminatedUnion()` in both Zods, `v.variant()` in Valibot — and the suite measured none of them before: `union/*` has five branches, which cannot separate a lookup from a linear scan. The two build keys share twenty tagged object branches, built by every adapter from the same ordered list in `fixtures.mjs`, so `union-large/last` and `variant/late` are the same branches reached two ways. Twenty is a realistic tagged-event union and large enough for the dispatch difference to exceed the 5% the harness needs to call an ordering reproducible; every branch carries the same `{ type, id, size, enabled }` payload so that an early hit and a late hit differ in dispatch and nothing else. Read from the four sources rather than assumed: Valchecker keeps a Map of branch executors, Zod 3 an `optionsMap`, and Zod 4 a cached discriminator Map, so all three dispatch by lookup, while Valibot's `variant` runs each option's discriminator schema in order until one matches. `union-large/first`, `/middle`, and `/last` measure the same twenty branches without a discriminator, where branch order is normative for Valchecker and `/last` is therefore the worst case everywhere.

`recursion/*` and `construct/recursive-tree` are the suite's only recursive schemas: `generic(factory)` against `z.lazy()` and `v.lazy()`, which all four libraries ship. The fixture is a complete binary tree of depth five — 63 nodes over six levels — which keeps per-operation cost near the existing `nested-object` and 100-element collection scenarios while making the recursion rather than one object the subject. `children` is a required array and leaves carry an empty one, because optional-field semantics belong to `optional-heavy/*`. Each adapter defines the cycle inside its build function so construction rebuilds it. The four resolve the cycle differently and the scenarios are meant to show it: Valchecker's `generic(factory)`, Zod 3's `ZodLazy`, and Valibot's `lazy` invoke the getter on every execution, while Zod 4 caches the resolved inner schema. Resolving per execution is also why the Valchecker pipeline is maybe-async here even though every step completes synchronously.

`fallback/*` measures both sides of recovery: `fallback/unused` is the production-common path where a valid input never invokes the callback, and `fallback/recovers` is the path that builds a failure and then replaces it. All three libraries take a getter callback and every adapter passes one, so no side of the comparison is a user closure standing in for a built-in.

`nullish/*` measures `isDefined()`, `isNonNull()`, and `isNonNullish()` on `unknown()`. Their opponents are `nonOptional`/`nonNullable`/`nonNullish`, not `optional`/`nullable`/`nullish`: the wrappers accept what these steps reject, so measuring one against the other would compare opposite decisions. The suite's existing coverage is the accepting direction only, and it is the `[v.string()]` shorthand inside `optional-heavy/*`, which is `object`'s own optional handling rather than a `union` branch.

`schema-kind/*` covers the initial schemas nothing else measured — `any`, `unknown`, `never`, `null`, `undefined`, `bigint`, `symbol`, `instance`, and `blob` — plus `json`, grouped with them as the last unmeasured schema kind even though it is a step on a string. These are the cheapest schemas every library ships, so the family exists for two reference numbers and one failure path rather than for the ranking inside any single row. `any-valid` and `unknown-valid` accept every value and run no check, so they time each library's per-call overhead with nothing validated: the floor every other scenario's number sits on top of. `never-invalid` rejects every value and validates nothing, which makes it the matching floor for the failure path — error construction with no validation in front of it — and it is the only scenario in the suite outside the explicit issue-policy families that declares an issue count, because a row claiming to be pure error construction has to hold the diagnostic work fixed; all four libraries report exactly one issue there. `json-invalid` adds the throw `JSON.parse` raises and the `catch` that turns it into an issue, a failure path nothing else in the suite runs.

Read a floor as a floor for its position in the run. Measured on its own, `unknown-valid` reports the same number `any-valid` reports when `any-valid` runs first; put `primitive/valid` ahead of both and they report roughly twice that, and report it identically, because they do identical work. The effect applies to every scenario and only becomes visible where there is no validation work to hide it, and it moves ratios as well as absolute numbers, so compare a floor only with another floor from the same position in the same scenario selection.

The family adds no failure counterpart for `null`, `undefined`, `bigint`, `symbol`, `instance`, or `blob`: each is one comparison plus one issue, which `primitive/invalid-type` already measures. `any` and `unknown` cannot fail and `never` cannot succeed, so neither gets an invented scenario in the direction it does not have.

`string-shape/*` measures one string transformation each — `toUppercase`, `toTrimmedStart`, `toTrimmedEnd`, and `toNormalized` — where `transform/*` measures three of them together with a closure. Every participant spells its transformation as a built-in and all of them produce identical output, so these scenarios are `equivalent`. The family has no failure scenario: each step is one `String.prototype` call that cannot fail, and its only failure path is the same `v.string()` check the two scenarios named above already measure.

`collection-transform/*` is the mirror image of `primitive-builtin`. There the Valchecker side of an older scenario ended in a `check()` closure while the competitors used a built-in pattern action, which flattered them; here the built-in is Valchecker's. Zod has no transformation action for any of `toArray`, `toSize`, `toKeys`, `toValues`, `toEntries`, `toMappedKeys`, `toMappedValues`, `toMapped`, `toFiltered`, `toSorted`, `toSliced`, `toSplit`, or `toLength`, so every Zod cell is `.transform()` around the same native call the step delegates to. That is a real difference in what the libraries provide rather than a benchmark defect, so it is measured, and every scenario declares `compatible-subset` so the row cannot be read as equivalence. Valibot is not uniformly on the closure side: `mapItems`, `filterItems`, and `sortItems` are built-in transformation actions that hand the callback straight to `Array.prototype.map`/`filter`/`sort`, so three rows compare a built-in against a built-in on that adapter and against a closure on both Zods. All the callbacks, the slice range, and the separator come from one shared fixture, so the four adapters call the same function objects.

Ten items everywhere, matching `array/10-valid`: a 1,000-element `toSorted` would measure `Array.prototype.sort` rather than the library. Each step then sits on the smallest schema that can carry it, as in `constraint/*` — a Set for `toArray`/`toSize`, a Map for the five Map steps, a ten-number array for the four array steps, a string for `toSplit` and `toLength`.

**Do not read the rows of `collection-transform/*` against each other.** Sharing a base schema makes them look comparable and they are not. Measured with this suite's runner, the first array-carried scenario in a process reports 83.5 ns on Valchecker while an identical schema measured after three other array pipelines reports 261.9 ns — 3.1× worse for the same work. Zod 4 shows the same effect from 132.7 to 285.2 ns, and Valibot does not show it at all (275.5 to 272.1 ns), because `safeParse` gives it no per-schema call site to lose. This is the position effect `schema-kind/*` recorded for the per-call floors, and it reaches further than it looks there: it is not confined to scenarios with no validation work, and it keys on the carrier rather than on position in the process — a Set and two Map scenarios in front of `collection-transform/to-mapped-valid` leave it fast, one more array pipeline does not. So the ordering of rows within the family is an artifact of declaration order, and the first row of each carrier group is the most favorable position Valchecker and Zod 4 can be measured in rather than a typical one. What each row supports is the comparison inside it at the position the run gives it.

The family adds no failure scenario. Eight of the thirteen steps own no issue at all, so their only failure is the type check in front of them, which `primitive/invalid-type` and `transform/invalid-type` already measure. The five callback-bearing steps fail only when a callback throws, and a throw inside a Zod or Valibot callback escapes `safeParse` — the same finding `fallback/*` and `coercion/*` recorded — so such a scenario would be a Valchecker-only row duplicating a focused benchmark. The Set branches of `toMapped` and `toFiltered` are left out for a stronger reason: Valibot's `mapItems`/`filterItems` are array-only, and `new Set([...set].map(f))` silently deduplicates where `toMapped` rejects with `toMapped:duplicate_mapped_item`, so the closure makes a different decision rather than the same one more cheaply. Those paths are measured by the colocated focused benchmarks.

`serialization/*` measures `toJSONValue` and `toJSONString`, the two transformations in that batch with a failure of their own. All five adapters run the valid cases; the two invalid cases are gated, because Zod's only spelling lets `JSON.parse`'s `SyntaxError` and `JSON.stringify`'s circular-structure `TypeError` escape `safeParse`. `toJSONValue` is `JSON.parse` in a `try`/`catch` on both participating sides and the rows land within about 6% of each other, with the invalid one dominated by the `SyntaxError` itself (3,692.2 ns against Valibot's 3,895.2 ns). `toJSONString` is the substantial `compatible-subset`: it performs a single-read preflight over own enumerable JSON properties before calling `JSON.stringify`, which is what turns a cycle, a bigint, a symbol, a function, an explicit `undefined`, or an array hole into a structured issue carrying the nested `at` path instead of a throw, an omitted key, or a `null`. The two rows are the two ends of that decision and should be quoted together: serializing the valid payload costs Valchecker 1,274.9 ns against Valibot's 218.5 ns, while rejecting the cycle costs Valchecker 252.3 ns against Valibot's 4,157.6 ns. The paths where the libraries disagree — an explicit `undefined` property, an array hole, or a throwing getter or `toJSON` — have no fixture every participant agrees on and are left to the focused benchmark.

`async/*` is the asynchronous execution path, which nothing in the suite measured before — no scenario and no fixture contained an `async` or an `await`. All five adapters participate on all four rows. The libraries reach asynchrony from opposite places, which is the point of the family: in Valchecker it belongs to the schema, because a `check` or `transform` callback returning a `PromiseLike` makes the pipeline maybe-async and `toAsync()` forces a promise even for a synchronous success, so `execute` is unchanged; in Zod it belongs to the call, because an async `refine`/`transform` callback makes the schema parseable only through `safeParseAsync` and a synchronous `safeParse` of one throws; in Valibot it is both, because `pipeAsync` with `checkAsync`/`transformAsync` is the only pipe that can hold an async action and it must be run through `safeParseAsync`. Both callbacks resolve immediately — `async` with nothing awaited inside — and both come from `fixtures.mjs`, so the three libraries await the same function object and the subject is the promise machinery rather than a timer.

These cells are measured with the `await` inside the timed loop, which is the measurement rather than an artifact of it: an asynchronous caller cannot avoid the microtask turn that delivers the result. They therefore carry their own benchmark groups (`warm/async/success`, `warm/async/failure/library-default`) so that no aggregate averages an awaited number with a synchronous one, and every result and catalog entry records `executionMode`. Two pairs are meant to be read across the sync/async line and only these two: `async/wrapper-valid` against `primitive-builtin/valid`, which is the same schema and fixture on all five adapters made asynchronous in the only way each library offers, so the difference is the promise machinery and nothing else; and, much more loosely, `async/check-valid` against `primitive/valid`. Both are subject to the position effect described above, so quote them from one run and one scenario selection. A maybe-async pipeline that fails *before* its async callback has no honest cross-library row — Valchecker answers synchronously where neither competitor can run the schema synchronously at all — and asynchronous structural, union, and intersection scheduling stays out for the reason the methodology already gives for intersections.

`standard-schema/*` is the Standard Schema V1 entry point, `schema['~standard'].validate(input)`, which all four libraries implement and which is how tRPC, TanStack Form, and similar libraries reach a schema. Every other scenario in the suite calls the native entry, so the interop path was unmeasured. Each of the four scenarios reuses an existing build key — `primitive`, `flatObject`, `asyncCheck` — and changes nothing but the entry point, so it pairs with a native row over the identical schema and fixture. Read from each implementation: Valchecker installs `'~standard' = { version: 1, vendor: 'valchecker', validate: execute }`, where `validate` is the *same function object* as the public `execute` and the public result is already the Standard Schema result, so the layer is an alias; Zod calls the synchronous parse inside a `try`, falls back to the asynchronous parse on a throw, and rebuilds the result; Valibot returns its internal dataset, so a typed failure arrives as `{ value, typed: true, issues }` — with a `value` present. Success is therefore the absence of `issues`, as the specification says, and the harness normalizes the standard result once for all four rather than per adapter, because Standard Schema is one contract and not four spellings. `~standard.validate` can return a promise on all four, and only for a schema whose work is asynchronous, so the entry point does not decide the execution mode and `standard-schema/async-check-valid` declares `async` like any other awaited cell.

Measured alone at the standard profile — one scenario per process, so the position effect cannot masquerade as interop cost — the valid path costs Valchecker 62.9/62.1 ns natively against 61.5/62.0 ns through the entry point (no measurable difference, which is what an alias should show), Zod 3 61.6 → 62.5 ns, Zod 4 93.4 → 100.9 ns, and Valibot 94.4 → 110.5 ns. In a twelve-scenario smoke selection the same Valchecker pair reads 61.7 → 87.8 ns, and that 26 ns is position rather than interop, so quote the delta only from comparable positions and prefer a solo pair when the question is the size of the layer itself. The one place the implementations diverge sharply is an asynchronous schema: Zod 4 costs about 5,500 ns per call through `~standard.validate` against 336 ns through `safeParseAsync`, because the failed synchronous attempt constructs and throws a `$ZodAsyncError` on every call.

### Declared step coverage

Every scenario declares `steps`, the Valchecker public step methods its Valchecker schema calls, and the field is carried into each scenario's `raw.json` catalog entry. This makes step coverage of the suite a fact tooling can read rather than something inferred from scenario ids. Declaring it is mandatory: a scenario that omits it fails to build.

The list describes the schema the scenario measures, so it names what that schema actually calls and nothing else. Two consequences are easy to get wrong in both directions: the `[v.string()]` optional-field shorthand is `object`'s own optional handling and not a `union` branch, while `v.union(['px', 'em', 'rem'])` really does resolve its raw branches through `literal`.

One scenario family per module under `src/scenarios/`, listed in `src/scenarios/registry.mjs`; fixtures used by a single family live with it, and the rest are in `src/fixtures.mjs`.

### Comparability across runs

Existing scenario ids, fixtures, schema shapes, and tiers are treated as stable. A new framing is added under a new id rather than by editing an old scenario, and `smoke` stays small because every pull request runs it.

That stability is **per scenario**. Group-level aggregates — including the geometric means the performance-impact verdict uses — are not comparable across versions that changed the scenario set, because the group composition itself changed.

### Adapter capabilities

An adapter declares what it is, so the harness never has to infer behaviour from its name:

- `issuePolicies` — which explicit diagnostic policies it can express (`first`, `all`);
- `features` — schema kinds it supports that at least one other adapter lacks (see below);
- `generatedCode` — whether it compiles schemas into generated code, which drives the two report perspectives above.

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

Each library runs in a dedicated Node.js process. Library order is shuffled from a recorded seed. Results include every sample, median and mean throughput, median nanoseconds per operation, relative margin of error, package versions, Node.js version, CPU, operating system, runner image, commit metadata, benchmark group, issue policy, comparison scope, and skipped-adapter reasons.

## Interpretation

Do not combine construction, cold execution, warmed success, and the different failure-policy groups into one ranking. Compare libraries only within the same scenario, benchmark group, and issue policy. Asynchronous cells sit in their own groups for the same reason, and every scenario section in the report states its `Execution` mode and `Entry` point.

Results with relative margin of error above 5% are marked unstable in generated reports and should be rerun before drawing conclusions. `library-default` failure results include each library’s own issue construction and traversal behavior. Use explicit `first` or `all` scenarios when the diagnostic workload must be equivalent.

Zod 4’s generated object fast path can exchange expensive schema creation or first execution for exceptional warmed throughput. Fixed-input warmed scenarios therefore represent a steady-state ceiling, not cold-start latency or whole-application performance.
