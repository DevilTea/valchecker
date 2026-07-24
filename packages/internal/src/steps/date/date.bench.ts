import { bench, describe } from 'vitest'
import { createValchecker, date } from '../..'

const v = createValchecker({ steps: [date] })
const schema = v.date()
const valid = new Date('2020-01-01T00:00:00.000Z')
const invalid = new Date('nope')

describe('date benchmarks', () => {
	bench('valid Date', () => {
		schema.execute(valid)
	})

	bench('invalid Date', () => {
		schema.execute(invalid)
	})

	bench('non-Date value', () => {
		schema.execute('2020-01-01')
	})
})
