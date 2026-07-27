import { bench, describe } from 'vitest'
import { createValchecker, isIsoDateTime, string } from '../..'

const schema = createValchecker({ steps: [string, isIsoDateTime] })
	.string()
	.isIsoDateTime()

describe('isIsoDateTime benchmarks', () => {
	bench('valid input', () => {
		schema.execute('2026-07-23T12:30:00Z')
	})

	// A leap day matches the pattern's first alternative and short-circuits,
	// while an ordinary date walks past it into the month-length groups.
	bench('valid leap day', () => {
		schema.execute('2024-02-29T12:30:00Z')
	})

	bench('invalid input', () => {
		schema.execute('2026-02-30T12:00:00')
	})

	// A near miss whose date part is valid is the one shape that costs more than
	// it did before: the calendar alternation runs before the mismatch is found.
	bench('invalid near miss after a valid date', () => {
		schema.execute('2026-07-23 12:30:00')
	})
})
