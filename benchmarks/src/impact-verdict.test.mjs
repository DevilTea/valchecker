import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aggregateRuns, compareResults, groupTotalsOf, renderMarkdown } from './impact-verdict.mjs'

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
		stableScenarios: 5,
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

test('an unstable scenario does not count toward its group trigger', () => {
	// `b` measures a different number in one repetition, which widens its paired-ratio
	// interval past the 5% stability threshold. Two measured scenarios then leave one
	// stable one, and the trigger is reported as absent rather than as cleared.
	const baseline = aggregateRuns(sideOf([['a', 'cold', 100], ['b', 'cold', 100]]), 'baseline')
	const candidateRuns = sideOf([['a', 'cold', 100], ['b', 'cold', 100]])
	candidateRuns[0].libraries[0].results[1].medianOpsPerSecond = 300
	const result = compareResults(baseline, aggregateRuns(candidateRuns, 'candidate'), { groupTotals: new Map([['cold', 2]]) })
	assert.equal(result.groups[0].scenarios, 2)
	assert.equal(result.groups[0].stableScenarios, 1)
	assert.deepEqual(result.groupsWithoutTrigger, ['cold'])
})

test('one stable scenario cannot make its group severe on its own', () => {
	// `b` is unstable, so `cold`'s geometric mean rests on `a` alone at -6%: past the
	// group threshold, short of the per-scenario one. Calling that a severe *group*
	// regression would be one measurement wearing the authority of an aggregate, so the
	// verdict stays clear and the group is reported as having no trigger instead.
	const baseline = aggregateRuns(sideOf([['a', 'cold', 100], ['b', 'cold', 100]]), 'baseline')
	const candidateRuns = sideOf([['a', 'cold', 94], ['b', 'cold', 100]])
	candidateRuns[0].libraries[0].results[1].medianOpsPerSecond = 300
	const result = compareResults(baseline, aggregateRuns(candidateRuns, 'candidate'), { groupTotals: new Map([['cold', 2]]) })
	assert.equal(result.groups[0].stableScenarios, 1)
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
	assert.equal(result.schemaVersion, 6)
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
