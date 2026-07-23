import { describe, expect, it, vi } from 'vitest'
import { createValchecker, looseObject, number, string, transform, unknown } from '../..'
import { structuralFixture } from '../../test-utils/fixtures'

const fixture = structuralFixture

const v = createValchecker({ steps: [fixture, looseObject, number, string, transform, unknown] })

describe('looseObject collectAllIssues', () => {
	it('retains object classification before field traversal', () => {
		expect(v.looseObject({}, { collectAllIssues: true })
			.execute([]))
			.toMatchObject({ issues: [{ code: 'looseObject:expected_object' }] })
	})

	it('preserves extras while materializing optional and safe __proto__ fields', () => {
		const ignored = Symbol('ignored')
		const shape: Record<PropertyKey, any> = {
			required: v.string(),
			optional: [v.number()],
		}
		Object.defineProperty(shape, '__proto__', { enumerable: true, value: v.string() })
		Object.defineProperty(shape, ignored, { enumerable: false, value: v.string() })
		const input: Record<PropertyKey, unknown> = { required: 'ok', extra: true }
		Object.defineProperty(input, '__proto__', { enumerable: true, value: 'safe' })

		const result = v.looseObject(shape, { collectAllIssues: true })
			.execute(input)
		expect(result)
			.toMatchObject({ value: { required: 'ok', optional: undefined, extra: true } })
		expect(Object.hasOwn((result as any).value, '__proto__'))
			.toBe(true)
		// eslint-disable-next-line no-proto, no-restricted-properties -- asserting an own __proto__ data property survives as plain data; reading it via the accessor is the behavior under test
		expect((result as any).value.__proto__)
			.toBe('safe')
	})

	it('collects missing and invalid fields before a synchronous internal issue', () => {
		const later = vi.fn()
		const result = (v as any).looseObject({
			missing: v.string(),
			invalid: v.number(),
			internal: (v as any).unknown()
				.internalFailure(),
			later: (v as any).unknown()
				.observe(later),
		}, { collectAllIssues: true })
			.execute({
				invalid: 'bad',
				internal: 'value',
				later: 'later',
				extra: true,
			})

		expect(result)
			.toMatchObject({ issues: [
				{ code: 'looseObject:missing_key', path: ['missing'] },
				{ code: 'number:expected_number', path: ['invalid'] },
				{ code: 'core:unknown_exception', path: ['internal'] },
			] })
		expect(later).not.toHaveBeenCalled()
	})

	it('continues after an asynchronous recoverable issue and stops after an internal issue', async () => {
		await expect(v.looseObject({
			first: v.string()
				.transform(async () => {
					throw new Error('recoverable')
				}),
			optional: [v.number()],
			last: v.string()
				.transform(value => value.toUpperCase()),
			missing: v.string(),
		}, { collectAllIssues: true })
			.execute({ first: 'bad', last: 'ok', extra: true }))
			.resolves.toMatchObject({ issues: [
				{ code: 'transform:callback_failed', path: ['first'] },
				{ code: 'looseObject:missing_key', path: ['missing'] },
			] })

		const later = vi.fn()
		await expect((v as any).looseObject({
			first: (v as any).unknown()
				.asyncInternalFailure(),
			later: (v as any).unknown()
				.observe(later),
		}, { collectAllIssues: true })
			.execute({ first: 'bad', later: 'later' }))
			.resolves.toMatchObject({ issues: [{ code: 'core:unknown_exception', path: ['first'] }] })
		expect(later).not.toHaveBeenCalled()
	})
})
