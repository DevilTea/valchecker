/**
 * Benchmark plan for tuple:
 * - Operations benchmarked: schema construction and positional array execution
 * - Input scenarios: fixed success, rest-region success, length failure, element failure
 * - Comparison baseline: native array copy
 */

import { bench, describe } from 'vitest'
import { array, boolean, createValchecker, number, string, tuple } from '../..'

const v = createValchecker({ steps: [tuple, array, boolean, number, string] })
const fixed = v.tuple([v.string(), v.number(), v.boolean()])
const withRest = v.tuple([v.string(), '...', v.array(v.number())])
const fixedInput = ['a', 1, true]
const restInput = ['a', 1, 2, 3, 4, 5]

describe('tuple benchmarks', () => {
	describe('schema construction', () => {
		bench('construct fixed tuple schema', () => {
			v.tuple([v.string(), v.number(), v.boolean()])
		})
		bench('construct rest tuple schema', () => {
			v.tuple([v.string(), '...', v.array(v.number())])
		})
	})

	describe('execution', () => {
		bench('fixed - success', () => {
			fixed.execute(fixedInput)
		})
		bench('rest - success', () => {
			withRest.execute(restInput)
		})
		bench('fixed - length failure', () => {
			fixed.execute(['a', 1])
		})
		bench('fixed - element failure', () => {
			fixed.execute(['a', 'x', true])
		})
	})

	describe('baseline', () => {
		bench('native array copy', () => {
			void [...fixedInput]
		})
	})
})
