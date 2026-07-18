import { bench, describe } from 'vitest'
import { createValchecker, isIncludingKey, map, number, string } from '../..'

const v = createValchecker({ steps: [isIncludingKey, map, number, string] })
const schema = v.map({ key: v.string(), value: v.number() }).isIncludingKey('target')
const hit = new Map([['target', 1]])
const miss = new Map([['other', 1]])

describe('isIncludingKey benchmarks', () => {
	bench('hit', () => schema.execute(hit))
	bench('miss', () => schema.execute(miss))
})
