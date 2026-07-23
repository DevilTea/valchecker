import { bench, describe } from 'vitest'
import { createValchecker, number, string, toDate } from '../..'

const v = createValchecker({ steps: [number, string, toDate] })
const stringSchema = v.string()
	.toDate()
const numberSchema = v.number()
	.toDate()

describe('toDate benchmarks', () => {
	bench('valid ISO string', () => {
		stringSchema.execute('2020-01-01T00:00:00.000Z')
	})

	bench('unparseable string', () => {
		stringSchema.execute('nope')
	})

	bench('epoch milliseconds', () => {
		numberSchema.execute(0)
	})
})
