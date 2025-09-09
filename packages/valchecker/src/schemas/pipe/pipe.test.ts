import { describe, expect, it } from 'vitest'
import { AbstractSchema, implementSchemaClass } from './base'
import { PipeSchema } from './pipe'

describe('tests of `PipeSchema.validate`', () => {
	describe('happy path cases', () => {
		describe('case 1: validates successfully through single step pipeline', () => {
			it('should return success', () => {
				class TestSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(TestSchema, {
					validate: value => ({ value }),
				})

				const pipeline = new PipeSchema({ meta: { steps: [new TestSchema()] } })
				const result = pipeline.validate('test')
				expect(result).toEqual({ value: 'test' })
			})
		})

		describe('case 2: validates successfully through multi-step pipeline', () => {
			it('should return transformed result', () => {
				class Step1Schema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}
				class Step2Schema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: any, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(Step1Schema, {
					validate: value => ({ value: `${value} step1` }),
				})

				implementSchemaClass(Step2Schema, {
					validate: value => ({ value: `${value.value} step2` }),
				})

				const pipeline = new PipeSchema({
					meta: {
						steps: [new Step1Schema(), new Step2Schema()],
					},
				})
				const result = pipeline.validate('test')
				expect(result).toEqual({ value: 'test step1 step2' })
			})
		})

		describe('case 3: handles async pipeline with successful validation', () => {
			it('should return promise resolving to result', async () => {
				class AsyncSchema extends AbstractSchema<{ async: true, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(AsyncSchema, {
					validate: value => Promise.resolve({ value: `${value} async` }),
				})

				const pipeline = new PipeSchema({ meta: { steps: [new AsyncSchema()] } })
				const result = await pipeline.validate('test')
				expect(result).toEqual({ value: 'test async' })
			})
		})

		describe('case 4: stops at first failure in pipeline', () => {
			it('should return failure from first failing step', () => {
				class SuccessSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}
				class FailureSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: any, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(SuccessSchema, {
					validate: value => ({ value }),
				})

				implementSchemaClass(FailureSchema, {
					validate: (_value, { failure, issue }) => failure(issue('TEST_ERROR')),
				})

				const pipeline = new PipeSchema({
					meta: {
						steps: [new SuccessSchema(), new FailureSchema()],
					},
				})
				const result = pipeline.validate('test')
				expect(result).toEqual({
					issues: [{
						code: 'TEST_ERROR',
						message: 'Invalid value.',
						path: undefined,
					}],
				})
			})
		})
	})

	describe('edge cases', () => {
		describe('case 2: propagates errors from any step in pipeline', () => {
			it('should return failure from middle step', () => {
				class SuccessSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}
				class FailureSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: any, output: string, issueCode: 'MIDDLE_ERROR' }> {}
				class SuccessSchema2 extends AbstractSchema<{ async: false, transformed: false, meta: null, input: any, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(SuccessSchema, {
					validate: value => ({ value }),
				})

				implementSchemaClass(FailureSchema, {
					validate: (_value, { failure, issue }) => failure(issue('MIDDLE_ERROR')),
				})

				implementSchemaClass(SuccessSchema2, {
					validate: (value, { success, failure }) => {
						if ('value' in value) {
							return success(value.value)
						}
						return failure(value.issues)
					},
				})

				const pipeline = new PipeSchema({
					meta: {
						steps: [new SuccessSchema(), new FailureSchema(), new SuccessSchema2()],
					},
				})
				const result = pipeline.validate('test')
				expect(result).toEqual({
					issues: [{
						code: 'MIDDLE_ERROR',
						message: 'Invalid value.',
						path: undefined,
					}],
				})
			})
		})

		describe('case 3: handles mixed sync/async steps in pipeline', () => {
			it('should return promise resolving to result', async () => {
				class SyncSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}
				class AsyncSchema extends AbstractSchema<{ async: true, transformed: false, meta: null, input: any, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(SyncSchema, {
					validate: value => ({ value: `${value} sync` }),
				})

				implementSchemaClass(AsyncSchema, {
					validate: value => Promise.resolve({ value: `${value.value} async` }),
				})

				const pipeline = new PipeSchema({
					meta: {
						steps: [new SyncSchema(), new AsyncSchema()],
					},
				})
				const result = await pipeline.validate('test')
				expect(result).toEqual({ value: 'test sync async' })
			})
		})
	})
})

describe('tests of `PipeSchema.check`', () => {
	describe('happy path cases', () => {
		describe('case 1: adds check step to pipeline', () => {
			it('should add check step', () => {
				class BaseSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(BaseSchema, {
					validate: value => ({ value }),
				})

				const pipeline = new PipeSchema({ meta: { steps: [new BaseSchema()] } })
				const result = pipeline.check(() => true)
				expect(result.meta.steps).toHaveLength(2)
			})
		})

		describe('case 2: check step validates successfully', () => {
			it('should continue to next step', () => {
				class BaseSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(BaseSchema, {
					validate: value => ({ value }),
				})

				const pipeline = new PipeSchema({ meta: { steps: [new BaseSchema()] } })
					.check(() => true)

				const result = pipeline.validate('test')
				expect(result).toEqual({ value: 'test' })
			})
		})

		describe('case 3: check step fails validation', () => {
			it('should stop with check failure', () => {
				class BaseSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(BaseSchema, {
					validate: value => ({ value }),
				})

				const pipeline = new PipeSchema({ meta: { steps: [new BaseSchema()] } })
					.check(() => false)

				const result = pipeline.validate('test')
				expect(result).toEqual({
					issues: [{
						code: 'CHECK_FAILED',
						message: 'Invalid value.',
						path: undefined,
					}],
				})
			})
		})
	})
})

describe('tests of `PipeSchema.transform`', () => {
	describe('happy path cases', () => {
		describe('case 1: adds transform step to pipeline', () => {
			it('should add transform step', () => {
				class BaseSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(BaseSchema, {
					validate: value => ({ value }),
				})

				const pipeline = new PipeSchema({ meta: { steps: [new BaseSchema()] } })
				const result = pipeline.transform(value => `${value} transformed`)
				expect(result.meta.steps).toHaveLength(2)
			})
		})

		describe('case 2: transform step modifies value successfully', () => {
			it('should pass transformed value to next step', () => {
				class BaseSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(BaseSchema, {
					validate: value => ({ value }),
				})

				const pipeline = new PipeSchema({ meta: { steps: [new BaseSchema()] } })
					.transform(value => `${value} transformed`)

				const result = pipeline.validate('test')
				expect(result).toEqual({ value: 'test transformed' })
			})
		})
	})
})

describe('tests of `PipeSchema.fallback`', () => {
	describe('happy path cases', () => {
		describe('case 1: adds fallback step to pipeline', () => {
			it('should add fallback step', () => {
				class BaseSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(BaseSchema, {
					validate: value => ({ value }),
				})

				const pipeline = new PipeSchema({ meta: { steps: [new BaseSchema()] } })
				const result = pipeline.fallback('fallback value')
				expect(result.meta.steps).toHaveLength(2)
			})
		})

		describe('case 2: fallback executes when previous step fails', () => {
			it('should return fallback value', () => {
				class FailureSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(FailureSchema, {
					validate: (_value, { failure, issue }) => failure(issue('TEST_ERROR')),
				})

				const pipeline = new PipeSchema({ meta: { steps: [new FailureSchema()] } })
					.fallback('fallback value')

				const result = pipeline.validate('test')
				expect(result).toEqual({ value: 'fallback value' })
			})
		})

		describe('case 3: fallback not executed when previous step succeeds', () => {
			it('should pass through original value', () => {
				class SuccessSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(SuccessSchema, {
					validate: value => ({ value }),
				})

				const pipeline = new PipeSchema({ meta: { steps: [new SuccessSchema()] } })
					.fallback('fallback value')

				const result = pipeline.validate('test')
				expect(result).toEqual({ value: 'test' })
			})
		})
	})
})
