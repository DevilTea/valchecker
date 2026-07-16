import { bench, describe } from 'vitest'
import { createValchecker, isAtMost, isLengthAtMost, number, string } from '../..'

const v = createValchecker({ steps: [number, string, isAtMost, isLengthAtMost] })
const numberSchema = v.number().isAtMost(100)
const stringSchema = v.string().isLengthAtMost(10)

describe('maximum validation benchmarks', () => {
	bench('numeric success', () => {
		numberSchema.execute(5)
	})

	bench('numeric failure', () => {
		numberSchema.execute(101)
	})

	bench('length success', () => {
		stringSchema.execute('value')
	})
})