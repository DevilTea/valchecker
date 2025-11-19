/**
 * Benchmark plan for instance:
 * - Operations benchmarked: instance validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, instance } from '../..'

const v = createValchecker({ steps: [instance] })

describe('instance benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.instance(Object)
				.execute({})
		})

		bench('valid input - large', () => {
			v.instance(Object)
				.execute({ large: 'a'.repeat(1000) })
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.instance(Object)
				.execute('string')
		})
	})
})
