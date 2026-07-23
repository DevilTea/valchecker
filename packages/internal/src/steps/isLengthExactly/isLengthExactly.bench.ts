import { bench, describe } from 'vitest'
import { createValchecker, isLengthExactly, string } from '../..'

const v = createValchecker({ steps: [isLengthExactly, string] })
const schema = v.string()
	.isLengthExactly(8)

describe('isLengthExactly benchmarks', () => {
	bench('successful execution', () => {
		schema.execute('12345678')
	})

	bench('failed execution', () => {
		schema.execute('short')
	})
})
