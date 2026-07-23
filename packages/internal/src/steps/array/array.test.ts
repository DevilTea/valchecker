import { describe, expect, it, vi } from 'vitest'
import { array, createValchecker, number, string, transform, unknown } from '../..'
import { structuralFixture } from '../../test-utils/fixtures'

const arrayFixture = structuralFixture

const v = createValchecker({
	steps: [array, arrayFixture, number, string, transform, unknown],
})

describe('array step plugin', () => {
	it.each([
		['string', 'not an array'],
		['number', 42],
		['object', {}],
		['null', null],
		['undefined', undefined],
	] as const)('rejects %s input as a non-array', (_kind, value) => {
		expect(v.array(v.string())
			.execute(value))
			.toEqual({
				issues: [{
					code: 'array:expected_array',
					category: 'validation',
					message: 'Expected an array.',
					path: [],
					payload: { value },
				}],
			})
	})

	it('uses a custom message for its owned array-classification issue', () => {
		expect(v.array(v.string(), { message: 'Custom array' })
			.execute('wrong'))
			.toMatchObject({
				issues: [{
					code: 'array:expected_array',
					message: 'Custom array',
				}],
			})
	})

	it('returns transformed child outputs in item order', () => {
		expect(v.array(v.string()
			.transform(value => value.toUpperCase()))
			.execute(['a', 'b', 'c']))
			.toEqual({
				value: ['A', 'B', 'C'],
			})
	})

	it('collects child issues with stable numeric paths', () => {
		expect(v.array(v.string(), { collectAllIssues: true })
			.execute(['ok', 1, 2]))
			.toEqual({
				issues: [
					{
						code: 'string:expected_string',
						category: 'validation',
						message: 'Expected a string.',
						path: [1],
						payload: { value: 1 },
					},
					{
						code: 'string:expected_string',
						category: 'validation',
						message: 'Expected a string.',
						path: [2],
						payload: { value: 2 },
					},
				],
			})
	})

	it('validates sparse positions as undefined values', () => {
		const input = ['a']
		input[2] = 'c'

		expect(v.array(v.string())
			.execute(input))
			.toMatchObject({
				issues: [{
					code: 'string:expected_string',
					path: [1],
					payload: { value: undefined },
				}],
			})
	})

	it('continues remaining items after a recoverable asynchronous child failure', async () => {
		const later = vi.fn((value: string) => value.toUpperCase())
		let index = 0
		const item = v.string()
			.transform(async (value) => {
				const current = index++
				if (current === 0)
					throw new Error('recoverable')
				return later(value)
			})

		await expect(v.array(item, { collectAllIssues: true })
			.execute(['first', 'second', 'third']))
			.resolves.toMatchObject({
				issues: [{
					code: 'transform:callback_failed',
					category: 'operation',
					path: [0],
					payload: { phase: 'reject', value: 'first' },
				}],
			})
		expect(later)
			.toHaveBeenCalledTimes(2)
	})

	it('continues synchronous items after the first item returns a promise', async () => {
		let first = true
		const item = v.string()
			.transform((value) => {
				if (first) {
					first = false
					return Promise.resolve(value.toUpperCase())
				}
				return value.toLowerCase()
			})

		await expect(v.array(item)
			.execute(['a', 'B', 'C']))
			.resolves.toEqual({ value: ['A', 'b', 'c'] })
	})

	it('stops later items after a synchronous internal child failure', () => {
		const later = vi.fn()
		let index = 0
		const item = (v as any).unknown()
			.observe((value: unknown) => {
				const current = index++
				if (current === 1)
					throw new Error('fixture should be replaced')
				later(value)
			})
		const internal = (v as any).unknown()
			.internalFailure()
		const selector = (v as any).unknown()
			.transform((value: unknown) => value)
		const schema = (v as any).array({
			'~execute': (value: unknown) => value === 'internal'
				? internal['~execute'](value)
				: value === 'later'
					? item['~execute'](value)
					: selector['~execute'](value),
		})
		const result = schema.execute(['ok', 'internal', 'later'])

		expect(result)
			.toMatchObject({
				issues: [{
					code: 'core:unknown_exception',
					category: 'internal',
					path: [1],
					payload: { method: 'internalFailure' },
				}],
			})
		expect(later).not.toHaveBeenCalled()
	})

	it('stops later items after an asynchronous internal child failure', async () => {
		const later = vi.fn()
		const internal = (v as any).unknown()
			.asyncInternalFailure()
		const observed = (v as any).unknown()
			.observe(later)
		const schema = (v as any).array({
			'~execute': (value: unknown) => value === 'internal'
				? internal['~execute'](value)
				: observed['~execute'](value),
		})

		await expect(schema.execute(['internal', 'later']))
			.resolves.toMatchObject({
				issues: [{
					code: 'core:unknown_exception',
					category: 'internal',
					path: [0],
					payload: { method: 'asyncInternalFailure' },
				}],
			})
		expect(later).not.toHaveBeenCalled()
	})
})
