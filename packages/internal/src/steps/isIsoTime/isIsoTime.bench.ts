import { bench, describe } from 'vitest'
import { createValchecker, isIsoTime, string } from '../..'

const schema = createValchecker({ steps: [string, isIsoTime] })
	.string()
	.isIsoTime()

describe('isIsoTime benchmarks', () => {
	bench('valid input', () => {
		schema.execute('12:30:45')
	})

	bench('invalid input', () => {
		schema.execute('24:00:00')
	})
})
