/**
 * Benchmark plan for toTrimmed:
 * - Operations benchmarked: toTrimmed validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, string, toTrimmed } from '../..'

const v = createValchecker({ steps: [string, toTrimmed] })

describe('toTrimmed benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.string()
				.toTrimmed()
				.execute('  hello  ')
		})

		bench('valid input - large', () => {
			v.string()
				.toTrimmed()
				.execute(`  ${'x'.repeat(1000)}  `)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.string()
				.toTrimmed()
				.execute(123)
		})
	})
})
