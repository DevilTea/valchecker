import type { StandardSchemaV1 } from '@standard-schema/spec'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { check, number, object, string, toAsync, transform } from '../steps'
import { createValchecker } from './core'

const v = createValchecker({ steps: [check, number, object, string, toAsync, transform] })

async function consumeStandardSchema<Input, Output>(
	schema: StandardSchemaV1<Input, Output>,
	input: Input,
): Promise<StandardSchemaV1.Result<Output>> {
	return await schema['~standard'].validate(input)
}

describe('Standard Schema V1 contract', () => {
	it('exposes the required metadata and structural type contract', () => {
		const schema = v.string()
		const standard: StandardSchemaV1<string, string> = schema

		expect(standard['~standard'].version).toBe(1)
		expect(standard['~standard'].vendor).toBe('valchecker')
		expect(standard['~standard'].validate).toBe(schema.execute)
		expectTypeOf(standard).toMatchTypeOf<StandardSchemaV1<string, string>>()
	})

	it('returns synchronous success and failure results when the pipeline is synchronous', () => {
		const schema = v.string()
			.transform(value => value.trim())

		const success = schema['~standard'].validate('  Ada  ')
		expect(success).not.toBeInstanceOf(Promise)
		expect(success).toEqual({ value: 'Ada' })

		const failure = schema['~standard'].validate(42)
		expect(failure).not.toBeInstanceOf(Promise)
		expect(failure).toMatchObject({
			issues: [{
				code: 'string:expected_string',
				message: 'Expected a string.',
				path: [],
			}],
		})
	})

	it('preserves transformed output and nested issue paths through a generic consumer', async () => {
		const schema = v.object({
			profile: v.object({
				name: v.string().transform(value => value.toUpperCase()),
			}),
		})

		await expect(consumeStandardSchema(schema, {
			profile: { name: 'ada' },
		})).resolves.toEqual({
			value: {
				profile: { name: 'ADA' },
			},
		})

		await expect(consumeStandardSchema(schema, {
			profile: { name: 42 as any },
		})).resolves.toMatchObject({
			issues: [{
				code: 'string:expected_string',
				path: ['profile', 'name'],
			}],
		})
	})

	it('keeps maybe-async validation synchronous when an earlier step fails', async () => {
		const schema = v.string()
			.check(async value => value.length > 0)

		const bypassed = schema['~standard'].validate(42)
		expect(bypassed).not.toBeInstanceOf(Promise)
		expect(bypassed).toMatchObject({
			issues: [{ code: 'string:expected_string' }],
		})

		const validated = schema['~standard'].validate('Ada')
		expect(validated).toBeInstanceOf(Promise)
		await expect(validated).resolves.toEqual({ value: 'Ada' })
	})

	it('assimilates PromiseLike values and returns a native Promise', async () => {
		const schema = v.string()
			.transform(value => ({
				then(resolve: (output: string) => void) {
					resolve(value.toUpperCase())
				},
			}))

		const result = schema['~standard'].validate('ada')
		expect(result).toBeInstanceOf(Promise)
		await expect(result).resolves.toEqual({ value: 'ADA' })
	})

	it('returns structured failures for rejected asynchronous validation', async () => {
		const error = new Error('service unavailable')
		const schema = v.string()
			.check(async () => {
				throw error
			})

		await expect(schema['~standard'].validate('Ada')).resolves.toEqual({
			issues: [{
				code: 'check:failed',
				message: 'Check failed',
				path: [],
				payload: {
					value: 'Ada',
					error,
				},
			}],
		})
	})

	it('uses toAsync to guarantee native Promise results for both outcomes', async () => {
		const schema = v.string().toAsync()

		const success = schema['~standard'].validate('Ada')
		const failure = schema['~standard'].validate(42)
		expect(success).toBeInstanceOf(Promise)
		expect(failure).toBeInstanceOf(Promise)
		await expect(success).resolves.toEqual({ value: 'Ada' })
		await expect(failure).resolves.toMatchObject({
			issues: [{ code: 'string:expected_string' }],
		})
	})
})
