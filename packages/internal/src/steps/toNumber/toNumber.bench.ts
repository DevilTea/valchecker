import { bench, describe } from 'vitest'
import { bigint, boolean, createValchecker, string, toNumber } from '../..'

const v = createValchecker({ steps: [bigint, boolean, string, toNumber] })
const stringSchema = v.string().toNumber()
const booleanSchema = v.boolean().toNumber()
const bigintSchema = v.bigint().toNumber()

describe('toNumber benchmarks', () => {
	bench('numeric string', () => {
		stringSchema.execute('42')
	})

	bench('invalid numeric string to NaN', () => {
		stringSchema.execute('invalid')
	})

	bench('boolean coercion', () => {
		booleanSchema.execute(true)
	})

	bench('bigint coercion', () => {
		bigintSchema.execute(42n)
	})
})
