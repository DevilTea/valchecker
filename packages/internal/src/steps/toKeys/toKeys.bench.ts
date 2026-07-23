import { bench, describe } from 'vitest'
import { createValchecker, map, number, string, toKeys } from '../..'

const v = createValchecker({ steps: [map, number, string, toKeys] })
const schema = v.map({ key: v.string(), value: v.number() })
	.toKeys()
const value = new Map(Array.from({ length: 1000 }, (_, index) => [`key-${index}`, index] as const))

describe('toKeys benchmarks', () => {
	bench('map keys to array', () => {
		schema.execute(value)
	})
})
