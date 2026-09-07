import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pairedCellRuns, pairedSideOrder } from './pairing.mjs'

test('odd repetitions measure candidate then baseline inside every cell pair', () => {
	assert.deepEqual(pairedSideOrder(1), ['candidate', 'baseline'])
	assert.deepEqual(
		pairedCellRuns([{ id: 'a' }, { id: 'b' }], 1)
			.map(({ cell, side }) => `${cell.id}:${side}`),
		['a:candidate', 'a:baseline', 'b:candidate', 'b:baseline'],
	)
})

test('even repetitions reverse each adjacent pair rather than the whole side', () => {
	assert.deepEqual(pairedSideOrder(2), ['baseline', 'candidate'])
	assert.deepEqual(
		pairedCellRuns([{ id: 'a' }, { id: 'b' }], 2)
			.map(({ cell, side }) => `${cell.id}:${side}`),
		['a:baseline', 'a:candidate', 'b:baseline', 'b:candidate'],
	)
})

test('a repetition must be a positive integer', () => {
	for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])
		assert.throws(() => pairedSideOrder(value), /positive safe integer/)
})
