import { bench, describe } from 'vitest'
import { bigint, createValchecker, number, string, toBoolean } from '../..'

const v = createValchecker({ steps: [bigint, number, string, toBoolean] })
const stringSchema = v.string()
	.toBoolean()
const numberSchema = v.number()
	.toBoolean()
const bigintSchema = v.bigint()
	.toBoolean()

describe('toBoolean benchmarks', () => {
	bench('non-empty string', () => {
		stringSchema.execute('false')
	})

	bench('empty string', () => {
		stringSchema.execute('')
	})

	bench('number coercion', () => {
		numberSchema.execute(1)
	})

	bench('bigint coercion', () => {
		bigintSchema.execute(1n)
	})
})
