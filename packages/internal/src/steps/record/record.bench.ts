import { bench, describe } from 'vitest'
import { createValchecker, number, record, string } from '../..'

const v = createValchecker({ steps: [number, record, string] })
const schema = v.record(v.string(), v.number())

describe('record benchmarks', () => {
	bench('valid input', () => schema.execute({ a: 1, b: 2 }))
	bench('invalid input', () => schema.execute({ a: 'x' }))
})
