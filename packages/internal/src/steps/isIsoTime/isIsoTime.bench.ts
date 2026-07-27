import { bench, describe } from 'vitest'
import { createValchecker, isIsoTime, string } from '../..'

const schema = createValchecker({ steps: [string, isIsoTime] })
	.string()
	.isIsoTime()

describe('isIsoTime benchmarks', () => {
	bench('valid input', () => {
		schema.execute('12:30:45')
	})

	bench('valid input with fractional seconds', () => {
		schema.execute('12:30:45.500')
	})

	// An out-of-range field fails inside the pattern, while a malformed string
	// fails at the first position; they are different costs.
	bench('invalid input', () => {
		schema.execute('24:00:00')
	})

	bench('malformed input', () => {
		schema.execute('not-a-time')
	})
})
