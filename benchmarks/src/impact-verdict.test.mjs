import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aggregateRuns, compareResults, groupTotalsOf, renderMarkdown } from './impact-verdict.mjs'
import { criticalValue } from './statistics.mjs'

/**
 * What a reader of a passing gate is entitled to know: which scenarios were compared,
 * how much of each group they are, and where the severe-group trigger did not apply.
 * The numbers below are chosen so every expectation can be read off the fixture by
 * hand — five identical repetitions per side make the paired ratio exact and its RME
 * zero, so a scenario is stable unless the fixture says otherwise.
 */

const profile = { warmupMs: 200, sampleMs: 300, minSamples: 5, maxSamples: 7, targetRelativeMarginOfError: 0.75 }

/** One `raw.json`, carrying one result per named scenario. */
function runOf(scenarios, { scenarioFilter = null, isolation = 'cell', shardCount = 1 } = {}) {
	return {
		schemaVersion: 4,
		mode: 'standard',
		isolation,
		profile,
		scenarioFilter,
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
	}])
	assert.deepEqual(result.coverage, { measuredScenarios: 5, tierScenarios: 121 })
	assert.deepEqual(result.partiallyCoveredGroups, [{ group: 'warm/success', measured: 5, total: 113 }])
	assert.match(renderMarkdown(result), /\| warm\/success \| 5\/113 \(4%\) \| 5\/5 \| \+0\.0% \|/)
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
	assert.match(markdown, /\| cold \| 2\/2 \(100%\) \| 2\/2 \| \+0\.0% \|/)
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

test('a row whose interval spans a threshold does not count toward its group trigger', () => {
	// `b` measures a different number in one repetition, which widens its paired-ratio
	// interval until it spans both thresholds. Two measured rows then leave one decisive
	// one, and the trigger is reported as absent rather than as cleared.
	const baseline = aggregateRuns(sideOf([['a', 'cold', 100], ['b', 'cold', 100]]), 'baseline')
	const candidateRuns = sideOf([['a', 'cold', 100], ['b', 'cold', 100]])
	candidateRuns[0].libraries[0].results[1].medianOpsPerSecond = 300
	const result = compareResults(baseline, aggregateRuns(candidateRuns, 'candidate'), { groupTotals: new Map([['cold', 2]]) })
	assert.equal(result.groups[0].scenarios, 2)
	assert.equal(result.groups[0].decisiveScenarios, 1)
	assert.equal(result.groups[0].inconclusiveScenarios, 1)
	assert.deepEqual(result.groupsWithoutTrigger, ['cold'])
})

test('one decisive row cannot make its group severe on its own', () => {
	// `b` is unstable, so `cold`'s geometric mean rests on `a` alone at -6%: past the
	// group threshold, short of the per-scenario one. Calling that a severe *group*
	// regression would be one measurement wearing the authority of an aggregate, so the
	// verdict stays clear and the group is reported as having no trigger instead.
	const baseline = aggregateRuns(sideOf([['a', 'cold', 100], ['b', 'cold', 100]]), 'baseline')
	const candidateRuns = sideOf([['a', 'cold', 94], ['b', 'cold', 100]])
	candidateRuns[0].libraries[0].results[1].medianOpsPerSecond = 300
	const result = compareResults(baseline, aggregateRuns(candidateRuns, 'candidate'), { groupTotals: new Map([['cold', 2]]) })
	assert.equal(result.groups[0].decisiveScenarios, 1)
	assert.ok(result.groups[0].delta <= -0.05, 'the fixture must put the group mean past the severe threshold')
	assert.deepEqual(result.severeGroups, [])
	assert.deepEqual(result.groupsWithoutTrigger, ['cold'])
	assert.notEqual(result.verdict, 'regression')
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
	assert.equal(result.schemaVersion, 7)
	assert.deepEqual(result.measurement, { isolation: 'cell', shardCount: 1, selection: ['a', 'b'] })
	assert.match(renderMarkdown(result), /scoped to the diff/)
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
 * Five paired ratios with a chosen median and a chosen paired RME. The construction is
 * symmetric — `[m-a, m-b, m, m+b, m+a]` — so the median and the mean are both `m`, and
 * `(a² + b²)/2 = sd²` with `b = sd/2` fixes the spread. That makes a row's reported delta
 * and its interval both exactly what the test asks for, which is what lets these
 * expectations be read against the numbers the null runs actually produced.
 */
function ratiosWith(deltaPercent, rmePercent) {
	const centre = 1 + deltaPercent / 100
	const halfWidthPerSd = criticalValue(5) / Math.sqrt(5)
	const sd = rmePercent / 100 * Math.abs(centre) / halfWidthPerSd
	const b = sd / 2
	const a = Math.sqrt(1.75) * sd
	return [centre - a, centre - b, centre, centre + b, centre + a]
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
