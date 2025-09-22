import { describe, expect, it } from 'vitest'
import { defineRunTransform, PipeStepTransformSchema } from './transform'

// Specification: ./transform.spec.md

describe('tests for `transform.ts`', () => {
	// Corresponds to `defineRunTransform` section in the spec
	describe('`defineRunTransform`', () => {
		describe('happy path cases', () => {
			// Test Case: [defineRunTransform.happy.1]
			it('should define a transform function', () => {
				const def = defineRunTransform<string>()
				const run = def.implement(v => `${v}transformed`)
				expect(run('test')).toBe('testtransformed')
			})
		})
	})

	// Corresponds to `PipeStepTransformSchema` section in the spec
	describe('`PipeStepTransformSchema`', () => {
		describe('happy path cases', () => {
			// Test Case: [PipeStepTransformSchema.happy.1]
			it('should execute with success result', async () => {
				const schema = new PipeStepTransformSchema({ meta: { run: v => `${v}transformed` } })
				const result = await schema.execute({ value: 'input' })
				expect(result).toEqual({ value: 'inputtransformed' })
			})
		})

		describe('edge cases', () => {
			// Test Case: [PipeStepTransformSchema.edge.1]
			it('should execute with failure result', async () => {
				const schema = new PipeStepTransformSchema({ meta: { run: v => `${v}transformed` } })
				const result = await schema.execute({ issues: [{ code: 'fail', message: 'failed' }] })
				expect(result).toHaveProperty('issues')
			})

			// Test Case: [PipeStepTransformSchema.edge.2]
			it('should execute with async transform', async () => {
				const schema = new PipeStepTransformSchema({ meta: { run: v => Promise.resolve(`${v}async`) } })
				const result = await schema.execute({ value: 'input' })
				expect(result).toEqual({ value: 'inputasync' })
			})
		})

		describe('error cases', () => {
			// Test Case: [PipeStepTransformSchema.error.1]
			it('should execute with success, transform throws', async () => {
				const schema = new PipeStepTransformSchema({
					meta: {
						run: () => {
							throw new Error('transformErr')
						},
					},
				})
				const result = await schema.execute({ value: 'input' })
				expect(result).toHaveProperty('issues')
				expect((result as any).issues[0].code).toBe('TRANSFORM_FAILED')
			})
		})
	})
})
