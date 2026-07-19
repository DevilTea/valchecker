import { bench, describe } from 'vitest'
import { createValchecker, map, number, string, toMappedValues } from '../..'

const v = createValchecker({ steps: [map, number, string, toMappedValues] })
const success = v.map({ key: v.string(), value: v.number() })
	.toMappedValues(value => value * 2)
const failure = v.map({ key: v.string(), value: v.number() })
	.toMappedValues(() => { throw new Error('x') })
const input = new Map(Array.from({ length: 1000 }, (_, index) => [`key-${index}`, index] as const))

describe('toMappedValues benchmarks', () => {
	bench('success - large', () => {
		success.execute(input)
	})

	bench('callback failure', () => {
		failure.execute(new Map([['key', 1]]))
	})
})
