import assert from 'node:assert/strict'
import { test } from 'node:test'
import { acceptedBundleBytesForBase, acceptedBundleRegressions } from './accepted-bundle-regressions.mjs'

test('bundle acknowledgements are pinned to the exact historical base', () => {
	const [entry] = acceptedBundleRegressions
	assert.ok(entry)
	assert.ok(entry.because.length >= 200)
	assert.deepEqual(
		[...acceptedBundleBytesForBase(entry.baseCommit)
			.entries()],
		entry.scenarios.map(scenario => [scenario, entry.maxIncreaseBytes]),
	)
	assert.equal(acceptedBundleBytesForBase('future-main').size, 0)
})
