import { bench, describe } from 'vitest'
import { createValchecker, date, isBefore } from '../..'

const v = createValchecker({ steps: [date, isBefore] })
const schema = v.date()
	.isBefore(new Date('2020-01-02T00:00:00.000Z'))

describe('isBefore benchmarks', () => {
	bench('successful execution', () => {
		schema.execute(new Date('2020-01-01T00:00:00.000Z'))
	})

	bench('failed execution', () => {
		schema.execute(new Date('2020-01-03T00:00:00.000Z'))
	})
})
