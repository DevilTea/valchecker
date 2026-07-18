import type { InferOutput } from '../..'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { array, createValchecker, number, toMapped, transform, unknown } from '../..'

const v = createValchecker({ steps: [array, number, toMapped, transform, unknown] })

describe('toMapped step plugin', () => {
	it('maps items with index, source array, and thisArg', () => {
		const context = { offset: 10 }
		const input = [1, 2]
		const schema = v.array(v.number()).toMapped(function (item, index, value) {
			expect(value).toBe(input)
			return item + index + this.offset
		}, { thisArg: context })
		expect(schema.execute(input)).toEqual({ value: [11, 13] })
		expectTypeOf<InferOutput<typeof schema>>().toEqualTypeOf<number[]>()
	})

	it('converts callback exceptions into an operation issue', () => {
		const error = new Error('boom')
		const input = [1, 2]
		expect(v.array(v.number()).toMapped((item) => {
			if (item === 2)
				throw error
			return item
		}, { message: 'Mapping failed' }).execute(input)).toMatchObject({
			issues: [{
				code: 'toMapped:callback_failed',
				category: 'operation',
				message: 'Mapping failed',
				payload: { value: input, item: 2, index: 1, error },
			}],
		})
	})

	it('preserves mapper promises as array items instead of awaiting them', async () => {
		const result = v.array(v.number()).toMapped(async item => item + 1).execute([1])
		expect(result).not.toBeInstanceOf(Promise)
		const promise = (result as any).value[0]
		expect(promise).toBeInstanceOf(Promise)
		await expect(promise).resolves.toBe(2)
	})

	it('leaves failures outside the mapper callback to the core boundary', () => {
		const error = new Error('map method')
		const input = [1] as number[]
		Object.defineProperty(input, 'map', {
			value: () => { throw error },
		})
		const schema = v.unknown().transform(() => input).toMapped(item => item)
		expect(schema.execute(null)).toMatchObject({
			issues: [{ code: 'core:unknown_exception', payload: { error } }],
		})
	})
})
