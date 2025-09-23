import { describe, expect, it } from 'vitest'
import { AbstractSchema, implementSchemaClass } from '../../core'
import { PipeStepRunSchema } from './run'

// Specification: ./run.spec.md

describe('tests for `run.ts`', () => {
	// Corresponds to `PipeStepRunSchema` section in the spec
	describe('`PipeStepRunSchema`', () => {
		describe('happy path cases', () => {
			// Test Case: [PipeStepRunSchema.happy.1]
			it('should execute with success, nested succeeds', async () => {
				class NestedSchema extends AbstractSchema {
					constructor() {
						super()
					}
				}
				implementSchemaClass(NestedSchema, {
					execute: () => ({ value: 'nested' }),
				})

				const nested = new NestedSchema()
				const runSchema = new PipeStepRunSchema({ meta: { schema: nested } })
				const result = await runSchema.execute({ value: 'input' })
				expect(result).toEqual({ value: 'nested' })
			})
		})

		describe('edge cases', () => {
			// Test Case: [PipeStepRunSchema.edge.1]
			it('should execute with failure result', async () => {
				class NestedSchema extends AbstractSchema {
					constructor() {
						super()
					}
				}
				implementSchemaClass(NestedSchema, {
					execute: () => ({ value: 'nested' }),
				})

				const nested = new NestedSchema()
				const runSchema = new PipeStepRunSchema({ meta: { schema: nested } })
				const result = await runSchema.execute({ issues: [] })
				expect(result).toEqual({ issues: [] })
			})

			// Test Case: [PipeStepRunSchema.edge.2]
			it('should execute with async nested schema', async () => {
				class NestedSchema extends AbstractSchema {
					constructor() {
						super()
					}
				}
				implementSchemaClass(NestedSchema, {
					execute: () => Promise.resolve({ value: 'async' }),
				})

				const nested = new NestedSchema()
				const runSchema = new PipeStepRunSchema({ meta: { schema: nested } })
				const result = await runSchema.execute({ value: 'input' })
				expect(result).toEqual({ value: 'async' })
			})
		})

		describe('error cases', () => {
			// Test Case: [PipeStepRunSchema.error.1]
			it('should execute with success, nested fails', async () => {
				class NestedSchema extends AbstractSchema {
					constructor() {
						super()
					}
				}
				implementSchemaClass(NestedSchema, {
					execute: () => ({ issues: [{ code: 'nested_fail' }] } as any),
				})

				const nested = new NestedSchema()
				const runSchema = new PipeStepRunSchema({ meta: { schema: nested } })
				const result = await runSchema.execute({ value: 'input' })
				expect(result).toHaveProperty('issues')
			})
		})
	})
})
