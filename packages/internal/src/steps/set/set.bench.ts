/**
 * Benchmark plan for set:
 * - Operations benchmarked: schema construction and Set item execution
 * - Input scenarios: small/large success, recoverable failure, transformed-item collision
 * - Comparison baseline: native Set copy
 */

import { bench, describe } from 'vitest'
import { createValchecker, set, string, transform } from '../..'

const v = createValchecker({ steps: [set, string, transform] })
const schema = v.set(v.string())
const transformed = v.set(v.string().transform(value => value.toLowerCase()))
const small = new Set(['a', 'b', 'c'])
const large = new Set(Array.from({ length: 1000 }, (_, index) => `item-${index}`))

describe('set benchmarks', () => {
	describe('schema construction', () => {
		bench('construct set schema', () => {
			v.set(v.string())
		})
	})

	describe('execution', () => {
		bench('valid input - small', () => {
			schema.execute(small)
		})

		bench('valid input - large', () => {
			schema.execute(large)
		})

		bench('recoverable item failures', () => {
			schema.execute(new Set<unknown>(['ok', 1, 2]))
		})

		bench('transformed item collision', () => {
			transformed.execute(new Set(['A', 'a']))
		})
	})

	describe('baseline', () => {
		bench('native Set copy', () => {
			new Set(small)
		})
	})
})
