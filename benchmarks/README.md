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

Scenarios cover primitive pipelines, flat and nested objects, strict and loose object behavior, arrays, Sets, Maps, ordered unions, compatible synchronous intersections, transformation pipelines, optional-heavy configuration objects, open records, tuples with a rest region, template literals, date validation, string-to-date conversion, date bounds, files, a file MIME-type check, every built-in string-format validator, finite membership, and every built-in numeric, string, equality, and collection-size constraint validator. Full mode adds 1,000-element array and record cases plus the secondary and failure variants of the newer families.

The string-format scenarios cover one built-in format validator each: `isEmail`, `isUuid`, `isIsoDateTime`, `isUrl`, `isIp`, `isIsoDate`, `isIsoTime`, `isEmoji`, `isBase64`, `isBase64Url`, `isNanoid`, `isUlid`, `isCuid2`, `isJwt`, `isHex`, `isMac`, and `isHostname`. `isMimeType` reads a value's own `type` string rather than validating a string, so it is measured over a `File` as `file-mime-type/*` instead.

The `constraint/*` scenarios do the same for the constraint validators, one per scenario pair: `isAtMost`, `isGreaterThan`, `isLessThan`, `isMultipleOf`, `isFinite`, `isSafeInteger`, `isNaN`, `isStartingWith`, `isEndingWith`, `isIncluding`, `isLengthExactly`, `isNotEmpty`, `isEmpty`, `isEqualTo`, `isSizeAtLeast`, `isSizeAtMost`, and `isSizeExactly`. Every one of them exists in all four pinned libraries — Zod spells them as schema methods, Valibot as pipe actions — so nothing in the family is capability-gated. Each is carried by the smallest schema that can hold it, and each invalid fixture is a value of the right type sitting just outside the bound under test rather than a wrong-typed value that would fail earlier. The numeric bound fixtures are all ordinary finite numbers, because the four base number schemas disagree about non-finite input — `v.number()` admits `NaN` and `±Infinity`, Zod 3's rejects `NaN`, Zod 4's rejects both, and Valibot's rejects `NaN` — and that difference belongs to `constraint/finite` and `constraint/nan` rather than to a bound.

`constraint/stack-*` is the deliberately separate case: five constraints on one string field, which is what a real schema does. The single-constraint scenarios measure the cheapest possible refinement — already past the point where the competitors lose the bare-schema fast path noted under date bounds below — while the stack is what shows how the cost grows from there.

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
- `hostname` — Valchecker and both Zod 4 adapters only.

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
- `constraint/equal-to` — as with finite membership, Valchecker validates the string and then equality while the competitors dispatch a single `literal()`. Valchecker's own one-step `literal()` exists, but the scenario is there to measure `isEqualTo`.

### Diagnostic policy comparability

Failure throughput is meaningful only when the amount of diagnostic work is explicit:

- `library-default` scenarios show the real default behavior of each product, but they are not assumed to collect the same number of issues.
- `first` scenarios require exactly one issue before timing. Valchecker and Valibot participate; Zod is omitted because it does not expose an equivalent whole-parse abort option.
- `all` scenarios declare and require an exact top-level issue count before timing. Valchecker uses `collectAllIssues: true`, Valibot uses its exhaustive default, and Zod uses its normal exhaustive structural behavior.
- unsupported adapters are listed in the report with a reason and are not ranked.

Intersection comparisons use only compatible synchronous object outputs and ordinary branch validation. Merge-conflict and asynchronous scheduling behavior remain excluded because those semantics differ across libraries.

In addition to fixed-input ceilings, representative warm scenarios rotate through pools of same-shape objects with different identities and values. These rotating-input cases reduce the risk of keeping an optimization that only benefits one frozen object instance.

Each library runs in a dedicated Node.js process. Library order is shuffled from a recorded seed. Results include every sample, median and mean throughput, median nanoseconds per operation, relative margin of error, package versions, Node.js version, CPU, operating system, runner image, commit metadata, benchmark group, issue policy, comparison scope, and skipped-adapter reasons.

## Interpretation

Do not combine construction, cold execution, warmed success, and the different failure-policy groups into one ranking. Compare libraries only within the same scenario, benchmark group, and issue policy.

Results with relative margin of error above 5% are marked unstable in generated reports and should be rerun before drawing conclusions. `library-default` failure results include each library’s own issue construction and traversal behavior. Use explicit `first` or `all` scenarios when the diagnostic workload must be equivalent.

Zod 4’s generated object fast path can exchange expensive schema creation or first execution for exceptional warmed throughput. Fixed-input warmed scenarios therefore represent a steady-state ceiling, not cold-start latency or whole-application performance.
