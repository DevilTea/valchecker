import { bench, describe } from 'vitest'
import { createValchecker, isAtLeast, isLengthAtLeast, number, string } from '../..'

const v = createValchecker({ steps: [number, string, isAtLeast, isLengthAtLeast] })
const numberSchema = v.number().isAtLeast(0)
const stringSchema = v.string().isLengthAtLeast(3)

describe('minimum validation benchmarks', () => {
	bench('numeric success', () => {
		numberSchema.execute(5)
	})

	bench('numeric failure', () => {
		numberSchema.execute(-1)
	})

	bench('length success', () => {
		stringSchema.execute('value')
	})
})