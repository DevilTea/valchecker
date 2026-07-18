/**
 * Benchmark plan for map:
 * - Operations benchmarked: schema construction and Map entry execution
 * - Input scenarios: small/large success, recoverable failure, transformed-key collision
 * - Comparison baseline: native Map iteration
 */

import { bench, describe } from 'vitest'
import { createValchecker, map, number, string, transform } from '../..'

const v = createValchecker({ steps: [map, number, string, transform] })
const schema = v.map({ key: v.string(), value: v.number() })
const transformed = v.map({
	key: v.string().transform(value => value.toLowerCase()),
	value: v.number(),
})
const small = new Map([['a', 1], ['b', 2], ['c', 3]])
const large = new Map(Array.from({ length: 1000 }, (_, index) => [`key-${index}`, index] as const))

describe('map benchmarks', () => {
	describe('schema construction', () => {
		bench('construct map schema', () => {
			v.map({ key: v.string(), value: v.number() })
		})
	})

	describe('execution', () => {
		bench('valid input - small', () => {
			schema.execute(small)
		})

		bench('valid input - large', () => {
			schema.execute(large)
		})

		bench('recoverable key and value failures', () => {
			schema.execute(new Map<unknown, unknown>([[1, 'x'], ['ok', 'y']]))
		})

		bench('transformed key collision', () => {
			transformed.execute(new Map([['A', 1], ['a', 2]]))
		})
	})

	describe('baseline', () => {
		bench('native Map copy', () => {
			new Map(small)
		})
	})
})
