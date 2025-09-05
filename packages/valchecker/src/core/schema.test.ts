import { describe, expect, it } from 'vitest'
import { implementSchemaClass } from './base'
import { AbstractSchema } from './schema'

describe('tests of `AbstractSchema.check`', () => {
	describe('happy path cases', () => {
		describe('case 1: adds check step to schema', () => {
			it('should return PipeSchema with check step', () => {
				class TestSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(TestSchema, {
					validate: value => ({ value }),
				})

				const schema = new TestSchema()
				const result = schema.check(() => true)
				expect(result.meta.steps).toHaveLength(2)
			})
		})

		describe('case 2: check step validates successfully', () => {
			it('should continue to next step', () => {
				class TestSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(TestSchema, {
					validate: value => ({ value }),
				})

				const schema = new TestSchema()
				const pipeline = schema.check(() => true)
				const result = pipeline.validate('test')
				expect(result).toEqual({ value: 'test' })
			})
		})

		describe('case 3: check step fails validation', () => {
			it('should stop with check failure', () => {
				class TestSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(TestSchema, {
					validate: value => ({ value }),
				})

				const schema = new TestSchema()
				const pipeline = schema.check(() => false)
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

describe('tests of `AbstractSchema.transform`', () => {
	describe('happy path cases', () => {
		describe('case 1: adds transform step to schema', () => {
			it('should return PipeSchema with transform step', () => {
				class TestSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(TestSchema, {
					validate: value => ({ value }),
				})

				const schema = new TestSchema()
				const result = schema.transform(value => `${value} transformed`)
				expect(result.meta.steps).toHaveLength(2)
			})
		})

		describe('case 2: transform step modifies value successfully', () => {
			it('should pass transformed value to next step', () => {
				class TestSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(TestSchema, {
					validate: value => ({ value }),
				})

				const schema = new TestSchema()
				const pipeline = schema.transform(value => `${value} transformed`)
				const result = pipeline.validate('test')
				expect(result).toEqual({ value: 'test transformed' })
			})
		})
	})
})

describe('tests of `AbstractSchema.fallback`', () => {
	describe('happy path cases', () => {
		describe('case 1: adds fallback step to schema', () => {
			it('should return PipeSchema with fallback step', () => {
				class TestSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(TestSchema, {
					validate: value => ({ value }),
				})

				const schema = new TestSchema()
				const result = schema.fallback('fallback value')
				expect(result.meta.steps).toHaveLength(2)
			})
		})

		describe('case 2: fallback executes when validation fails', () => {
			it('should return fallback value', () => {
				class FailureSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(FailureSchema, {
					validate: (_value, { failure, issue }) => failure(issue('TEST_ERROR')),
				})

				const schema = new FailureSchema()
				const pipeline = schema.fallback('fallback value')
				const result = pipeline.validate('test')
				expect(result).toEqual({ value: 'fallback value' })
			})
		})

		describe('case 3: fallback not executed when validation succeeds', () => {
			it('should pass through original value', () => {
				class SuccessSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(SuccessSchema, {
					validate: value => ({ value }),
				})

				const schema = new SuccessSchema()
				const pipeline = schema.fallback('fallback value')
				const result = pipeline.validate('test')
				expect(result).toEqual({ value: 'test' })
			})
		})
	})
})

describe('tests of `AbstractSchema` inheritance', () => {
	describe('happy path cases', () => {
		describe('case 1: inherits AbstractBaseSchema properties', () => {
			it('should have validate method', () => {
				class TestSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(TestSchema, {
					validate: value => ({ value }),
				})

				const schema = new TestSchema()
				expect(typeof schema.validate).toBe('function')
			})
		})

		describe('case 2: inherits AbstractBaseSchema isValid method', () => {
			it('should have isValid method', () => {
				class TestSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(TestSchema, {
					validate: value => ({ value }),
				})

				const schema = new TestSchema()
				expect(typeof schema.isValid).toBe('function')
			})
		})

		describe('case 3: has isTransformed property', () => {
			it('should have isTransformed property', () => {
				class TestSchema extends AbstractSchema<{ async: false, transformed: false, meta: null, input: string, output: string, issueCode: 'TEST_ERROR' }> {}

				implementSchemaClass(TestSchema, {
					validate: value => ({ value }),
				})

				const schema = new TestSchema()
				expect(typeof schema.isTransformed).toBe('boolean')
			})
		})
	})
})
