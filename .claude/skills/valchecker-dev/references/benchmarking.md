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

Keep these groups separate:

1. schema construction;
2. construction plus first validation (`cold`);
3. warmed success;
4. warmed library-default failure;
5. warmed first-issue failure;
6. warmed all-issues failure.

Library-default failure modes may perform different diagnostic work. Compare equivalent first/all policies only where the adapter exposes them.

Scenario families cover primitives, flat/nested/strict/loose objects, arrays, Sets, Maps, unions, compatible intersections, transforms, optional-heavy objects, open records, tuples with a rest region, template literals, dates and string-to-date conversion, string formats, and finite membership.

Existing scenario ids, fixtures, schemas, and tiers are stable: earlier runs are the baseline for the open performance issues, so add a new id instead of editing an old scenario, and keep `smoke` small because it gates every pull request.

When a library lacks a schema kind entirely, declare a required feature on the scenario and the supported features on each adapter — the runner then skips with a stated reason (`template literal` is Valchecker and Zod 4 only). Never substitute a hand-rolled stand-in to fill the cell; a skip is the honest result. When the family exists everywhere but differs in detail, declare `compatible-subset` and pick fixtures every implementation agrees on.

## Before/after impact

The **Performance Impact** workflow compares a baseline and candidate with interleaved paired independent processes. Pull requests that change runtime or benchmark source run the standard profile with three paired repetitions and fail on the workflow's severe-regression verdict.

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
