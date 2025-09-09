import { describe, expect, it } from 'vitest'
import { PipeStepFallbackSchema } from './fallback'

describe('tests of `PipeStepFallbackSchema.validate`', () => {
	describe('happy path cases', () => {
		describe('case 1: returns original success if lastResult is success', () => {
			it('should return the original success result', () => {
				const schema = new PipeStepFallbackSchema({
					meta: { fallback: () => 'fallback' },
				})
				const lastResult = { value: 'ok' }
				const result = schema.validate(lastResult as any)
				expect(result).toEqual({ value: 'ok' })
			})
		})

		describe('case 2: returns success with sync fallback if lastResult is failure', () => {
			it('should return success with fallback value', () => {
				const schema = new PipeStepFallbackSchema({
					meta: { fallback: () => 'fallback' },
				})
				const lastResult = { issues: [{ code: 'PREVIOUS_ERROR' }] }
				const result = schema.validate(lastResult as any)
				expect(result).toEqual({ value: 'fallback' })
			})
		})

		describe('case 3: returns success with async fallback if lastResult is failure', () => {
			it('should return success with async fallback value', async () => {
				const schema = new PipeStepFallbackSchema({
					meta: { fallback: async () => 'async' },
				})
				const lastResult = { issues: [{ code: 'PREVIOUS_ERROR' }] }
				const result = await schema.validate(lastResult as any)
				expect(result).toEqual({ value: 'async' })
			})
		})
	})

	describe('error cases', () => {
		describe('case 1: returns failure if sync fallback throws', () => {
			it('should return failure with FALLBACK_FAILED issue', () => {
				const schema = new PipeStepFallbackSchema({
					meta: { fallback: () => { throw new Error('fail') } },
				})
				const lastResult = { issues: [{ code: 'PREVIOUS_ERROR' }] }
				const result = schema.validate(lastResult as any)
				expect(result).toEqual({
					issues: [{
						code: 'FALLBACK_FAILED',
						error: new Error('fail'),
						message: 'Invalid value.',
						path: undefined,
					}],
				})
			})
		})

		describe('case 2: returns failure if async fallback rejects', () => {
			it('should return failure with FALLBACK_FAILED issue', async () => {
				const schema = new PipeStepFallbackSchema({
					meta: { fallback: async () => { throw new Error('fail') } },
				})
				const lastResult = { issues: [{ code: 'PREVIOUS_ERROR' }] }
				const result = await schema.validate(lastResult as any)
				expect(result).toEqual({
					issues: [{
						code: 'FALLBACK_FAILED',
						error: new Error('fail'),
						message: 'Invalid value.',
						path: undefined,
					}],
				})
			})
		})
	})
})
