import { bench, describe } from 'vitest'
import { createValchecker, map, number, string, toEntries } from '../..'

const v = createValchecker({ steps: [map, number, string, toEntries] })
const schema = v.map({ key: v.string(), value: v.number() }).toEntries()
const value = new Map(Array.from({ length: 1000 }, (_, index) => [`key-${index}`, index] as const))

describe('toEntries benchmarks', () => {
	bench('Map entries to array', () => schema.execute(value))
})
