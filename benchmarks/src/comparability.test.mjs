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
		profile: { warmupMs: 200, sampleMs: 300, minSamples: 5, maxSamples: 7, targetRelativeMarginOfError: 0.75 },
		shards: [{ index: 0, count: 1 }],
		...overrides,
	}
}

function identityOf(overrides) {
	return measurementIdentity(resultOf(overrides), 'run')
}

test('a result that does not record how it was measured has no identity', () => {
	assert.throws(() => measurementIdentity(resultOf({ schemaVersion: 3 }), 'baseline run 1'), /baseline run 1 has benchmark schema version 3, expected 4/)
	assert.throws(() => measurementIdentity(resultOf({ profile: undefined }), 'run'), /missing its measurement profile/)
	assert.throws(() => measurementIdentity(resultOf({ isolation: undefined }), 'run'), /missing its measurement isolation/)
	assert.throws(() => measurementIdentity(resultOf({ shards: undefined }), 'run'), /missing its shard record/)
	assert.throws(() => measurementIdentity(resultOf({ shards: [] }), 'run'), /missing its shard record/)
	assert.throws(() => measurementIdentity(resultOf({ shards: [{ index: 0, count: 0 }] }), 'run'), /invalid shard count/)
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
		['shardCount', { shards: [{ index: 0, count: 4 }, { index: 1, count: 4 }, { index: 2, count: 4 }, { index: 3, count: 4 }] }],
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
	const right = identityOf({ mode: 'smoke', isolation: 'adapter' })
	assert.deepEqual(identityDifferences(left, right), ['mode', 'isolation'])
	assert.deepEqual(identityDifferences(right, left), ['mode', 'isolation'])
})

test('a profile that dropped a field is not the same profile', () => {
	// A field removed rather than changed: the identity has to notice the absence,
	// because a run measured without a precision target is not one measured with one.
	const left = identityOf()
	const right = identityOf({ profile: { warmupMs: 200, sampleMs: 300, minSamples: 5, maxSamples: 7 } })
	assert.deepEqual(identityDifferences(left, right), ['profile'])
})
