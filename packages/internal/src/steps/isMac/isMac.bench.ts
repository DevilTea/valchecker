import { bench, describe } from 'vitest'
import { createValchecker, isMac, string } from '../..'

const schema = createValchecker({ steps: [string, isMac] })
	.string()
	.isMac()

describe('isMac benchmarks', () => {
	bench('valid input', () => {
		schema.execute('00:1A:2B:3C:4D:5E')
	})

	bench('invalid input', () => {
		schema.execute('00:1A:2B:3C:4D')
	})
})
