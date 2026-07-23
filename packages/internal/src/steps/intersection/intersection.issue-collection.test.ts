import { describe, expect, it, vi } from 'vitest'
import { createValchecker } from '../../core'
import { structuralFixture } from '../../test-utils/fixtures'
import { string } from '../string'
import { unknown } from '../unknown'
import { intersection } from './intersection'

const fixture = structuralFixture

const v = createValchecker({
	steps: [fixture, intersection, string, unknown],
})

describe('intersection issue collection', () => {
	it('preserves earlier recoverable issues but stops at a synchronous internal issue', () => {
		const later = vi.fn()
		const result = (v as any).intersection([
			v.string(),
			(v as any).unknown()
				.internalFailure(),
			(v as any).unknown()
				.observe(later),
		], { collectAllIssues: true })
			.execute(1)

		expect(result)
			.toMatchObject({
				issues: [
					{
						code: 'string:expected_string',
						category: 'validation',
					},
					{
						code: 'core:unknown_exception',
						category: 'internal',
						payload: { method: 'internalFailure' },
					},
				],
			})
		expect(later).not.toHaveBeenCalled()
	})
})
