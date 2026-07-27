import { bench, describe } from 'vitest'
import { createValchecker, isIsoDate, string } from '../..'

const schema = createValchecker({ steps: [string, isIsoDate] })
	.string()
	.isIsoDate()

describe('isIsoDate benchmarks', () => {
	bench('valid input', () => {
		schema.execute('2026-07-23')
	})

	// A leap day matches the pattern's first alternative and short-circuits,
	// while an ordinary date walks past it into the month-length groups.
	bench('valid leap day', () => {
		schema.execute('2024-02-29')
	})

	bench('invalid input', () => {
		schema.execute('2026-02-30')
	})
})
