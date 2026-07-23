import { describe, expect, it, vi } from 'vitest'
import { check, createValchecker, number, string, toLowercase, toTrimmed, transform, unknown, use } from '../..'

const v = createValchecker({
	steps: [check, number, string, toLowercase, toTrimmed, transform, unknown, use],
})

describe('use step plugin', () => {
	it('returns the delegated schema output', () => {
		const delegated = v.string()
			.toTrimmed()
			.toLowercase()

		expect(v.unknown()
			.use(delegated)
			.execute('  ADA@EXAMPLE.COM  '))
			.toEqual({
				value: 'ada@example.com',
			})
	})

	it('passes through delegated issues without replacing their contract', () => {
		expect(v.unknown()
			.use(v.number())
			.execute('wrong'))
			.toMatchObject({
				issues: [{
					code: 'number:expected_number',
					category: 'validation',
					message: 'Expected a number.',
					path: [],
					payload: { value: 'wrong' },
				}],
			})
	})

	it('composes multiple delegated schemas in chain order', () => {
		const normalizeCase = v.string()
			.toLowercase()
		const normalizeSpace = v.string()
			.toTrimmed()

		expect(v.unknown()
			.use(normalizeCase)
			.use(normalizeSpace)
			.execute('  HELLO  '))
			.toEqual({ value: 'hello' })
	})

	it('uses a delegated transform after an earlier output change', () => {
		const numberSchema = v.number()

		expect(v.string()
			.transform(value => Number.parseInt(value))
			.use(numberSchema)
			.execute('42'))
			.toEqual({ value: 42 })
	})

	it('returns a native Promise only when delegated work becomes asynchronous', async () => {
		const delegated = v.string()
			.transform(async value => value.toUpperCase())
		const result = v.unknown()
			.use(delegated)
			.execute('ada')

		expect(result)
			.toBeInstanceOf(Promise)
		await expect(result).resolves.toEqual({ value: 'ADA' })
	})

	it('passes through asynchronous delegated failures', async () => {
		const delegated = v.string()
			.check(async value => value.length > 5 || 'Too short')
		const result = v.unknown()
			.use(delegated)
			.execute('hi')

		expect(result)
			.toBeInstanceOf(Promise)
		await expect(result).resolves.toMatchObject({
			issues: [{
				code: 'check:failed',
				category: 'validation',
				message: 'Too short',
				payload: {
					reason: 'returned_message',
					returnedMessage: 'Too short',
					value: 'hi',
				},
			}],
		})
	})

	it('does not execute the delegated schema after an earlier failure', () => {
		const callback = vi.fn((value: number) => value)
		const delegated = v.number()
			.transform(callback)

		expect(v.string()
			.use(delegated)
			.execute(42))
			.toMatchObject({
				issues: [{ code: 'string:expected_string' }],
			})
		expect(callback).not.toHaveBeenCalled()
	})
})
