import { bench, describe } from 'vitest'
import { createValchecker, number, string, toMappedBoolean } from '../..'

const v = createValchecker({ steps: [number, string, toMappedBoolean] })
const stringSchema = v.string().toMappedBoolean({
	trueValues: ['Y', 'yes'],
	falseValues: ['N', 'no'],
})
const numberSchema = v.number().toMappedBoolean({
	trueValues: [1],
	falseValues: [0],
})

describe('toMappedBoolean benchmarks', () => {
	bench('mapped string true', () => {
		stringSchema.execute('Y')
	})

	bench('mapped string false', () => {
		stringSchema.execute('N')
	})

	bench('unmapped string', () => {
		stringSchema.execute('unknown')
	})

	bench('mapped number', () => {
		numberSchema.execute(1)
	})
})
