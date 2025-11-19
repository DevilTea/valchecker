/**
 * Benchmark plan for boolean:
 * - Operations benchmarked: boolean validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { boolean, createValchecker } from '../..'

const v = createValchecker({ steps: [boolean] })

describe('boolean benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.boolean()
				.execute(true)
		})

		bench('valid input - large', () => {
			v.boolean()
				.execute(false)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.boolean()
				.execute('true')
		})
	})

	describe('baselines', () => {
		bench('native typeof check', () => {
			// eslint-disable-next-line ts/no-unused-expressions
			typeof true === 'boolean'
		})
	})
})
