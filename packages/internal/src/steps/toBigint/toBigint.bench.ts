import { bench, describe } from 'vitest'
import { boolean, createValchecker, number, string, toBigint } from '../..'

const v = createValchecker({ steps: [boolean, number, string, toBigint] })
const stringSchema = v.string().toBigint()
const numberSchema = v.number().toBigint()
const booleanSchema = v.boolean().toBigint()

describe('toBigint benchmarks', () => {
	bench('valid numeric string', () => {
		stringSchema.execute('42')
	})

	bench('invalid numeric string', () => {
		stringSchema.execute('invalid')
	})

	bench('integer number', () => {
		numberSchema.execute(42)
	})

	bench('boolean coercion', () => {
		booleanSchema.execute(true)
	})
})
