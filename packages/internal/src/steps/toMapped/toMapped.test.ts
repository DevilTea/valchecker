import type { InferOutput } from '../..'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { array, createValchecker, number, toMapped } from '../..'

const v = createValchecker({ steps: [array, number, toMapped] })

describe('toMapped step plugin', () => {
	it('maps items with index, array, and thisArg', () => {
		const context = { offset: 10 }
		const schema = v.array(v.number()).toMapped(function (item, index, value) {
			return item + index + value.length + this.offset
		}, { thisArg: context })
		expect(schema.execute([1, 2])).toEqual({ value: [13, 15] })
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
})
