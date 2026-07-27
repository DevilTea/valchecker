import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isSeparated, separationThresholdPercent } from './separation.mjs'

/**
 * The rule decides which orderings the report is willing to claim, so what
 * matters is that it sits exactly on its documented threshold and stays
 * asymmetric: the caller has already put the faster measurement first.
 */

test('the threshold is the gap the evidence supports', () => {
	assert.equal(separationThresholdPercent, 5)
})

test('separation is decided at the threshold, against the slower value', () => {
	// 5% of 1000 is 50, so 1050 is separated and 1049 is not.
	assert.equal(isSeparated(1050, 1000), true)
	assert.equal(isSeparated(1049.9, 1000), false)
	assert.equal(isSeparated(1000, 1000), false)
})

test('an equal or slower first argument is never separated', () => {
	// Rows arrive ordered, so this only happens when a caller passes them the
	// wrong way round; reporting "separated" then would invert a ranking.
	assert.equal(isSeparated(1000, 1050), false)
	assert.equal(isSeparated(0, 1000), false)
})

test('a zero or missing slower value cannot establish a gap', () => {
	assert.equal(isSeparated(1000, 0), false)
	assert.equal(isSeparated(1000, Number.NaN), false)
})
