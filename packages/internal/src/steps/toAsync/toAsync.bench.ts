/**
 * Benchmark plan for toAsync:
 * - Operations benchmarked: toAsync validation with various input types and sizes
 * - Input scenarios: sync/async valid inputs, failure results
 * - Comparison baselines: Native Promise.resolve where applicable
 */

import { bench, describe } from 'vitest'
import { createValchecker, string, toAsync, transform } from '../..'

const v = createValchecker({ steps: [string, transform, toAsync] })

describe('toAsync benchmarks', () => {
	describe('valid inputs', () => {
		bench('valid input - sync transform', async () => {
			await v.string()
				.transform((x: string) => x.toUpperCase())
				.toAsync()
				.execute('hello')
		})

		bench('valid input - async transform', async () => {
			await v.string()
				.transform(async (x: string) => x.toUpperCase())
				.toAsync()
				.execute('hello')
		})

		bench('valid input - large string', async () => {
			await v.string()
				.transform((x: string) => x.toUpperCase())
				.toAsync()
				.execute('a'.repeat(1000))
		})
	})

	describe('invalid inputs', () => {
		bench('invalid input - type error', async () => {
			await v.string()
				.toAsync()
				.execute(123)
		})
	})

	describe('baseline comparison', () => {
		bench('baseline - native Promise.resolve with sync', async () => {
			await Promise.resolve({ value: 'HELLO' })
		})

		bench('baseline - native Promise.resolve with async', async () => {
			await Promise.resolve(Promise.resolve({ value: 'HELLO' }))
		})
	})
})
