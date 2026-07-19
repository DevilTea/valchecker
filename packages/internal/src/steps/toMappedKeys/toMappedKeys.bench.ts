import { bench, describe } from 'vitest'
import { createValchecker, map, number, string, toMappedKeys } from '../..'

const v = createValchecker({ steps: [map, number, string, toMappedKeys] })
const success = v.map({ key: v.string(), value: v.number() })
	.toMappedKeys(key => key.toUpperCase())
const failure = v.map({ key: v.string(), value: v.number() })
	.toMappedKeys(() => { throw new Error('x') })
const collision = v.map({ key: v.string(), value: v.number() })
	.toMappedKeys(() => 'same')
const input = new Map(Array.from({ length: 1000 }, (_, index) => [`key-${index}`, index] as const))

describe('toMappedKeys benchmarks', () => {
	bench('success - large', () => {
		success.execute(input)
	})

	bench('callback failure', () => {
		failure.execute(new Map([['key', 1]]))
	})

	bench('mapped-key collision', () => {
		collision.execute(new Map([['a', 1], ['b', 2]]))
	})
})
