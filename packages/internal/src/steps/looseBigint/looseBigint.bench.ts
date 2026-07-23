import { bench, describe } from 'vitest'
import { createValchecker, looseBigint } from '../..'

const schema = createValchecker({ steps: [looseBigint] })
	.looseBigint()

describe('looseBigint benchmarks', () => {
	bench('bigint input', () => {
		schema.execute(42n)
	})

	bench('bigint string input', () => {
		schema.execute('42')
	})

	bench('invalid input', () => {
		schema.execute('1.5')
	})
})
