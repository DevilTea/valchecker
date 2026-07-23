import { bench, describe } from 'vitest'
import { createValchecker, looseBoolean } from '../..'

const schema = createValchecker({ steps: [looseBoolean] })
	.looseBoolean()

describe('looseBoolean benchmarks', () => {
	bench('boolean input', () => {
		schema.execute(true)
	})

	bench('boolean string input', () => {
		schema.execute('true')
	})

	bench('invalid input', () => {
		schema.execute('TRUE')
	})
})
