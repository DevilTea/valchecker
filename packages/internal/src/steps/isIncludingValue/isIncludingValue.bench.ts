import { bench, describe } from 'vitest'
import { createValchecker, isIncludingValue, map, number, string } from '../..'

const v = createValchecker({ steps: [isIncludingValue, map, number, string] })
const schema = v.map({ key: v.string(), value: v.number() })
	.isIncludingValue(1)
const hit = new Map([['target', 1]])
const miss = new Map([['other', 2]])

describe('isIncludingValue benchmarks', () => {
	bench('hit', () => {
		schema.execute(hit)
	})
	bench('miss', () => {
		schema.execute(miss)
	})
})
