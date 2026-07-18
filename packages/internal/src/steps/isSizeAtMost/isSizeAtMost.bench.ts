import { bench, describe } from 'vitest'
import { createValchecker, isSizeAtMost, set, string } from '../..'

const v = createValchecker({ steps: [isSizeAtMost, set, string] })
const schema = v.set(v.string()).isSizeAtMost(1)
const valid = new Set(['value'])
const invalid = new Set(['a', 'b'])

describe('isSizeAtMost benchmarks', () => {
	bench('success', () => schema.execute(valid))
	bench('failure', () => schema.execute(invalid))
})
