/**
 * Benchmark plan for strictObject:
 * - Operations benchmarked: strictObject validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, strictObject } from '../..'

const v = createValchecker({ steps: [strictObject] })

describe('strictObject benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.strictObject({}).execute({})
		})

		bench('valid input - large', () => {
			v.strictObject({}).execute(Object.fromEntries(Array.from({ length: 100 }, (_, i) => [i, i])))
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.strictObject({}).execute({ extra: 'field' })
		})
	})
})
