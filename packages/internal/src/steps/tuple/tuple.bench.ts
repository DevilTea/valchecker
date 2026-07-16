import { bench, describe } from 'vitest'
import { createValchecker, number, string, tuple } from '../..'

const v = createValchecker({ steps: [number, string, tuple] })
const schema = v.tuple([v.string(), v.number()] as const)

describe('tuple benchmarks', () => {
	bench('valid input', () => schema.execute(['a', 1]))
	bench('invalid input', () => schema.execute(['a', 'x']))
})
