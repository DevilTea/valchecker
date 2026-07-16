import { bench, describe } from 'vitest'
import { createValchecker, map, number, string } from '../..'

const v = createValchecker({ steps: [map, number, string] })
const schema = v.map(v.string(), v.number())

describe('map benchmarks', () => {
	bench('valid input', () => schema.execute(new Map([['a', 1]])))
	bench('invalid input', () => schema.execute(new Map([[1, 'x']])))
})
