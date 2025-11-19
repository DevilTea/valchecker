/**
 * Benchmark plan for json:
 * - Operations benchmarked: json validation with various input types and sizes
 * - Input scenarios: small/large valid inputs, invalid inputs
 * - Comparison baselines: Native checks where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, json, string } from '../..'

const v = createValchecker({ steps: [json, string] })

describe('json benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - small', () => {
			v.string()
				.json()
				.execute('{}')
		})

		bench('valid input - large', () => {
			v.string()
				.json()
				.execute(JSON.stringify({ large: 'a'.repeat(1000) }))
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input', () => {
			v.string()
				.json()
				.execute('invalid json')
		})
	})
})
