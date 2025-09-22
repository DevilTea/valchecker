import { describe, expect, it } from 'vitest'
import { PipeStepFallbackSchema } from './fallback'

// Specification: ./fallback.spec.md

describe('tests for `fallback.ts`', () => {
	// Corresponds to `PipeStepFallbackSchema` section in the spec
	describe('`PipeStepFallbackSchema`', () => {
		describe('happy path cases', () => {
			// Test Case: [PipeStepFallbackSchema.happy.1]
			it('should execute with success result', async () => {
				const schema = new PipeStepFallbackSchema({ meta: { run: () => 'fallback' } })
				const result = await schema.execute({ value: 'success' })
				expect(result).toEqual({ value: 'success' })
			})

			// Test Case: [PipeStepFallbackSchema.happy.2]
			it('should execute with failure, fallback succeeds', async () => {
				const schema = new PipeStepFallbackSchema({ meta: { run: () => 'fallback' } })
				const result = await schema.execute({ issues: [{ code: 'fail', message: 'failed' }] })
				expect(result).toEqual({ value: 'fallback' })
			})
		})

		describe('edge cases', () => {
			// Test Case: [PipeStepFallbackSchema.edge.1]
			it('should execute with async fallback', async () => {
				const schema = new PipeStepFallbackSchema({ meta: { run: () => Promise.resolve('asyncFallback') } })
				const result = await schema.execute({ issues: [{ code: 'fail', message: 'failed' }] })
				expect(result).toEqual({ value: 'asyncFallback' })
			})
		})

		describe('error cases', () => {
			// Test Case: [PipeStepFallbackSchema.error.1]
			it('should execute with failure, fallback throws', async () => {
				const schema = new PipeStepFallbackSchema({
					meta: {
						run: () => {
							throw new Error('fallbackErr')
						},
					},
				})
				const result = await schema.execute({ issues: [{ code: 'fail', message: 'failed' }] })
				expect(result).toHaveProperty('issues')
				expect((result as any).issues[0].code).toBe('FALLBACK_FAILED')
			})
		})
	})
})
