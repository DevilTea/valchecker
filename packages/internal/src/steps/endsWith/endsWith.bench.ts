/**
 * Benchmark plan for endsWith:
 * - Operations benchmarked: endsWith validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, endsWith, string } from '../..'

const v = createValchecker({ steps: [endsWith, string] })

describe('endsWith benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.string()
				.endsWith('world')
				.execute('hello world')
		})

		bench('valid input - large', () => {
			v.string()
				.endsWith('end')
				.execute(`${'a'.repeat(1000)}end`)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.string()
				.endsWith('world')
				.execute('hello')
		})
	})
})
