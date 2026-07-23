import { bench, describe } from 'vitest'
import { createValchecker, isNonNull, unknown } from '../..'

const v = createValchecker({ steps: [isNonNull, unknown] })
const schema = v.unknown()
	.isNonNull()

describe('isNonNull benchmarks', () => {
	bench('successful execution', () => {
		schema.execute('value')
	})

	bench('failed execution', () => {
		schema.execute(null)
	})
})
