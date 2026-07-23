import { bench, describe } from 'vitest'
import { createValchecker, isIsoDate, string } from '../..'

const schema = createValchecker({ steps: [string, isIsoDate] })
	.string()
	.isIsoDate()

describe('isIsoDate benchmarks', () => {
	bench('valid input', () => {
		schema.execute('2026-07-23')
	})

	bench('invalid input', () => {
		schema.execute('2026-02-30')
	})
})
