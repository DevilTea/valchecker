import { bench, describe } from 'vitest'
import { createValchecker, isNonNullish, unknown } from '../..'

const v = createValchecker({ steps: [isNonNullish, unknown] })
const schema = v.unknown().isNonNullish()

describe('isNonNullish benchmarks', () => {
	bench('successful execution', () => {
		schema.execute('value')
	})

	bench('failed execution', () => {
		schema.execute(null)
	})
})
