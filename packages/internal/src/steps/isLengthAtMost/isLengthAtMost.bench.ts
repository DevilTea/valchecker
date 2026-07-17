import { bench, describe } from 'vitest'
import { createValchecker, isLengthAtMost, string } from '../..'

const schema = createValchecker({ steps: [string, isLengthAtMost] }).string().isLengthAtMost(10)

describe('isLengthAtMost benchmarks', () => {
	bench('length success', () => {
		schema.execute('value')
	})
})
