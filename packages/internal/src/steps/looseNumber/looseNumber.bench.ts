import { bench, describe } from 'vitest'
import { createValchecker, looseNumber } from '../..'

const v = createValchecker({ steps: [looseNumber] })
const schema = v.looseNumber()

describe('looseNumber benchmarks', () => {
	bench('number input', () => {
		schema.execute(42)
	})

	bench('number string input', () => {
		schema.execute('42')
	})

	bench('invalid input', () => {
		schema.execute('not-a-number')
	})
})