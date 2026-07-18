import type { InferOperationMode } from '../core'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createValchecker, looseObject, object, strictObject, string, transform, unknown } from '../..'

const v = createValchecker({
	steps: [looseObject, object, strictObject, string, transform, unknown],
})

describe('structural step family contracts', () => {
	it('preserves an own __proto__ field without changing output prototypes', async () => {
		const struct = Object.create(null) as Record<string, any>
		Object.defineProperty(struct, '__proto__', {
			configurable: true,
			enumerable: true,
			value: v.unknown().transform(value => value),
			writable: true,
		})

		const protoValue = { safe: true }
		const input = Object.create(null) as Record<string, unknown>
		Object.defineProperty(input, '__proto__', {
			configurable: true,
			enumerable: true,
			value: protoValue,
			writable: true,
		})

		for (const schema of [
			v.object(struct),
			v.strictObject(struct),
			v.looseObject(struct),
		]) {
			const result = await schema.execute(input as any)
			expect(v.isSuccess(result)).toBe(true)
			if (v.isSuccess(result)) {
				const output = result.value as Record<string, unknown>
				expect(Object.getPrototypeOf(output)).toBe(Object.prototype)
				expect(Object.hasOwn(output, '__proto__')).toBe(true)
				expect(Reflect.get(output, '__proto__')).toBe(protoValue)
			}
		}
	})

	it('rejects enumerable symbol keys only in strict objects', () => {
		const extra = Symbol('extra')
		const input = { [extra]: true }

		expect(v.strictObject({}).execute(input)).toMatchObject({
			issues: [{
				code: 'strictObject:unexpected_keys',
				category: 'validation',
				payload: { keys: [extra] },
			}],
		})
		expect(v.object({}).execute(input)).toEqual({ value: {} })
		expect(v.looseObject({}).execute(input)).toEqual({ value: input })
	})

	it('classifies empty structs as synchronous across structural variants', () => {
		const objectSchema = v.object({})
		const strictSchema = v.strictObject({})
		const looseSchema = v.looseObject({})

		expectTypeOf<InferOperationMode<typeof objectSchema>>().toEqualTypeOf<'sync'>()
		expectTypeOf<InferOperationMode<typeof strictSchema>>().toEqualTypeOf<'sync'>()
		expectTypeOf<InferOperationMode<typeof looseSchema>>().toEqualTypeOf<'sync'>()
		expect(objectSchema.execute({})).toEqual({ value: {} })
		expect(strictSchema.execute({})).toEqual({ value: {} })
		expect(looseSchema.execute({})).toEqual({ value: {} })
	})

	it('does not validate inherited values as declared fields', () => {
		const input = Object.create({ name: 'inherited' })
		const schemas = [
			['object:missing_key', v.object({ name: v.string() })],
			['strictObject:missing_key', v.strictObject({ name: v.string() })],
			['looseObject:missing_key', v.looseObject({ name: v.string() })],
		] as const

		for (const [code, schema] of schemas) {
			expect(schema.execute(input)).toMatchObject({
				issues: [{
					code,
					category: 'validation',
					path: ['name'],
					payload: { key: 'name' },
				}],
			})
		}
	})

	it('materializes transformed loose-object fields as writable data properties', () => {
		const input = Object.defineProperty({ extra: true }, 'name', {
			configurable: false,
			enumerable: true,
			get: () => 'Ada',
		})
		const result = v.looseObject({
			name: v.string().transform(value => value.toUpperCase()),
		}).execute(input)

		expect(result).toEqual({ value: { name: 'ADA', extra: true } })
		if (v.isSuccess(result)) {
			expect(Object.getOwnPropertyDescriptor(result.value, 'name')).toMatchObject({
				configurable: true,
				enumerable: true,
				value: 'ADA',
				writable: true,
			})
		}
	})
})
