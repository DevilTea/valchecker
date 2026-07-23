import { describe, expect, it } from 'vitest'
import { createValchecker, looseObject, object, strictObject, string, transform } from '../index'
import { syncResult } from '../test-utils/helpers'

const v = createValchecker({
	steps: [looseObject, object, strictObject, string, transform],
})

describe('structural symbol-key contracts', () => {
	it.each([
		['object', (struct: Record<PropertyKey, any>) => v.object(struct)],
		['strictObject', (struct: Record<PropertyKey, any>) => v.strictObject(struct)],
		['looseObject', (struct: Record<PropertyKey, any>) => v.looseObject(struct)],
	] as const)('validates and materializes a declared enumerable symbol in %s', (_name, createSchema) => {
		const key = Symbol('value')
		const schema = createSchema({
			[key]: v.string()
				.transform(value => value.toUpperCase()),
		})
		const result = syncResult(schema.execute({ [key]: 'ada' }))

		expect(result)
			.toEqual({ value: { [key]: 'ADA' } })
		if (v.isSuccess(result)) {
			expect(Object.getOwnPropertyDescriptor(result.value, key))
				.toMatchObject({
					configurable: true,
					enumerable: true,
					value: 'ADA',
					writable: true,
				})
		}
	})
})
