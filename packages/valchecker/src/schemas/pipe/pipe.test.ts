import { describe, expect, it } from 'vitest'
import { AbstractSchema, implementSchemaClass } from '../../core'
import { pipe, PipeSchema } from './pipe'

// Specification: ./pipe.spec.md

describe('tests for `pipe.ts`', () => {
	// Helper to create test schema
	function createTestSchema(executeFn: (value: any) => any) {
		class TestSchema extends AbstractSchema {
			constructor() {
				super()
			}
		}
		implementSchemaClass(TestSchema, {
			execute: executeFn,
		})
		return new TestSchema()
	}

	// Corresponds to `PipeSchema` section in the spec
	describe('`PipeSchema`', () => {
		describe('happy path cases', () => {
			// Test Case: [PipeSchema.happy.1]
			it('should instantiate PipeSchema', () => {
				const source = createTestSchema(() => ({ value: 'test' }))
				const pipeSchema = new PipeSchema({ meta: { steps: [source] } })
				expect(pipeSchema).toBeInstanceOf(PipeSchema)
			})

			// Test Case: [PipeSchema.happy.2]
			it('should add check step', () => {
				const source = createTestSchema(() => ({ value: 'test' }))
				const pipeSchema = new PipeSchema({ meta: { steps: [source] } })
				const checked = pipeSchema.check(() => true)
				expect(checked.meta.steps).toHaveLength(2)
			})

			// Test Case: [PipeSchema.happy.3]
			it('should add transform step', () => {
				const source = createTestSchema(() => ({ value: 'test' }))
				const pipeSchema = new PipeSchema({ meta: { steps: [source] } })
				const transformed = pipeSchema.transform(v => `${v}2`)
				expect(transformed.meta.steps).toHaveLength(2)
				expect(transformed.isTransformed).toBe(true)
			})

			// Test Case: [PipeSchema.happy.4]
			it('should add fallback step', () => {
				const source = createTestSchema(() => ({ value: 'test' }))
				const pipeSchema = new PipeSchema({ meta: { steps: [source] } })
				const withFallback = pipeSchema.fallback(() => 'fallback')
				expect(withFallback.meta.steps).toHaveLength(2)
			})

			// Test Case: [PipeSchema.happy.5]
			it('should execute pipe with success', async () => {
				const source = createTestSchema(() => ({ value: 'start' }))
				const step1 = createTestSchema(result => ({ value: `${result.value}1` }))
				const pipeSchema = new PipeSchema({ meta: { steps: [source, step1] } })
				const result = await pipeSchema.execute('input')
				expect(result).toEqual({ value: 'start1' })
			})

			// Test Case: [PipeSchema.happy.6]
			it('should execute pipe with failure and fallback', async () => {
				const source = createTestSchema(() => ({ issues: [{ code: 'fail' }] }))
				const fallbackStep = createTestSchema(() => ({ value: 'fallback' }))
				const pipeSchema = new PipeSchema({ meta: { steps: [source, fallbackStep] } })
				const result = await pipeSchema.execute('input')
				expect(result).toEqual({ value: 'fallback' })
			})
		})

		describe('edge cases', () => {
			// Test Case: [PipeSchema.edge.1]
			it('should handle pipe with single step', async () => {
				const source = createTestSchema(() => ({ value: 'single' }))
				const pipeSchema = new PipeSchema({ meta: { steps: [source] } })
				const result = await pipeSchema.execute('input')
				expect(result).toEqual({ value: 'single' })
			})
		})

		describe('error cases', () => {
			// Test Case: [PipeSchema.error.1]
			it('should handle execute with invalid step', async () => {
				const source = createTestSchema(() => ({ value: 'ok' }))
				const badStep = createTestSchema(() => {
					throw new Error('bad')
				})
				const pipeSchema = new PipeSchema({ meta: { steps: [source, badStep] } })
				const result = await pipeSchema.execute('input')
				expect(result).toHaveProperty('issues')
				expect((result as any).issues[0].code).toBe('UNKNOWN_ERROR')
			})
		})
	})

	describe('`pipe`', () => {
		describe('happy path cases', () => {
			// Test Case: [pipe.happy.1]
			it('should create pipe from schema', () => {
				const source = createTestSchema(() => ({ value: 'test' }))
				const pipeSchema = pipe(source)
				expect(pipeSchema).toBeInstanceOf(PipeSchema)
				expect(pipeSchema.meta.steps).toHaveLength(1)
				expect(pipeSchema.meta.steps[0]).toBe(source)
			})
		})
	})
})
