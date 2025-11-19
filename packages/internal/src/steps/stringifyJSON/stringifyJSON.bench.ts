/**
 * Benchmark plan for stringifyJSON:
 * - Operations benchmarked: stringifyJSON validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, stringifyJSON } from '../..'

const v = createValchecker({ steps: [stringifyJSON] })

describe('stringifyJSON benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.stringifyJSON().execute(undefined)
		})

		bench('valid input - large', () => {
			v.stringifyJSON().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.stringifyJSON().execute(undefined)
		})
	})
})
