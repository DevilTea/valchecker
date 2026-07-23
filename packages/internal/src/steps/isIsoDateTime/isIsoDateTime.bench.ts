import { bench, describe } from 'vitest'
import { createValchecker, isIsoDateTime, string } from '../..'

const schema = createValchecker({ steps: [string, isIsoDateTime] })
	.string()
	.isIsoDateTime()

describe('isIsoDateTime benchmarks', () => {
	bench('valid input', () => {
		schema.execute('2026-07-23T12:30:00Z')
	})

	bench('invalid input', () => {
		schema.execute('2026-02-30T12:00:00')
	})
})
