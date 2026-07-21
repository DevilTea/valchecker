import { describe, expect, it, vi } from 'vitest'
import { createValchecker, implStepPlugin } from '../../core'
import { intersection } from './intersection'
import { string } from '../string'
import { unknown } from '../unknown'

const fixture = implStepPlugin<any>({
	internalFailure: ({ utils }: any) => {
		utils.addSuccessStep(() => {
			throw new Error('internal failure')
		})
	},
	observe: ({ utils, params: [callback] }: any) => {
		utils.addSuccessStep((value: unknown) => {
			callback(value)
			return utils.success(value)
		})
	},
})

const v = createValchecker({
	steps: [fixture, intersection, string, unknown],
})

describe('intersection issue collection', () => {
	it('preserves earlier recoverable issues but stops at a synchronous internal issue', () => {
		const later = vi.fn()
		const result = (v as any).intersection([
			v.string(),
			(v as any).unknown().internalFailure(),
			(v as any).unknown().observe(later),
		], { collectAllIssues: true }).execute(1)

		expect(result).toMatchObject({
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
