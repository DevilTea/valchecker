import { bench, describe } from 'vitest'
import { createValchecker, isSizeAtLeast, set, string } from '../..'

const v = createValchecker({ steps: [isSizeAtLeast, set, string] })
const schema = v.set(v.string())
	.isSizeAtLeast(1)
const valid = new Set(['value'])
const invalid = new Set<string>()

describe('isSizeAtLeast benchmarks', () => {
	bench('success', () => {
		schema.execute(valid)
	})
	bench('failure', () => {
		schema.execute(invalid)
	})
})
