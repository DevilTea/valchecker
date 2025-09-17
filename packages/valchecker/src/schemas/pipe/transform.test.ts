import { describe, expect, it } from 'vitest'
import { defineRunTransform, PipeStepTransformSchema } from './transform'

describe('tests of `PipeStepTransformSchema.validate`', () => {
	describe('happy path cases', () => {
		describe('case 1: transforms value successfully', () => {
			it('should return transformed value', () => {
				const transformStep = new PipeStepTransformSchema({
					meta: {
						run: (value: string) => `${value} transformed`,
					},
				})

				const result = transformStep.validate({ value: 'test' })
				expect(result).toEqual({ value: 'test transformed' })
			})
		})

		describe('case 2: handles async transformation', () => {
			it('should return promise resolving to transformed value', async () => {
				const transformStep = new PipeStepTransformSchema({
					meta: {
						run: async (value: string) => `${value} async transformed`,
					},
				})

				const result = await transformStep.validate({ value: 'test' })
				expect(result).toEqual({ value: 'test async transformed' })
			})
		})

		describe('case 3: passes through failure from previous step', () => {
			it('should return original failure unchanged', () => {
				const transformStep = new PipeStepTransformSchema({
					meta: {
						run: (value: string) => `${value} transformed`,
					},
				})

				const failureResult = {
					issues: [{
						code: 'PREVIOUS_ERROR',
						message: 'Previous step failed',
						path: undefined,
					}],
				}

				const result = transformStep.validate(failureResult)
				expect(result).toEqual(failureResult)
			})
		})
	})

	describe('edge cases', () => {
		describe('case 1: handles transformation errors', () => {
			it('should return TRANSFORM_FAILED error', () => {
				const transformStep = new PipeStepTransformSchema({
					meta: {
						run: (_value: string) => {
							throw new Error('Transform failed')
						},
					},
				})

				const result = transformStep.validate({ value: 'test' })
				expect(result).toEqual({
					issues: [{
						code: 'TRANSFORM_FAILED',
						message: 'Invalid value.',
						path: undefined,
						error: new Error('Transform failed'),
					}],
				})
			})
		})

		describe('case 2: handles async transformation errors', () => {
			it('should return TRANSFORM_FAILED error', async () => {
				const transformStep = new PipeStepTransformSchema({
					meta: {
						run: async (_value: string) => {
							throw new Error('Async transform failed')
						},
					},
				})

				const result = await transformStep.validate({ value: 'test' })
				expect(result).toEqual({
					issues: [{
						code: 'TRANSFORM_FAILED',
						message: 'Invalid value.',
						path: undefined,
						error: new Error('Async transform failed'),
					}],
				})
			})
		})
	})
})

describe('tests of `PipeStepTransformSchema` properties', () => {
	describe('happy path cases', () => {
		describe('case 1: has correct isTransformed property', () => {
			it('should be true', () => {
				const transformStep = new PipeStepTransformSchema({
					meta: {
						run: (value: string) => value,
					},
				})

				expect(transformStep.isTransformed).toBe(true)
			})
		})

		describe('case 2: has correct meta property', () => {
			it('should contain transform function', () => {
				const transformFn = (value: string) => value.toUpperCase()
				const transformStep = new PipeStepTransformSchema({
					meta: {
						run: transformFn,
					},
				})

				expect(transformStep.meta.run).toBe(transformFn)
			})
		})
	})
})

describe('tests of `defineRunTransform`', () => {
	describe('happy path cases', () => {
		describe('case 1: returns an object with implement method', () => {
			it('should return object with implement function', () => {
				const result = defineRunTransform<string>()
				expect(typeof result.implement).toBe('function')
			})
		})
		describe('case 2: implement method returns the run function', () => {
			it('should return the provided run function', () => {
				const runFn = (value: string) => value.toUpperCase()
				const result = defineRunTransform<string>()
				expect(result.implement(runFn)).toBe(runFn)
			})
		})
	})
})
