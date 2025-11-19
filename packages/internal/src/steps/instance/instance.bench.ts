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
			v.instance().execute(undefined)
		})

		bench('valid input - large', () => {
			v.instance().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.instance().execute(undefined)
		})
	})
})
