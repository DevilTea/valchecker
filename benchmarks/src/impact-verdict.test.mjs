import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aggregateRuns, compareResults, groupTotalsOf, renderMarkdown } from './impact-verdict.mjs'
import { criticalValue, mean } from './statistics.mjs'

/**
 * What a reader of a passing gate is entitled to know: which scenarios were compared,
 * how much of each group they are, and where the severe-group trigger did not apply.
 * The numbers below are chosen so every expectation can be read off the fixture by
 * hand — five identical repetitions per side make the paired ratio exact and its RME
 * zero, so a scenario is stable unless the fixture says otherwise.
 */

const profile = { warmupMs: 200, sampleMs: 300, minSamples: 5, maxSamples: 7, targetRelativeMarginOfError: 0.75 }

/** One `raw.json`, carrying one result per named scenario. */
function runOf(scenarios, { scenarioFilter = null, isolation = 'cell', shardCount = 1, cellCatalogHash = null, unmeasurableCells = [] } = {}) {
	return {
		schemaVersion: 4,
		mode: 'standard',
		isolation,
		profile,
		scenarioFilter,
		cellCatalogHash,
		unmeasurableCells,
		shards: Array.from({ length: shardCount }, (unused, index) => ({ index, count: shardCount })),
		environment: { commit: 'abc123' },
		libraries: [{
			adapter: 'valchecker',
			results: scenarios.map(([scenario, group, ops]) => ({
				scenario,
				category: 'warm',
				group,
				resultKind: 'success',
				issuePolicy: 'not-applicable',
				comparisonScope: 'equivalent',
				diagnosticIssueCount: null,
				medianOpsPerSecond: ops,
				relativeMarginOfError: 0.5,
			})),
		}],
	}
}

/** Five identical repetitions of one side, which is what the gate collects. */
function sideOf(scenarios, options) {
	return Array.from({ length: 5 }, () => runOf(scenarios, options))
}

function compare(baselineScenarios, candidateScenarios, groupTotals, options) {
	return compareResults(
		aggregateRuns(sideOf(baselineScenarios, options), 'baseline'),
		aggregateRuns(sideOf(candidateScenarios, options), 'candidate'),
		{ groupTotals: new Map(groupTotals) },
	)
}

test('a group aggregate reports how much of the group it covers', () => {
	// Five of `warm/success`'s 113 scenarios ran, which is what a scoped run looks like.
	// Reporting `2/2 stable` without the denominator is indistinguishable from a
	// complete comparison of a two-scenario group.
	const scenarios = [
		['a', 'warm/success', 100],
		['b', 'warm/success', 100],
		['c', 'warm/success', 100],
		['d', 'warm/success', 100],
		['e', 'warm/success', 100],
	]
	const result = compare(scenarios, scenarios, [['warm/success', 113], ['cold', 8]])
	assert.deepEqual(result.groups, [{
		group: 'warm/success',
		scenarios: 5,
		catalogScenarios: 113,
		decisiveScenarios: 5,
		inconclusiveScenarios: 0,
		ratio: 1,
		delta: 0,
		intervalLow: 0,
		intervalHigh: 0,
		classification: 'cleared',
	}])
	assert.deepEqual(result.coverage, { measuredScenarios: 5, tierScenarios: 121 })
	assert.deepEqual(result.partiallyCoveredGroups, [{ group: 'warm/success', measured: 5, total: 113 }])
	assert.match(renderMarkdown(result), /\| warm\/success \| 5\/113 \(4%\) \| 5\/5 \| \+0\.0% \| \+0\.0% … \+0\.0% \| cleared \|/)
	assert.match(renderMarkdown(result), /Scenarios measured: \*\*5 of 121\*\*/)
	assert.match(renderMarkdown(result), /Partly covered groups.*`warm\/success` 5\/113/)
})

test('a complete comparison says nothing about partial coverage', () => {
	// The positive control for the note above: the same shape with every scenario of
	// the group measured must not produce a scope warning, or the warning would be
	// noise a reader learns to skip.
	const scenarios = [['a', 'cold', 100], ['b', 'cold', 100]]
	const result = compare(scenarios, scenarios, [['cold', 2]])
	assert.deepEqual(result.partiallyCoveredGroups, [])
	assert.deepEqual(result.coverage, { measuredScenarios: 2, tierScenarios: 2 })
	const markdown = renderMarkdown(result)
	assert.doesNotMatch(markdown, /Partly covered groups/)
	assert.match(markdown, /\| cold \| 2\/2 \(100%\) \| 2\/2 \| \+0\.0% \| \+0\.0% … \+0\.0% \| cleared \|/)
})

test('a group with one measured scenario has no severe-group trigger, and says so', () => {
	const result = compare(
		[['a', 'warm/success', 100], ['b', 'warm/success', 100], ['c', 'warm/async/success', 100]],
		[['a', 'warm/success', 100], ['b', 'warm/success', 100], ['c', 'warm/async/success', 100]],
		[['warm/success', 113], ['warm/async/success', 4]],
	)
	assert.deepEqual(result.groupsWithoutTrigger, ['warm/async/success'])
	assert.match(renderMarkdown(result), /No severe-group trigger.*`warm\/async\/success`/)
})

test('a group with two measured scenarios does have one', () => {
	// The positive control: the same fixture with the thin group topped up to two.
	const result = compare(
		[['a', 'warm/success', 100], ['b', 'warm/async/success', 100], ['c', 'warm/async/success', 100]],
		[['a', 'warm/success', 100], ['b', 'warm/async/success', 100], ['c', 'warm/async/success', 100]],
		[['warm/success', 113], ['warm/async/success', 4]],
	)
	assert.deepEqual(result.groupsWithoutTrigger, ['warm/success'])
	assert.doesNotMatch(renderMarkdown(result), /No severe-group trigger.*`warm\/async\/success`/)
})

test('a row whose own interval spans a threshold is still in its group estimate', () => {
	// The reversal. The aggregate used to be a geometric mean over the group's *decisive*
	// rows, which conditions the estimate on the measurement outcome: a row survives that
	// filter when its own interval is narrow or its own effect is large, so the mean runs
	// over exactly the rows most likely to trigger it.
	//
	// `b` measures a different number in one repetition, so its own row is inconclusive.
	// Its cell is nevertheless in every one of the group's five repetition values, and the
	// noise it carries widens the group's interval instead of leaving it out — which is what
	// a group estimate over a noisy cell should look like.
	const baseline = aggregateRuns(sideOf([['a', 'cold', 100], ['b', 'cold', 100]]), 'baseline')
	const candidateRuns = sideOf([['a', 'cold', 100], ['b', 'cold', 100]])
	candidateRuns[0].libraries[0].results[1].medianOpsPerSecond = 300
	const result = compareResults(baseline, aggregateRuns(candidateRuns, 'candidate'), { groupTotals: new Map([['cold', 2]]) })
	const [group] = result.groups
	assert.equal(group.scenarios, 2)
	assert.equal(group.decisiveScenarios, 1, 'the counts stay as diagnostics')
	assert.equal(group.inconclusiveScenarios, 1)
	// exp of the mean of every log ratio in the group: `b`'s single 3× repetition raises it.
	assert.ok(group.delta > 0.1, 'the inconclusive row must be inside the estimate, not filtered out')
	assert.equal(group.classification, 'inconclusive', 'and its noise must widen the interval rather than sharpen it')
	assert.ok(group.intervalLow < 0 && group.intervalHigh > 0)
	// Two measured rows, so the trigger applies; it simply did not fire.
	assert.deepEqual(result.groupsWithoutTrigger, [])
	assert.deepEqual(result.severeGroups, [])
})

test('a group whose interval spans the group threshold is not severe', () => {
	// The group is judged by its interval for the same reason a row is. Two cells at −6%
	// with a 3% half-width put the group's point estimate past −5% and its interval across
	// it, so the honest answer is that this run cannot tell a 5% group regression from
	// noise. The rule this replaces compared the group's point estimate against the
	// threshold, which is what returned `review` on a commit compared against itself.
	const result = comparePaired([
		['a', 'cold', ratiosWith(-6, 3)],
		['b', 'cold', ratiosWith(-6, 3)],
	], [['cold', 2]])
	const [group] = result.groups
	assert.ok(group.delta <= -0.05, 'the fixture must put the group estimate past the group threshold')
	assert.ok(group.intervalHigh > -0.05, 'and its interval must not clear that threshold')
	assert.equal(group.classification, 'inconclusive')
	assert.deepEqual(result.severeGroups, [])
	assert.notEqual(result.verdict, 'regression')
})

test('a group verdict does not need any of its rows to be decisive', () => {
	// The other half of the reversal, and the case the old rule could not reach: five cells
	// each 8% down and each too noisy for its own row to decide, with the noise landing on a
	// different repetition in each. Averaging within a repetition before taking the spread
	// across repetitions cancels what is not common to the cells, so the group is decisive
	// where none of its rows is — which is what asking "did this affected group broadly
	// regress?" independently means. Under the decisive-rows rule this group had no aggregate
	// at all and passed in silence.
	//
	// The noise pattern sums to zero and the five cells carry its five cyclic shifts, so every
	// repetition's group value is exactly `ln(0.92)` while every row's own spread is identical
	// and wide enough to straddle −5%.
	const pattern = [-1, 1, 0, 1, -1]
	const drift = shift => Array.from(
		{ length: 5 },
		(unused, repetition) => Math.exp(Math.log(0.92) * (1 + 0.4 * pattern[(repetition + shift) % 5])),
	)
	const result = comparePaired(
		['a', 'b', 'c', 'd', 'e'].map((cell, shift) => [cell, 'warm/success', drift(shift)]),
		[['warm/success', 5]],
	)
	assert.deepEqual(result.rows.map(row => row.classification), Array.from({ length: 5 })
		.fill('inconclusive'))
	assert.equal(result.groups[0].decisiveScenarios, 0)
	assert.equal(Number(result.groups[0].delta.toFixed(6)), -0.08)
	assert.equal(result.groups[0].classification, 'regression')
	assert.deepEqual(result.severeGroups, ['warm/success'])
	assert.equal(result.verdict, 'regression')
})

test('a broad moderate regression across a group is severe even though no scenario is', () => {
	// Every scenario is down 6%: under the per-scenario 10% threshold, over the 5%
	// group threshold. This is the trigger the scoping had to keep working.
	const groups = [['warm/success', 3]]
	const before = [['a', 'warm/success', 100], ['b', 'warm/success', 100], ['c', 'warm/success', 100]]
	const after = [['a', 'warm/success', 94], ['b', 'warm/success', 94], ['c', 'warm/success', 94]]
	const result = compare(before, after, groups)
	assert.deepEqual(result.severeScenarios, [])
	assert.deepEqual(result.severeGroups, ['warm/success'])
	assert.equal(result.verdict, 'regression')
})

test('one scenario past the per-scenario threshold is severe on its own', () => {
	const result = compare(
		[['a', 'warm/success', 100], ['b', 'warm/success', 100]],
		[['a', 'warm/success', 100], ['b', 'warm/success', 85]],
		[['warm/success', 2]],
	)
	assert.deepEqual(result.severeScenarios, ['b'])
	assert.equal(result.verdict, 'regression')
})

test('the report carries the conditions the verdict was reached under', () => {
	const scenarios = [['a', 'cold', 100], ['b', 'cold', 100]]
	const result = compare(scenarios, scenarios, [['cold', 8]], { scenarioFilter: ['b', 'a'] })
	assert.equal(result.schemaVersion, 9)
	assert.deepEqual(result.measurement, { isolation: 'cell', shardCount: 1, selection: ['a', 'b'], cellCatalogHash: null })
	assert.match(renderMarkdown(result), /scoped to the diff/)
})

test('the presence counts are reported whether or not anything moved', () => {
	// Unconditional is the whole point. A line that appeared only when a cell was added or
	// removed would leave a reader of a clean report unable to tell a comparison whose cell
	// set held still from one that never looked.
	const scenarios = [['a', 'cold', 100], ['b', 'cold', 100]]
	const result = compare(scenarios, scenarios, [['cold', 8]])
	assert.deepEqual(result.cells, {
		catalogHash: null,
		catalogCells: 8,
		measured: 2,
		candidateOnly: [],
		baselineOnly: [],
		baselineUnmeasurable: [],
		candidateUnmeasurable: [],
		catalogDiff: null,
	})
	const markdown = renderMarkdown(result)
	assert.match(markdown, /Cells: \*\*measured 2\*\* of the 8 the catalog declares/)
	// `n/a`, not `0`: with no static diff supplied this run cannot see a deleted cell, and
	// printing a zero would claim an audit it did not perform.
	assert.match(markdown, /\*\*catalog added n\/a \/ removed n\/a\*\*/)
	assert.match(markdown, /No catalog diff was supplied/)
})

test('a cell only one build can execute is named as added or removed, not thrown away', () => {
	// A new step's cells cannot execute against the baseline build, and a deleted subject's
	// cannot execute against the candidate's. Both used to abort the comparison — the
	// candidate-side one with `Candidate contains scenarios absent from baseline` — so a
	// pull request adding a step could not be measured at all. Each is now a named row of
	// the presence line, and neither is silently absent.
	const baseline = aggregateRuns(sideOf([['a', 'cold', 100], ['gone', 'cold', 100]], { unmeasurableCells: [{ cell: 'new', reason: 'threw' }] }), 'baseline')
	const candidate = aggregateRuns(sideOf([['a', 'cold', 100], ['new', 'cold', 100]], { unmeasurableCells: [{ cell: 'gone', reason: 'threw' }] }), 'candidate')
	const result = compareResults(baseline, candidate, { groupTotals: new Map([['cold', 3]]) })
	assert.deepEqual(result.rows.map(row => row.scenario), ['a'])
	assert.equal(result.cells.measured, 1)
	assert.deepEqual(result.cells.candidateOnly, ['new'])
	assert.deepEqual(result.cells.baselineOnly, ['gone'])
	assert.deepEqual(result.cells.baselineUnmeasurable, ['new'])
	assert.deepEqual(result.cells.candidateUnmeasurable, ['gone'])
	const markdown = renderMarkdown(result)
	assert.match(markdown, /\*\*candidate-only 1 \/ baseline-only 1\*\*/)
	assert.match(markdown, /\*\*Candidate-only at runtime\.\*\* `new`/)
	assert.match(markdown, /\*\*Baseline-only at runtime\.\*\* `gone`/)
})

test('a catalog deletion is reported from the static diff, which the runtime cannot see', () => {
	// The finding this exists for: the apparatus comes from the candidate ref, so a deleted cell
	// is never collected, never measured, and can never appear in a baseline result. Every
	// runtime count here is zero while a cell was in fact removed from the contract.
	const scenarios = [['a', 'cold', 100], ['b', 'cold', 100]]
	const catalogDiff = { added: ['c/new'], removed: ['map/collect-all'], baseCells: 3, headCells: 3, problems: [] }
	const result = compareResults(
		aggregateRuns(sideOf(scenarios), 'baseline'),
		aggregateRuns(sideOf(scenarios), 'candidate'),
		{ groupTotals: new Map([['cold', 8]]), catalogDiff },
	)
	assert.deepEqual([result.cells.candidateOnly, result.cells.baselineOnly], [[], []], 'the runtime sees nothing')
	assert.deepEqual(result.cells.catalogDiff.removed, ['map/collect-all'])
	const markdown = renderMarkdown(result)
	assert.match(markdown, /\*\*catalog added 1 \/ removed 1\*\*/)
	assert.match(markdown, /\*\*Removed from the catalog\.\*\* `map\/collect-all`/)
	assert.match(markdown, /coverage loss no runtime comparison can report/)
})

test('an unreadable revision makes the catalog diff incomplete rather than clean', () => {
	const scenarios = [['a', 'cold', 100]]
	const catalogDiff = { added: [], removed: [], baseCells: 0, headCells: 1, problems: ['base: a.bench.ts: declares no `stepBench()` call'] }
	const result = compareResults(
		aggregateRuns(sideOf(scenarios), 'baseline'),
		aggregateRuns(sideOf(scenarios), 'candidate'),
		{ groupTotals: new Map([['cold', 8]]), catalogDiff },
	)
	assert.match(renderMarkdown(result), /The catalog diff is incomplete/)
})

test('a catalog other than the one measured against is refused', () => {
	// The denominators come from a file now. A stale artifact would misstate every group's
	// coverage without changing a number, which is the one thing persisting the catalog
	// could have made worse rather than better.
	const scenarios = [['a', 'cold', 100], ['b', 'cold', 100]]
	const options = { cellCatalogHash: 'abc123abc123abc1' }
	const measured = () => compareResults(
		aggregateRuns(sideOf(scenarios, options), 'baseline'),
		aggregateRuns(sideOf(scenarios, options), 'candidate'),
		{ groupTotals: new Map([['cold', 8]]), catalogHash: 'ffffffffffffffff' },
	)
	assert.throws(measured, /supplied to the comparison is ffffffffffffffff but the runs were measured against abc123abc123abc1/)
	const matching = compareResults(
		aggregateRuns(sideOf(scenarios, options), 'baseline'),
		aggregateRuns(sideOf(scenarios, options), 'candidate'),
		{ groupTotals: new Map([['cold', 8]]), catalogHash: 'abc123abc123abc1' },
	)
	assert.equal(matching.cells.catalogHash, 'abc123abc123abc1')
	assert.equal(matching.measurement.cellCatalogHash, 'abc123abc123abc1')
})

test('repetitions of one side that disagree about what they measured are refused', () => {
	// Which cells have numbers is decided by `verifyCell` against one build, so it cannot
	// vary between the repetitions of one side. If it does, the rows would be built from the
	// first repetition's cell set while a later one contributed different paired ratios.
	const runs = sideOf([['a', 'cold', 100]])
	runs[2].unmeasurableCells = [{ cell: 'b', reason: 'threw' }]
	assert.throws(() => aggregateRuns(runs, 'candidate'), /candidate run 3 reports different unmeasurable cells/)

	const extra = sideOf([['a', 'cold', 100]])
	extra[3].libraries[0].results.push({ ...extra[3].libraries[0].results[0], scenario: 'b' })
	assert.throws(() => aggregateRuns(extra, 'baseline'), /baseline run 4 measured 2 scenarios and baseline run 1 measured 1/)
})

test('two sides measured over different scenario sets are refused', () => {
	assert.throws(
		() => compareResults(
			aggregateRuns(sideOf([['a', 'cold', 100]], { scenarioFilter: ['a'] }), 'baseline'),
			aggregateRuns(sideOf([['a', 'cold', 100]], { scenarioFilter: null }), 'candidate'),
			{ groupTotals: new Map([['cold', 8]]) },
		),
		/they differ in selection/,
	)
})

test('a denominator smaller than what ran is raised to what ran', () => {
	// A selection can name a scenario from a richer tier than the mode's, so the group
	// total read from the tier catalog can be short. Reporting `3/2` would be a
	// reporting bug standing in for a selection fact.
	const scenarios = [['a', 'cold', 100], ['b', 'cold', 100], ['c', 'cold', 100]]
	const result = compare(scenarios, scenarios, [['cold', 2]])
	assert.equal(result.groups[0].catalogScenarios, 3)
	assert.deepEqual(result.partiallyCoveredGroups, [])
})

test('group totals are counted from a catalog', () => {
	assert.deepEqual(
		[...groupTotalsOf([
			{ id: 'a', group: 'cold' },
			{ id: 'b', group: 'cold' },
			{ id: 'c', group: 'warm/success' },
		])],
		[['cold', 2], ['warm/success', 1]],
	)
})

/**
 * The interval rule, driven by the two hosted-runner null runs (`before == after`, so
 * every non-neutral result in them is false by construction).
 *
 * Five paired ratios with a chosen reported delta and a chosen paired RME. The estimator
 * is the mean of the log ratios and its t interval, so the construction is symmetric **in
 * logs** — `[m-a, m-b, m, m+b, m+a]` around `m = ln(1 + delta)`, with `(a² + b²)/2 = sd²`
 * and `b = sd/2`. Then `exp(mean)` is exactly `1 + delta` and the half-width is exactly
 * the requested percentage, which is what lets these expectations be read directly against
 * the numbers the null runs produced.
 */
function ratiosWith(deltaPercent, rmePercent) {
	const centre = Math.log(1 + deltaPercent / 100)
	const halfWidthPerSd = criticalValue(5) / Math.sqrt(5)
	const sd = rmePercent / 100 / halfWidthPerSd
	const b = sd / 2
	const a = Math.sqrt(1.75) * sd
	return [centre - a, centre - b, centre, centre + b, centre + a].map(Math.exp)
}

/** One row per entry, with the candidate side moving by the given ratio each repetition. */
function comparePaired(entries, groupTotals) {
	const baseline = Array.from({ length: 5 }, () => runOf(entries.map(([scenario, group]) => [scenario, group, 100])))
	const candidate = Array.from({ length: 5 }, (unused, repetition) => runOf(entries.map(([scenario, group, ratios]) => [scenario, group, 100 * ratios[repetition]])))
	return compareResults(
		aggregateRuns(baseline, 'baseline'),
		aggregateRuns(candidate, 'candidate'),
		{ groupTotals: new Map(groupTotals) },
	)
}

test('the point estimate and the interval are one statistic', () => {
	// The inconsistency this replaces: the interval was centred on the mean of the paired
	// ratios while the reported and severe-triggering point estimate was their median, so
	// the number a reader saw was not the number the interval was about. Here the reported
	// ratio is `exp` of the mean of the log ratios and the interval is `exp` of that mean
	// plus and minus its half-width, which is what makes the interval symmetric around the
	// point estimate multiplicatively — the ratio of each bound to the estimate is the same.
	const ratios = ratiosWith(-8, 4)
	const result = comparePaired([['a', 'warm/success', ratios]], [['warm/success', 8]])
	const [row] = result.rows
	assert.equal(Number(row.delta.toFixed(6)), -0.08)
	assert.deepEqual(row.logRatios.map(value => Number(value.toFixed(12))), ratios.map(ratio => Number(Math.log(ratio)
		.toFixed(12))))
	assert.ok(Math.abs(mean(row.logRatios) - Math.log(1 + row.delta)) < 1e-12, 'the reported ratio must be exp of the mean log ratio')
	const toLow = (1 + row.intervalLow) / (1 + row.delta)
	const toHigh = (1 + row.intervalHigh) / (1 + row.delta)
	assert.equal(Number((toLow * toHigh).toFixed(12)), 1, 'the two bounds must be reciprocal multiples of the estimate')
	assert.equal(Number((Math.log(toHigh) * 100).toFixed(6)), Number(row.pairedRme.toFixed(6)))
})

test('an improvement and the regression that undoes it are mirror images', () => {
	// Multiplicative symmetry, which is the property the log form buys. A candidate 25%
	// faster and a candidate whose ratio is the reciprocal produce deltas of +25% and -20%,
	// and log-mean estimates that are exact negatives — so neither direction is favoured by
	// the estimator, which is what lets a group mean of these numbers mean anything.
	const faster = comparePaired([['a', 'warm/success', ratiosWith(25, 2)]], [['warm/success', 8]]).rows[0]
	const slower = comparePaired([['a', 'warm/success', ratiosWith(25, 2)
		.map(ratio => 1 / ratio)]], [['warm/success', 8]]).rows[0]
	assert.ok(Math.abs(Math.log(1 + faster.delta) + Math.log(1 + slower.delta)) < 1e-12, 'the two log-mean estimates must be exact negatives')
	assert.equal(Number(slower.delta.toFixed(6)), -0.2)
	assert.equal(Number(faster.pairedRme.toFixed(9)), Number(slower.pairedRme.toFixed(9)))
	assert.deepEqual([faster.classification, slower.classification], ['improvement', 'severe'])
})

test('a precise false positive is not called a regression', () => {
	// `construct/tuple` in null run A: delta -5.32% with a paired RME of 3.12%, precise by
	// the threshold that used to decide the verdict, and false by construction. Its
	// interval is about [-8.3%, -2.4%], which spans -5%, so the honest answer is that this
	// run cannot tell a 5% regression from noise on that cell. The old rule compared the
	// point estimate against -5% and returned `review`.
	const result = comparePaired([['construct/tuple', 'construction', ratiosWith(-5.32, 3.12)]], [['construction', 8]])
	const [row] = result.rows
	assert.equal(Number(row.delta.toFixed(4)), -0.0532)
	assert.equal(Number(row.pairedRme.toFixed(2)), 3.12)
	assert.equal(row.precise, true, 'the fixture must be precise by the old threshold, or it is not this case')
	assert.equal(row.classification, 'inconclusive')
	assert.equal(row.decisive, false)
	assert.ok(row.intervalLow < -0.05 && row.intervalHigh > -0.05, 'the interval must span the meaningful threshold')
	assert.deepEqual(result.severeScenarios, [])
	assert.deepEqual(result.inconclusiveScenarios, ['construct/tuple'])
	assert.equal(result.verdict, 'inconclusive')
})

test('every large false delta the null runs produced is inconclusive', () => {
	// The four largest, all with intervals spanning everything. A gate that reported any of
	// them as a change would be reporting its runner.
	for (const [deltaPercent, rmePercent] of [[14.88, 19.47], [-7.71, 15.72], [-6.07, 6.15], [-5.64, 11.09]]) {
		const result = comparePaired([['a', 'warm/success', ratiosWith(deltaPercent, rmePercent)]], [['warm/success', 8]])
		const [row] = result.rows
		assert.equal(row.classification, 'inconclusive', `delta ${deltaPercent}% at RME ${rmePercent}% must not be decisive`)
		assert.equal(result.verdict, 'inconclusive')
	}
})

test('an imprecise row whose whole interval is a regression is severe', () => {
	// The false negative the old rule produced, and the reason precision stopped deciding:
	// -12% with 6% RME is an interval of about [-17.3%, -6.7%], every value in it a
	// regression. `pairedRme > 5` made it `unstable`, and an unstable row could not produce
	// a severe verdict — a silent pass.
	const result = comparePaired([['a', 'warm/success', ratiosWith(-12, 6)]], [['warm/success', 8]])
	const [row] = result.rows
	assert.equal(row.precise, false, 'the fixture must be imprecise by the old threshold, or it is not this case')
	assert.ok(row.intervalHigh <= -0.05, 'the whole interval must be a regression')
	assert.equal(row.classification, 'severe')
	assert.equal(row.decisive, true)
	assert.deepEqual(result.severeScenarios, ['a'])
	assert.equal(result.verdict, 'regression')
})

test('a row whose whole interval sits inside the thresholds is cleared however precise it is', () => {
	const result = comparePaired([['a', 'warm/success', ratiosWith(0, 1)], ['b', 'warm/success', ratiosWith(-1, 1.5)]], [['warm/success', 2]])
	assert.deepEqual(result.rows.map(row => row.classification), ['cleared', 'cleared'])
	assert.equal(result.groups[0].decisiveScenarios, 2)
	assert.equal(result.verdict, 'neutral')
	assert.deepEqual(result.inconclusiveScenarios, [])
})

test('an improvement is decisive and counts toward its group aggregate', () => {
	// Improvements are in the aggregate with the rest. Leaving them out would compute a
	// geometric mean over regressions and cleared rows only, which is biased toward firing
	// the group trigger on what is really a trade-off.
	const result = comparePaired([
		['a', 'warm/success', ratiosWith(12, 2)],
		['b', 'warm/success', ratiosWith(-12, 2)],
	], [['warm/success', 2]])
	assert.deepEqual(result.rows.map(row => row.classification)
		.sort(), ['improvement', 'severe'])
	assert.equal(result.groups[0].decisiveScenarios, 2)
	assert.ok(Math.abs(result.groups[0].delta) < 0.02, 'the two cancel in the aggregate, which is what a trade-off looks like')
	assert.equal(result.verdict, 'regression', 'the per-row severe trigger still fires inside a trade-off')
})
