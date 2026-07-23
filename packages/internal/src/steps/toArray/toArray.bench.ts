import { bench, describe } from 'vitest'
import { createValchecker, set, string, toArray } from '../..'

const v = createValchecker({ steps: [set, string, toArray] })
const schema = v.set(v.string())
	.toArray()
const value = new Set(Array.from({ length: 1000 }, (_, index) => `item-${index}`))

describe('toArray benchmarks', () => {
	bench('set to array', () => {
		schema.execute(value)
	})
})
