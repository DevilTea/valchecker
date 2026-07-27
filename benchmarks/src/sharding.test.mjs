import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertShardSelector, interleaveShards, mergeShardResults, selectShardScenarios } from './sharding.mjs'

/**
 * Sharding decides which machine measured which number, so these check the ways
 * that record can lie: an assignment that is not reproducible, a merge that loses
 * or duplicates a scenario, a merge that presents shards of two different runs as
 * one, and a merged file that claims to be complete when a shard is missing.
 *
 * Every expectation here is written out from the input, never computed with the
 * function under test. The round-trip test is the one place a computed value
 * appears, and its expectation is the original list — which is the point of it.
 */

const scenarios = ['a', 'b', 'c', 'd', 'e', 'f', 'g']

test('a scenario belongs to the shard its position selects', () => {
	// Positions 0..6 over three shards: 0,1,2,0,1,2,0.
	assert.deepEqual(selectShardScenarios(scenarios, 0, 3), ['a', 'd', 'g'])
	assert.deepEqual(selectShardScenarios(scenarios, 1, 3), ['b', 'e'])
	assert.deepEqual(selectShardScenarios(scenarios, 2, 3), ['c', 'f'])
})

test('one shard is the whole selection, unchanged and in order', () => {
	assert.deepEqual(selectShardScenarios(scenarios, 0, 1), scenarios)
})

test('the assignment is a partition: every scenario once, no scenario twice', () => {
	for (const count of [1, 2, 3, 4, 5, 7, 9]) {
		const shards = Array.from({ length: count }, (_, index) => selectShardScenarios(scenarios, index, count))
		const flat = shards.flat()
		assert.equal(flat.length, scenarios.length, `count ${count} changed the total`)
		assert.equal(new Set(flat).size, scenarios.length, `count ${count} duplicated a scenario`)
	}
})

test('interleaving the shards restores the original order', () => {
	// The expectation is the input list itself, which is what invertibility means:
	// the merge tool reconstructs the run order without consulting the registry.
	for (const count of [1, 2, 3, 4, 5, 7, 9]) {
		const shards = Array.from({ length: count }, (_, index) => selectShardScenarios(scenarios, index, count))
		assert.deepEqual(interleaveShards(shards), scenarios, `count ${count}`)
	}
})

test('an out-of-range shard selector is refused', () => {
	assert.throws(() => assertShardSelector(0, 0), /positive integer/)
	assert.throws(() => assertShardSelector(0, -1), /positive integer/)
	assert.throws(() => assertShardSelector(0, 2.5), /positive integer/)
	assert.throws(() => assertShardSelector(3, 3), /\[0, 3\)/)
	assert.throws(() => assertShardSelector(-1, 3), /\[0, 3\)/)
	assert.throws(() => assertShardSelector(1.5, 3), /\[0, 3\)/)
})

function environmentOf(runner, overrides = {}) {
	return {
		node: 'v24.0.0',
		platform: 'linux',
		arch: 'x64',
		cpu: runner === 'runner-a' ? 'AMD EPYC 7763' : 'Intel Xeon Platinum 8370C',
		logicalCpuCount: 4,
		totalMemoryBytes: 16_000_000_000,
		commit: 'abc123',
		runnerName: runner,
		runnerImageOS: 'Ubuntu',
		runnerImageVersion: '24.04',
		...overrides,
	}
}

/** One shard result, carrying only the fields the merge reads. */
function shardResult({ index, count, ids, runner, startedAt, completedAt, environment = environmentOf(runner), ...overrides }) {
	return {
		schemaVersion: 4,
		mode: 'standard',
		seed: 'fixed-seed',
		scenarioFilter: null,
		isolation: 'cell',
		startedAt,
		completedAt,
		profile: { warmupMs: 200, sampleMs: 300, minSamples: 5, maxSamples: 7, targetRelativeMarginOfError: 0.75 },
		environment,
		shards: [{ index, count, scenarios: ids, startedAt, completedAt, environment }],
		order: ['valchecker', 'valibot'],
		scenarioCatalog: ids.map(id => ({ id, group: 'warm/success' })),
		libraries: [
			{
				adapter: 'valchecker',
				name: 'Valchecker',
				version: 'workspace',
				capabilities: { generatedCode: false },
				verifiedScenarios: ids.length,
				totalScenarios: ids.length,
				skippedScenarios: [],
				results: ids.map(id => ({ scenario: id, medianOpsPerSecond: 1000 })),
			},
			{
				adapter: 'valibot',
				name: 'Valibot',
				version: '1.4.2',
				capabilities: { generatedCode: false },
				verifiedScenarios: ids.length - 1,
				totalScenarios: ids.length,
				skippedScenarios: [{ scenario: ids.at(-1), reason: 'no equivalent' }],
				results: ids.slice(0, -1)
					.map(id => ({ scenario: id, medianOpsPerSecond: 900 })),
			},
		],
		...overrides,
	}
}

/** Positions 0..3 over two shards: shard 0 takes a and c, shard 1 takes b and d. */
function twoShards() {
	return [
		shardResult({ index: 0, count: 2, ids: ['a', 'c'], runner: 'runner-a', startedAt: '2026-07-28T10:00:00Z', completedAt: '2026-07-28T10:20:00Z' }),
		shardResult({ index: 1, count: 2, ids: ['b', 'd'], runner: 'runner-b', startedAt: '2026-07-28T09:58:00Z', completedAt: '2026-07-28T10:14:00Z' }),
	]
}

test('merging restores the run order and accounts for every scenario once', () => {
	const merged = mergeShardResults(twoShards())
	assert.deepEqual(merged.scenarioCatalog.map(scenario => scenario.id), ['a', 'b', 'c', 'd'])
	for (const library of merged.libraries)
		assert.deepEqual(library.results.map(result => result.scenario), library.adapter === 'valchecker' ? ['a', 'b', 'c', 'd'] : ['a', 'b'])
	const valibot = merged.libraries.find(library => library.adapter === 'valibot')
	assert.deepEqual(valibot.skippedScenarios.map(item => item.scenario), ['c', 'd'])
	assert.equal(valibot.verifiedScenarios, 2)
	assert.equal(valibot.totalScenarios, 4)
})

test('merging accepts the shards in any argument order', () => {
	const [first, second] = twoShards()
	assert.deepEqual(mergeShardResults([second, first]).scenarioCatalog.map(scenario => scenario.id), ['a', 'b', 'c', 'd'])
})

test('the merged run spans the shards in time and keeps each shard machine', () => {
	const merged = mergeShardResults(twoShards())
	// Shard 1 started first and shard 0 finished last, so neither shard's own window
	// is the run's window.
	assert.equal(merged.startedAt, '2026-07-28T09:58:00Z')
	assert.equal(merged.completedAt, '2026-07-28T10:20:00Z')
	assert.deepEqual(merged.shards.map(shard => shard.index), [0, 1])
	assert.deepEqual(merged.shards.map(shard => shard.environment.runnerName), ['runner-a', 'runner-b'])
	assert.equal(merged.environment.runnerName, 'runner-a')
	assert.equal(merged.isolation, 'cell')
})

test('an incomplete set of shards is not a run', () => {
	const [first] = twoShards()
	assert.throws(() => mergeShardResults([first]), /shard 1 is missing/)
})

test('two copies of one shard are not two shards', () => {
	const [first] = twoShards()
	assert.throws(() => mergeShardResults([first, structuredClone(first)]), /indices must be distinct/)
})

test('shards that overlap on a scenario are refused', () => {
	const [first, second] = twoShards()
	second.shards[0].scenarios = ['a', 'd']
	second.scenarioCatalog = [{ id: 'a', group: 'warm/success' }, { id: 'd', group: 'warm/success' }]
	assert.throws(() => mergeShardResults([first, second]), /disjoint/)
})

test('an already-merged result is not a shard', () => {
	const merged = mergeShardResults(twoShards())
	assert.throws(() => mergeShardResults([merged]), /exactly one shard/)
})

test('shards of different runs are refused, naming the field that differs', () => {
	for (const [field, mutate] of [
		['mode', raw => raw.mode = 'full'],
		['seed', raw => raw.seed = 'other-seed'],
		['isolation', raw => raw.isolation = 'adapter'],
		['profile', raw => raw.profile.maxSamples = 12],
		['order', raw => raw.order = ['valibot', 'valchecker']],
		['scenarioFilter', raw => raw.scenarioFilter = ['primitive/valid']],
		['schemaVersion', raw => raw.schemaVersion = 3],
	]) {
		const shards = twoShards()
		mutate(shards[1])
		assert.throws(() => mergeShardResults(shards), new RegExp(`different ${field}`), `${field} was accepted`)
	}
})

test('shards that disagree about a library are refused', () => {
	const shards = twoShards()
	shards[1].libraries[1].version = '1.4.1'
	assert.throws(() => mergeShardResults(shards), /different valibot version/)

	const missing = twoShards()
	missing[1].libraries = [missing[1].libraries[0]]
	assert.throws(() => mergeShardResults(missing), /did not measure valibot/)
})

test('shards that disagree about the count are refused', () => {
	const shards = twoShards()
	shards[1].shards[0].count = 3
	assert.throws(() => mergeShardResults(shards), /reports a count of 3/)
})

/**
 * The workflow can rerun one failed shard, so a merge can be handed shards produced
 * from two builds or on two Node versions. Neither is visible in the merged file — the
 * top-level environment is shard 0's — and both change what every number in the
 * rerun shard means, so the merge is where they have to be caught. Only the machine
 * may differ, which `twoShards` exercises by giving the two shards different CPUs.
 */
test('shards built from different commits or run on different Node versions are refused', () => {
	for (const [field, value] of [['commit', 'def456'], ['node', 'v22.0.0']]) {
		const shards = twoShards()
		shards[1].environment = environmentOf('runner-b', { [field]: value })
		shards[1].shards[0].environment = shards[1].environment
		assert.throws(() => mergeShardResults(shards), new RegExp(`different environment ${field}`), `${field} was accepted`)
	}
})

/**
 * `interleaveShards` reads the shard catalogs row by row, which is only the run order
 * if the shards really are a positional round-robin split of one selection. Sizes that
 * no `p % count` assignment could produce mean they are not, and the reordering it
 * would produce is a catalog `report` accepts and presents as the run order.
 */
test('shard sizes no round-robin split could produce are refused', () => {
	// Shard 1 larger than shard 0: `p % 2` gives position 0 to shard 0, so shard 0 is
	// never the smaller of the two.
	const uneven = [
		shardResult({ index: 0, count: 2, ids: ['a'], runner: 'runner-a', startedAt: '2026-07-28T10:00:00Z', completedAt: '2026-07-28T10:20:00Z' }),
		shardResult({ index: 1, count: 2, ids: ['b', 'c'], runner: 'runner-b', startedAt: '2026-07-28T10:00:00Z', completedAt: '2026-07-28T10:20:00Z' }),
	]
	assert.throws(() => mergeShardResults(uneven), /never gives a later shard more scenarios/)

	// Two apart in the other direction, which is the shape of a shard rerun against a
	// changed scenario selection.
	const lopsided = [
		shardResult({ index: 0, count: 2, ids: ['a', 'c', 'e'], runner: 'runner-a', startedAt: '2026-07-28T10:00:00Z', completedAt: '2026-07-28T10:20:00Z' }),
		shardResult({ index: 1, count: 2, ids: ['b'], runner: 'runner-b', startedAt: '2026-07-28T10:00:00Z', completedAt: '2026-07-28T10:20:00Z' }),
	]
	assert.throws(() => mergeShardResults(lopsided), /differ by more than one scenario/)

	// One scenario more in shard 0 is the ordinary uneven split and must still merge.
	const legitimate = [
		shardResult({ index: 0, count: 2, ids: ['a', 'c'], runner: 'runner-a', startedAt: '2026-07-28T10:00:00Z', completedAt: '2026-07-28T10:20:00Z' }),
		shardResult({ index: 1, count: 2, ids: ['b'], runner: 'runner-b', startedAt: '2026-07-28T10:00:00Z', completedAt: '2026-07-28T10:20:00Z' }),
	]
	assert.deepEqual(mergeShardResults(legitimate).scenarioCatalog.map(scenario => scenario.id), ['a', 'b', 'c'])
})

test('a shard whose recorded scenario list is not its catalog is refused', () => {
	const shards = twoShards()
	shards[1].shards[0].scenarios = ['d', 'b']
	assert.throws(() => mergeShardResults(shards), /not its catalog/)
})

test('merging nothing is not a run', () => {
	assert.throws(() => mergeShardResults([]), /at least one shard/)
	assert.throws(() => mergeShardResults([null]), /not a benchmark result/)
})

test('a single unsharded result merges to itself', () => {
	const one = shardResult({ index: 0, count: 1, ids: ['a', 'b'], runner: 'runner-a', startedAt: '2026-07-28T10:00:00Z', completedAt: '2026-07-28T10:20:00Z' })
	const merged = mergeShardResults([structuredClone(one)])
	assert.deepEqual(merged, one)
})
