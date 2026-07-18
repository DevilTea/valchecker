import type { InferOutput } from '../..'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { bigint, boolean, createValchecker, number, string, toMappedBoolean } from '../..'

const v = createValchecker({ steps: [bigint, boolean, number, string, toMappedBoolean] })

describe('toMappedBoolean step plugin', () => {
	it.each([
		['Y', true],
		['yes', true],
		['N', false],
		['no', false],
	] as const)('maps string %j to %s', (value, expected) => {
		const schema = v.string().toMappedBoolean({
			trueValues: ['Y', 'yes'],
			falseValues: ['N', 'no'],
		})
		expect(schema.execute(value)).toEqual({ value: expected })
	})

	it.each([
		[1, true],
		[0, false],
	] as const)('maps number %s to %s', (value, expected) => {
		const schema = v.number().toMappedBoolean({
			trueValues: [1],
			falseValues: [0],
		})
		expect(schema.execute(value)).toEqual({ value: expected })
	})

	it.each([
		[1n, true],
		[0n, false],
	] as const)('maps bigint %s to %s', (value, expected) => {
		const schema = v.bigint().toMappedBoolean({
			trueValues: [1n],
			falseValues: [0n],
		})
		expect(schema.execute(value)).toEqual({ value: expected })
	})

	it('uses SameValueZero equality', () => {
		const schema = v.number().toMappedBoolean({
			trueValues: [Number.NaN],
			falseValues: [-0],
		})
		expect(schema.execute(Number.NaN)).toEqual({ value: true })
		expect(schema.execute(0)).toEqual({ value: false })
	})

	it('reports the configured mappings for an unmapped value', () => {
		expect(v.string().toMappedBoolean({
			trueValues: ['Y'],
			falseValues: ['N'],
		}).execute('unknown')).toEqual({
			issues: [{
				code: 'toMappedBoolean:unmapped_value',
				category: 'validation',
				message: 'Expected the value to match a configured boolean mapping.',
				path: [],
				payload: { trueValues: ['Y'], falseValues: ['N'], value: 'unknown' },
			}],
		})
	})

	it('snapshots mappings when the schema is created', () => {
		const trueValues = ['yes']
		const falseValues = ['no']
		const schema = v.string().toMappedBoolean({ trueValues, falseValues })

		trueValues.push('later-true')
		falseValues.push('later-false')

		expect(schema.execute('maybe')).toMatchObject({
			issues: [{
				code: 'toMappedBoolean:unmapped_value',
				payload: {
					value: 'maybe',
					trueValues: ['yes'],
					falseValues: ['no'],
				},
			}],
		})
	})

	it('supports custom messages and one-sided mappings', () => {
		const schema = v.string().toMappedBoolean({
			trueValues: ['enabled'],
			falseValues: [],
			message: 'Custom mapping',
		})
		expect(schema.execute('enabled')).toEqual({ value: true })
		expect(schema.execute('disabled')).toMatchObject({
			issues: [{ message: 'Custom mapping' }],
		})
	})

	it('rejects empty and overlapping schema configurations', () => {
		expect(() => v.string().toMappedBoolean({
			trueValues: [],
			falseValues: [],
		})).toThrow('toMappedBoolean() requires at least one configured value.')

		expect(() => v.string().toMappedBoolean({
			trueValues: ['same'],
			falseValues: ['same'],
		})).toThrow('toMappedBoolean() trueValues and falseValues must not overlap.')
	})

	it('infers boolean output and follows the current primitive type', () => {
		const schema = v.string().toMappedBoolean({
			trueValues: ['Y'],
			falseValues: ['N'],
		})
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<boolean>()
		expectTypeOf(v.boolean().toMappedBoolean).toBeNever()

		if (false) {
			// @ts-expect-error mappings must use the current string output type
			v.string().toMappedBoolean({ trueValues: [1], falseValues: [0] })
		}
	})
})
