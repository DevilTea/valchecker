import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertComparable, identityDifferences, measurementIdentity, supportedSchemaVersion } from './comparability.mjs'

/**
 * The guard that decides whether a before/after difference is attributable to the
 * change under test. Every case here is two hand-built results differing in
 * exactly one field, so a rule that stopped reading a field fails on that field
 * rather than somewhere downstream. Nothing is compared against a value the guard
 * produced.
 */

function resultOf(overrides = {}) {
	return {
		schemaVersion: supportedSchemaVersion,
		mode: 'standard',
		isolation: 'cell',
		temporalPairing: 'none',
		scenarioRoles: null,
		profile: { warmupMs: 200, sampleMs: 300, minSamples: 5, maxSamples: 7, targetRelativeMarginOfError: 0.75 },
		shards: [{ index: 0, count: 1 }],
		scenarioFilter: null,
		...overrides,
	}
}

function identityOf(overrides) {
	return measurementIdentity(resultOf(overrides), 'run')
}

test('a result that does not record how it was measured has no identity', () => {
	assert.throws(() => measurementIdentity(resultOf({ schemaVersion: 3 }), 'baseline run 1'), /baseline run 1 has benchmark schema version 3, expected 5/)
	assert.throws(() => measurementIdentity(resultOf({ profile: undefined }), 'run'), /missing its measurement profile/)
	assert.throws(() => measurementIdentity(resultOf({ isolation: undefined }), 'run'), /missing its measurement isolation/)
	assert.throws(() => measurementIdentity(resultOf({ temporalPairing: undefined }), 'run'), /unknown temporal pairing mode/)
	assert.throws(() => measurementIdentity(resultOf({ scenarioRoles: undefined }), 'run'), /valid scenario roles/)
	assert.throws(() => measurementIdentity(resultOf({ shards: undefined }), 'run'), /missing its shard record/)
	assert.throws(() => measurementIdentity(resultOf({ shards: [] }), 'run'), /missing its shard record/)
	assert.throws(() => measurementIdentity(resultOf({ shards: [{ index: 0, count: 0 }] }), 'run'), /invalid shard count/)
	assert.throws(() => measurementIdentity(resultOf({ scenarioFilter: undefined }), 'run'), /does not record which scenarios it measured/)
})

test('the scenario selection is part of the identity', () => {
	// The impact gate scopes a pull-request run to its diff, so two runs of the same
	// profile can now measure different scenario sets. Their per-scenario rows would
	// still be comparable under cell isolation; their group geometric means would not,
	// because a mean is over whatever ran.
	const whole = identityOf()
	const scoped = identityOf({ scenarioFilter: ['primitive/valid', 'flat-object/valid'] })
	assert.deepEqual(identityDifferences(whole, scoped), ['selection'])
	assert.throws(
		() => assertComparable(whole, scoped, 'Baseline and candidate'),
		/they differ in selection — a group aggregate is a geometric mean over the scenarios that ran/,
	)
})

test('the same selection written in another order is the same selection', () => {
	const left = identityOf({ scenarioFilter: ['primitive/valid', 'flat-object/valid'] })
	const right = identityOf({ scenarioFilter: ['flat-object/valid', 'primitive/valid'] })
	assert.deepEqual(identityDifferences(left, right), [])
})

test('a filter naming every scenario is not the same as no filter', () => {
	// `null` keeps meaning "the whole tier" as the suite grows; a list that happens to
	// name today's whole tier does not.
	const left = identityOf()
	const right = identityOf({ scenarioFilter: ['primitive/valid'] })
	assert.deepEqual(identityDifferences(left, right), ['selection'])
})

test('a run with no cell catalog is the same kind of measurement as another with none', () => {
	// The cross-library scenario suite has no cell catalog, and comparing two of its runs
	// must not become a refusal because the field is absent from both.
	assert.deepEqual(identityDifferences(identityOf(), identityOf()), [])
	assert.equal(identityOf().cellCatalogHash, null)
	assert.equal(identityOf({ cellCatalogHash: 'abc123abc123abc1' }).cellCatalogHash, 'abc123abc123abc1')
})

test('a run carrying only some of its shards is not a run', () => {
	// Four shards were declared and one file is present: the numbers describe a
	// quarter of the scenarios and would otherwise be compared as if they were all.
	assert.throws(() => measurementIdentity(resultOf({ shards: [{ index: 0, count: 4 }] }), 'candidate'), /candidate carries 1 of its 4 shards/)
})

test('two runs measured the same way have no differences', () => {
	assert.deepEqual(identityDifferences(identityOf(), identityOf()), [])
	assert.doesNotThrow(() => assertComparable(identityOf(), identityOf(), 'Baseline and candidate'))
})

test('the profile is compared by content, not by key order', () => {
	// The same five fields written in two orders. A comparison sensitive to insertion
	// order would refuse two runs of the same profile.
	const reordered = { targetRelativeMarginOfError: 0.75, maxSamples: 7, minSamples: 5, sampleMs: 300, warmupMs: 200 }
	assert.deepEqual(identityDifferences(identityOf(), identityOf({ profile: reordered })), [])
})

test('each identity field is a refusal on its own, and is named', () => {
	for (const [field, overrides] of [
		['mode', { mode: 'full' }],
		['profile', { profile: { warmupMs: 200, sampleMs: 300, minSamples: 5, maxSamples: 12, targetRelativeMarginOfError: 0.75 } }],
		['isolation', { isolation: 'adapter' }],
		['temporalPairing', { temporalPairing: 'adjacent-cell' }],
		['scenarioRoles', { scenarioRoles: { 'primitive/valid': 'affected' } }],
		['shardCount', { shards: [{ index: 0, count: 4 }, { index: 1, count: 4 }, { index: 2, count: 4 }, { index: 3, count: 4 }] }],
		// The cell catalog is the apparatus: it decides the run order and every group
		// denominator, and it is recorded rather than re-derived, so a run measured against
		// another catalog has to be refused here rather than compared cell by cell.
		['cellCatalogHash', { cellCatalogHash: '0123456789abcdef' }],
	]) {
		const left = identityOf()
		const right = identityOf(overrides)
		assert.deepEqual(identityDifferences(left, right), [field])
		assert.throws(
			() => assertComparable(left, right, 'Baseline and candidate'),
			new RegExp(`Baseline and candidate were measured differently and cannot be compared — they differ in ${field} — .`),
			`${field} was accepted`,
		)
	}
})

test('several differences are all reported, in a stable order', () => {
	const left = identityOf()
	const right = identityOf({ mode: 'smoke', isolation: 'adapter', temporalPairing: 'adjacent-cell', scenarioRoles: { a: 'affected' } })
	assert.deepEqual(identityDifferences(left, right), ['mode', 'isolation', 'temporalPairing', 'scenarioRoles'])
	assert.deepEqual(identityDifferences(right, left), ['mode', 'isolation', 'temporalPairing', 'scenarioRoles'])
})

test('a profile that dropped a field is not the same profile', () => {
	// A field removed rather than changed: the identity has to notice the absence,
	// because a run measured without a precision target is not one measured with one.
	const left = identityOf()
	const right = identityOf({ profile: { warmupMs: 200, sampleMs: 300, minSamples: 5, maxSamples: 7 } })
	assert.deepEqual(identityDifferences(left, right), ['profile'])
})
