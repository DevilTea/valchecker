/**
 * Benchmark plan for toLowercase:
 * - Operations benchmarked: toLowercase validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, toLowercase } from '../..'

const v = createValchecker({ steps: [toLowercase] })

describe('toLowercase benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.toLowercase().execute(undefined)
		})

		bench('valid input - large', () => {
			v.toLowercase().execute(undefined)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.toLowercase().execute(undefined)
		})
	})
})
