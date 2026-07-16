import { bench, describe } from 'vitest'
import { createValchecker, number } from '../..'

const v = createValchecker({ steps: [number] })
const schema = v.number()

describe('number benchmarks', () => {
	bench('finite number', () => {
		schema.execute(42)
	})

	bench('special number', () => {
		schema.execute(Number.NaN)
	})

	bench('invalid input', () => {
		schema.execute('42')
	})
})