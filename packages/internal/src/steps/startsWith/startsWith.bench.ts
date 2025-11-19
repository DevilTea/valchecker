/**
 * Benchmark plan for startsWith:
 * - Operations benchmarked: startsWith validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, startsWith, string } from '../..'

const v = createValchecker({ steps: [startsWith, string] })

describe('startsWith benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.string()
				.startsWith('hello')
				.execute('hello world')
		})

		bench('valid input - large', () => {
			v.string()
				.startsWith('start')
				.execute(`start${'a'.repeat(1000)}`)
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.string()
				.startsWith('hello')
				.execute('world')
		})
	})
})
