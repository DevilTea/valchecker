/**
 * Benchmark plan for looseObject:
 * - Operations benchmarked: looseObject validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, looseObject } from '../..'

const v = createValchecker({ steps: [looseObject] })

describe('looseObject benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.looseObject({})
				.execute({})
		})

		bench('valid input - large', () => {
			v.looseObject({})
				.execute({ large: 'a'.repeat(1000) })
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.looseObject({})
				.execute('string')
		})
	})
})
