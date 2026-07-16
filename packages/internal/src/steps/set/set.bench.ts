import { bench, describe } from 'vitest'
import { createValchecker, set, string } from '../..'

const v = createValchecker({ steps: [set, string] })
const schema = v.set(v.string())

describe('set benchmarks', () => {
	bench('valid input', () => schema.execute(new Set(['a', 'b'])))
	bench('invalid input', () => schema.execute(new Set(['a', 1])))
})
