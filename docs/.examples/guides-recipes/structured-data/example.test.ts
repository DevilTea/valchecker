import { describe, expect, it } from 'vitest'
import { orderSchema } from './example'

describe('structured-data documentation example', () => {
	it('normalizes nested values and preserves the declared optional property', () => {
		expect(orderSchema.execute({
			id: ' order-1 ',
			items: [
				{ sku: ' item-1 ', quantity: '2' },
			],
			status: 'draft',
		}))
			.toEqual({
				value: {
					id: 'order-1',
					items: [
						{ sku: 'item-1', quantity: 2 },
					],
					note: undefined,
					status: 'draft',
				},
			})
	})
})
