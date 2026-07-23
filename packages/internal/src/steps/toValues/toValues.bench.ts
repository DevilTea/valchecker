import { bench, describe } from 'vitest'
import { createValchecker, map, number, string, toValues } from '../..'

const v = createValchecker({ steps: [map, number, string, toValues] })
const schema = v.map({ key: v.string(), value: v.number() })
	.toValues()
const value = new Map(Array.from({ length: 1000 }, (_, index) => [`key-${index}`, index] as const))

describe('toValues benchmarks', () => {
	bench('map values to array', () => {
		schema.execute(value)
	})
})
