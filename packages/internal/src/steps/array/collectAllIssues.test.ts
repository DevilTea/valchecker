import { describe, expect, it, vi } from 'vitest'
import { array, createValchecker, string, transform, unknown } from '../..'
import { structuralFixture } from '../../test-utils/fixtures'

const fixture = structuralFixture

const v = createValchecker({ steps: [array, fixture, string, transform, unknown] })

describe('array collectAllIssues', () => {
	it('retains array classification before item traversal', () => {
		expect(v.array(v.string(), { collectAllIssues: true })
			.execute({}))
			.toMatchObject({ issues: [{ code: 'array:expected_array' }] })
	})

	it('returns ordered outputs after asynchronous item validation', async () => {
		const item = v.string()
			.transform(async value => value.toUpperCase())
		await expect(v.array(item, { collectAllIssues: true })
			.execute(['a', 'b']))
			.resolves.toEqual({ value: ['A', 'B'] })
	})

	it('stops later items after an asynchronous internal issue', async () => {
		const later = vi.fn()
		const internal = (v as any).unknown()
			.asyncInternalFailure()
		const observed = (v as any).unknown()
			.observe(later)
		const item = {
			'~execute': (value: unknown) => value === 'internal'
				? internal['~execute'](value)
				: observed['~execute'](value),
		} as any

		await expect((v as any).array(item, { collectAllIssues: true })
			.execute(['internal', 'later']))
			.resolves.toMatchObject({ issues: [{ category: 'internal', path: [0] }] })
		expect(later).not.toHaveBeenCalled()
	})
})
