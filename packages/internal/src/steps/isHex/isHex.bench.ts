import { bench, describe } from 'vitest'
import { createValchecker, isHex, string } from '../..'

const schema = createValchecker({ steps: [string, isHex] })
	.string()
	.isHex()

describe('isHex benchmarks', () => {
	bench('valid input', () => {
		schema.execute('deadBEEF')
	})

	bench('invalid input', () => {
		schema.execute('0x1f')
	})
})
