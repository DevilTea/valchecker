import { bench, describe } from 'vitest'
import { createValchecker, set, string, toSize } from '../..'

const v = createValchecker({ steps: [set, string, toSize] })
const schema = v.set(v.string()).toSize()
const value = new Set(['a', 'b', 'c'])

describe('toSize benchmarks', () => {
	bench('extract size', () => schema.execute(value))
})
