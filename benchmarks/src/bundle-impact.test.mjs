import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compareBundleImpact, meaningfulBundleRegression } from './bundle-impact.mjs'

const result = (id, brotliBytes) => ({ id, brotliBytes })

test('bundle impact compares candidate bytes directly with base', () => {
	const impact = compareBundleImpact(
		[result('selective', 1000), result('default', 5000)],
		[result('selective', 1100), result('default', 5100)],
	)
	assert.equal(meaningfulBundleRegression, 0.05)
	assert.deepEqual(impact.rows.map(row => [row.id, row.baseBrotliBytes, row.candidateBrotliBytes, row.deltaBytes, Number(row.delta.toFixed(3)), row.classification]), [
		['selective', 1000, 1100, 100, 0.1, 'regression'],
		['default', 5000, 5100, 100, 0.02, 'within-threshold'],
	])
	assert.equal(impact.verdict, 'regression')
	assert.deepEqual(impact.regressions, ['selective'])
})

test('a broad shared regression cannot stay healthy because relative current-build relationships are unchanged', () => {
	const base = [result('selective', 2754), result('default', 16775), result('full', 16807)]
	const candidate = [result('selective', 11052), result('default', 25191), result('full', 25100)]
	const impact = compareBundleImpact(base, candidate)
	assert.equal(impact.verdict, 'regression')
	assert.equal(impact.rows.find(row => row.id === 'selective').classification, 'regression')
	assert.ok(impact.rows.find(row => row.id === 'selective').delta > 3)
})

test('small changes are still reported exactly without becoming a blocking regression', () => {
	const impact = compareBundleImpact([result('a', 1000)], [result('a', 1049)])
	assert.equal(impact.verdict, 'neutral')
	assert.equal(impact.rows[0].deltaBytes, 49)
	assert.equal(impact.rows[0].classification, 'within-threshold')
})

test('bundle impact refuses missing rows, zero baselines, and invalid thresholds', () => {
	assert.throws(() => compareBundleImpact([result('a', 1)], []), /missing base scenario a/)
	assert.throws(() => compareBundleImpact([result('a', 0)], [result('a', 1)]), /positive Brotli sizes/)
	assert.throws(() => compareBundleImpact([result('a', 1)], [result('a', 1)], -1), /non-negative finite/)
})
