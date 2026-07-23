import { describe, expect, it, vi } from 'vitest'
import { createValchecker, intersection, number, transform, unknown } from '../..'
import { structuralFixture } from '../../test-utils/fixtures'

const fixture = structuralFixture

const v = createValchecker({ steps: [fixture, intersection, number, transform, unknown] })

describe('intersection collectAllIssues', () => {
	it('merges compatible synchronous branch outputs', () => {
		expect(v.intersection([
			v.unknown()
				.transform(() => ({ left: true })),
			v.unknown()
				.transform(() => ({ right: true })),
		], { collectAllIssues: true })
			.execute(null))
			.toEqual({ value: { left: true, right: true } })
	})

	it('applies the enclosing message to output conflicts', () => {
		expect(v.intersection([
			v.unknown()
				.transform(() => 'left'),
			v.unknown()
				.transform(() => 'right'),
		], { collectAllIssues: true, message: 'conflict' })
			.execute(null))
			.toMatchObject({
				issues: [{ code: 'intersection:conflicting_outputs', message: 'conflict' }],
			})
	})

	it('continues default asynchronous evaluation only after successful branches', async () => {
		await expect(v.intersection([
			v.unknown()
				.transform(async value => ({ left: value })),
			v.unknown()
				.transform(value => ({ right: value })),
		])
			.execute('ok'))
			.resolves.toEqual({ value: { left: 'ok', right: 'ok' } })

		await expect(v.intersection([
			v.unknown()
				.transform(async value => value),
			v.number(),
		])
			.execute('bad'))
			.resolves.toMatchObject({ issues: [{ code: 'number:expected_number' }] })
	})

	it('stops later synchronous branches after an internal issue', () => {
		const later = vi.fn()
		const result = (v as any).intersection([
			(v as any).unknown()
				.internalFailure(),
			(v as any).unknown()
				.observe(later),
		], { collectAllIssues: true })
			.execute('value')

		expect(result)
			.toMatchObject({ issues: [{ code: 'core:unknown_exception' }] })
		expect(later).not.toHaveBeenCalled()
	})
})
