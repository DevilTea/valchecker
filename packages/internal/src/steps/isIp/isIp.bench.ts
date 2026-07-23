import { bench, describe } from 'vitest'
import { createValchecker, isIp, string } from '../..'

const schema = createValchecker({ steps: [string, isIp] })
	.string()
	.isIp()

describe('isIp benchmarks', () => {
	bench('valid input', () => {
		schema.execute('192.168.0.1')
	})

	bench('invalid input', () => {
		schema.execute('256.0.0.1')
	})
})
