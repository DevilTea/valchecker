import { bench, describe } from 'vitest'
import { createValchecker, date, isAfter } from '../..'

const v = createValchecker({ steps: [date, isAfter] })
const schema = v.date()
	.isAfter(new Date('2020-01-01T00:00:00.000Z'))

describe('isAfter benchmarks', () => {
	bench('successful execution', () => {
		schema.execute(new Date('2020-01-02T00:00:00.000Z'))
	})

	bench('failed execution', () => {
		schema.execute(new Date('2019-12-31T00:00:00.000Z'))
	})
})
