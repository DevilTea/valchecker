// `collection-transform/*`: the transformations that reshape a collection or read
// a scalar out of one — `toArray`, `toSize`, `toKeys`, `toValues`, `toEntries`,
// `toMappedKeys`, `toMappedValues`, `toMapped`, `toFiltered`, `toSorted`,
// `toSliced`, `toSplit`, and `toLength`. None of them was measured before.
//
// ## What this family compares, and why it is not the `primitive` defect
//
// This is the mirror image of `primitive-builtin`. There, the Valchecker side of
// an existing scenario ended in a `check()` closure while Zod and Valibot used a
// built-in `regex` action, so the scenario flattered the competitors and a second
// build key had to be added to make the closure cost readable. Here the built-in
// is Valchecker's: Zod has no transformation action for any of these thirteen
// steps, so every Zod cell is `.transform()` around a native call. That is not the
// same defect. It is a real difference in what the three libraries provide, and
// refusing to measure it would hide it — but the reader has to be able to tell
// that is what the row shows, so every scenario declares `compatible-subset` and
// the difference is named below rather than presented as equivalence.
//
// Valibot is not uniformly on the closure side. It ships `mapItems`, `filterItems`,
// and `sortItems` as transformation actions, so `to-mapped-valid`,
// `to-filtered-valid`, and `to-sorted-valid` compare a built-in against a built-in
// on that adapter and against a closure on the two Zods, in one row. All three of
// those actions hand the callback straight to `Array.prototype.map`/`filter`/`sort`,
// which is why they belong in the same row rather than in a separate build key.
//
// ## The decision per transform: is the competitor closure the same work?
//
// Read from the implementations under `packages/internal/src/steps/`, the test is
// whether the competitor closure ends up making the same native call:
//
// - **thin wrappers around one native call.** `toArray` is `[...value]`, `toKeys`
//   `[...value.keys()]`, `toValues` `[...value.values()]`, `toEntries`
//   `[...value.entries()]`, `toSize` `value.size`, `toLength` `value.length`,
//   `toSliced` `value.slice(...params)`, `toSplit` `value.split(...params)`, and
//   the array branch of `toMapped`/`toFiltered`/`toSorted` is
//   `value.map`/`filter`/`toSorted` with the caller's callback. A closure spelling
//   the same expression is the same work, and the only asymmetry left is the
//   built-in-versus-callback one stated above. These are fair to compare.
// - **materially more work on the Valchecker side, stated rather than hidden.**
//   Three steps do something a bare native call does not:
//   - `toMappedKeys` maintains a mapped-key uniqueness Map and per-key provenance,
//     and rejects a SameValueZero collision with
//     `toMappedKeys:duplicate_mapped_key`. `new Map([...map].map(…))` keeps the
//     last entry instead. Named in the scope, not equalized: a competitor closure
//     that reimplemented collision detection would be a hand-rolled stand-in for a
//     built-in, which is what the suite refuses to build. The precedent is
//     `openRecord`, which is `compatible-subset` for exactly this reason —
//     "Valchecker maintains a transformed-key uniqueness map that Zod and Valibot
//     do not".
//   - `toMapped`, `toFiltered`, and `toSorted` wrap the callback so a throw becomes
//     a `*:callback_failed` operation issue. On the fixtures here nothing throws,
//     so the cost is the wrapper and not the recovery; the divergence itself cannot
//     be measured, because a throw inside a Zod or Valibot callback escapes
//     `safeParse` entirely — verified by execution here, and the same finding
//     `fallback/*` and `coercion/*` recorded for `.catch()` and
//     `v.transform(BigInt)`.
//   - `toMappedValues` snapshots entries and rebuilds the Map with a `for` loop and
//     a per-entry `try`, where the closure builds two arrays and one Map. Same
//     result, different route; that is inside what `compatible-subset` covers.
//
// ## What is deliberately left out
//
// - **The Set branches of `toMapped` and `toFiltered`.** Valibot's `mapItems` and
//   `filterItems` are array-only, and a Set closure makes a different decision
//   rather than the same one more cheaply: `new Set([...set].map(f))` silently
//   deduplicates where `toMapped` rejects with
//   `toMapped:duplicate_mapped_item`. Their cost is measured by the focused
//   benchmarks, which cover the Set success, Set callback failure, and collision
//   paths (`packages/internal/src/steps/toMapped/toMapped.bench.ts`,
//   `toFiltered/toFiltered.bench.ts`).
// - **Every failure variant.** Eight of these steps own no issue at all —
//   `toArray`, `toSize`, `toKeys`, `toValues`, `toEntries`, `toSliced`, `toSplit`,
//   and `toLength` declare `### Issues: None.` — so their only failure is the type
//   check in front of them, which `primitive/invalid-type` and
//   `transform/invalid-type` already measure. The five callback-bearing steps fail
//   only when a callback throws, which no competitor can express, so a scenario for
//   it would be a Valchecker-only row duplicating a focused benchmark. Rather than
//   rename an existing measurement, this family adds no failure scenario; the two
//   the batch does add are in `serialization/*`, where Valibot can express both.
//
// ## Sizes and carriers
//
// Ten items everywhere, matching `array/10-valid`, the suite's smallest existing
// collection scenario. Ten keeps the native call from swamping the library: a
// 1,000-element `toSorted` would measure `Array.prototype.sort` and nothing else.
// Each step then sits on the smallest schema that can carry it, the same principle
// the `constraint/*` family uses, so a row reads as the step rather than as its
// container — a Set for `toArray`/`toSize`, a Map for the five Map steps, a
// ten-number array for the four array steps, and a string for `toSplit` and
// `toLength`.
//
// ## Do not read these rows against each other
//
// Sharing a base schema makes the rows of a carrier group look comparable, and they
// are not. Measured with this suite's own runner: the first array-carried scenario
// in a process reports 83.5 ns on Valchecker, and an *identical* schema measured
// after three other array pipelines reports 261.9 ns — 3.1× worse for the same
// work. Zod 4 shows the same effect from 132.7 to 285.2 ns; Valibot does not show it
// at all (275.5 to 272.1 ns), because `safeParse` gives it no per-schema call site
// to lose. It is the effect `schema-kind/*` recorded for the per-call floors, and it
// reaches further than it looks there: it is not confined to scenarios with no
// validation work, and it keys on the carrier rather than on position in the process
// — a Set and two Map scenarios in front of `to-mapped-valid` leave it fast, one
// more array pipeline does not.
//
// Two consequences to carry into any reading of this family. The ordering of its
// rows is an artifact of declaration order, so `to-mapped-valid` being the fastest
// row here says nothing about `toMapped` being cheaper than `toSliced`. And the
// first row of each carrier group collects a position advantage that Valchecker and
// Zod 4 take and Valibot does not, so that row's cross-library ratio is the most
// favorable position Valchecker can be measured in rather than a typical one. What
// each row does support is the comparison inside it at the position the run gives
// it, which is what the suite's per-scenario stability rule already requires.
//
// The callbacks, slice range, and separator the four adapters share live in
// `../fixtures.mjs` as `collectionTransforms`, because the adapters rather than
// this module need them.
import { warm } from './define.mjs'

const size = 10
const itemNames = Array.from({ length: size }, (_, index) => `item-${index}`)

const inputs = {
	set: new Set(itemNames),
	map: new Map(itemNames.map((name, index) => [name, index])),
	// A fixed shuffled order, frozen. Valibot's `sortItems` really does call
	// `Array.prototype.sort`, but on the copy `v.array()` built rather than on this
	// array: executing every adapter's sort schema three times over this frozen
	// fixture returns `[0…9]` each time and leaves the fixture untouched, so the
	// warm loop keeps sorting unsorted input on all five adapters.
	numbers: Object.freeze([5, 3, 9, 1, 7, 2, 8, 4, 6, 0]),
	// Ten fields, so the split allocates as many strings as the collections hold
	// items.
	csv: 'a,b,c,d,e,f,g,h,i,j',
	text: 'Hello, world!',
}

// Written out independently of `collectionTransforms` where a mapped result is
// asserted, so the expectation is a literal statement of the intended output
// rather than the operation under test applied to itself.
const expected = {
	items: itemNames,
	indexes: Array.from({ length: size }, (_, index) => index),
	entries: itemNames.map((name, index) => [name, index]),
	upperKeyed: new Map(Array.from({ length: size }, (_, index) => [`ITEM-${index}`, index])),
	incremented: new Map(itemNames.map((name, index) => [name, index + 1])),
	doubled: [10, 6, 18, 2, 14, 4, 16, 8, 12, 0],
	even: [2, 8, 4, 6, 0],
	sorted: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
	sliced: [9, 1, 7, 2, 8, 4],
	fields: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
	length: 13,
}

const setSteps = ['set', 'string']
const mapSteps = ['map', 'string', 'number']
const arraySteps = ['array', 'number']

const subset = 'compatible-subset'

export const collectionTransformScenarios = [
	warm('collection-transform/to-array-valid', 'standard', 'setToArray', inputs.set, { success: true, output: expected.items }, { comparisonScope: subset, steps: [...setSteps, 'toArray'] }),
	warm('collection-transform/to-size-valid', 'standard', 'setToSize', inputs.set, { success: true, output: size }, { comparisonScope: subset, steps: [...setSteps, 'toSize'] }),

	// `toKeys` and `toValues` do the same amount of work over the same Map and are
	// both kept, for the reason `schema-kind/any-valid` and
	// `schema-kind/unknown-valid` are both kept: they are two separate steps here
	// and two separate expressions in all three competitors. `toEntries` is the one
	// of the three that differs, because it allocates a tuple per entry.
	warm('collection-transform/to-keys-valid', 'standard', 'mapToKeys', inputs.map, { success: true, output: expected.items }, { comparisonScope: subset, steps: [...mapSteps, 'toKeys'] }),
	warm('collection-transform/to-values-valid', 'standard', 'mapToValues', inputs.map, { success: true, output: expected.indexes }, { comparisonScope: subset, steps: [...mapSteps, 'toValues'] }),
	warm('collection-transform/to-entries-valid', 'standard', 'mapToEntries', inputs.map, { success: true, output: expected.entries }, { comparisonScope: subset, steps: [...mapSteps, 'toEntries'] }),
	warm('collection-transform/to-mapped-keys-valid', 'standard', 'mapToMappedKeys', inputs.map, { success: true, output: expected.upperKeyed }, { comparisonScope: subset, steps: [...mapSteps, 'toMappedKeys'] }),
	warm('collection-transform/to-mapped-values-valid', 'standard', 'mapToMappedValues', inputs.map, { success: true, output: expected.incremented }, { comparisonScope: subset, steps: [...mapSteps, 'toMappedValues'] }),

	warm('collection-transform/to-mapped-valid', 'standard', 'arrayToMapped', inputs.numbers, { success: true, output: expected.doubled }, { comparisonScope: subset, steps: [...arraySteps, 'toMapped'] }),
	warm('collection-transform/to-filtered-valid', 'standard', 'arrayToFiltered', inputs.numbers, { success: true, output: expected.even }, { comparisonScope: subset, steps: [...arraySteps, 'toFiltered'] }),
	warm('collection-transform/to-sorted-valid', 'standard', 'arrayToSorted', inputs.numbers, { success: true, output: expected.sorted }, { comparisonScope: subset, steps: [...arraySteps, 'toSorted'] }),
	warm('collection-transform/to-sliced-valid', 'standard', 'arrayToSliced', inputs.numbers, { success: true, output: expected.sliced }, { comparisonScope: subset, steps: [...arraySteps, 'toSliced'] }),

	warm('collection-transform/to-split-valid', 'standard', 'stringToSplit', inputs.csv, { success: true, output: expected.fields }, { comparisonScope: subset, steps: ['string', 'toSplit'] }),
	warm('collection-transform/to-length-valid', 'standard', 'stringToLength', inputs.text, { success: true, output: expected.length }, { comparisonScope: subset, steps: ['string', 'toLength'] }),
]
