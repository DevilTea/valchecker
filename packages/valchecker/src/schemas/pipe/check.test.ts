import type { RunCheck } from './check'
import { describe, expect, it } from 'vitest'
import { defineRunCheck, PipeStepCheckSchema } from './check'

describe('tests of `PipeStepCheckSchema.validate`', () => {
	describe('happy path cases', () => {
		describe('case 1: returns success when check function returns true', () => {
			it('should return success', () => {
				const checkFn: RunCheck<string> = () => true
				const schema = new PipeStepCheckSchema({ meta: { run: checkFn } })
				const lastResult = { value: 'test' }
				const result = schema.validate(lastResult as any)
				expect(result).toEqual({ value: 'test' })
			})
		})

		describe('case 2: returns success when check function returns void (no issues added)', () => {
			it('should return success', () => {
				const checkFn: RunCheck<string> = () => {}
				const schema = new PipeStepCheckSchema({ meta: { run: checkFn } })
				const lastResult = { value: 'test' }
				const result = schema.validate(lastResult as any)
				expect(result).toEqual({ value: 'test' })
			})
		})

		describe('case 3: returns failure when check function returns false', () => {
			it('should return failure with CHECK_FAILED', () => {
				const checkFn: RunCheck<string> = () => false
				const schema = new PipeStepCheckSchema({ meta: { run: checkFn } })
				const lastResult = { value: 'test' }
				const result = schema.validate(lastResult as any)
				expect(result).toEqual({
					issues: [{
						code: 'CHECK_FAILED',
						message: 'Invalid value.',
						path: undefined,
					}],
				})
			})
		})

		describe('case 4: returns failure when check function returns string', () => {
			it('should return failure with CHECK_FAILED and custom message', () => {
				const checkFn: RunCheck<string> = () => 'error message'
				const schema = new PipeStepCheckSchema({ meta: { run: checkFn } })
				const lastResult = { value: 'test' }
				const result = schema.validate(lastResult as any)
				expect(result).toEqual({
					issues: [{
						code: 'CHECK_FAILED',
						message: 'error message',
						path: undefined,
					}],
				})
			})
		})

		describe('case 5: returns failure when check function adds issues via utils', () => {
			it('should return failure with custom issues', () => {
				const checkFn: RunCheck<string> = (_value, { addIssue }) => {
					addIssue({ code: 'CUSTOM_ERROR', message: 'Custom error' })
				}
				const schema = new PipeStepCheckSchema({ meta: { run: checkFn } })
				const lastResult = { value: 'test' }
				const result = schema.validate(lastResult as any)
				expect(result).toEqual({
					issues: [{
						code: 'CUSTOM_ERROR',
						message: 'Custom error',
					}],
				})
			})
		})

		describe('case 6: handles async check function returning true', () => {
			it('should return promise resolving to success', async () => {
				const checkFn: RunCheck<string> = async () => true
				const schema = new PipeStepCheckSchema({ meta: { run: checkFn } })
				const lastResult = { value: 'test' }
				const result = await schema.validate(lastResult as any)
				expect(result).toEqual({ value: 'test' })
			})
		})

		describe('case 7: handles async check function returning false', () => {
			it('should return promise resolving to failure', async () => {
				const checkFn: RunCheck<string> = async () => false
				const schema = new PipeStepCheckSchema({ meta: { run: checkFn } })
				const lastResult = { value: 'test' }
				const result = await schema.validate(lastResult as any)
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

	describe('edge cases', () => {
		describe('case 1: passes through failure when lastResult is already failure', () => {
			it('should return the original failure', () => {
				const checkFn: RunCheck<string> = () => true
				const schema = new PipeStepCheckSchema({ meta: { run: checkFn } })
				const lastResult = { issues: [{ code: 'PREVIOUS_ERROR' }] }
				const result = schema.validate(lastResult as any)
				expect(result).toEqual({ issues: [{ code: 'PREVIOUS_ERROR' }] })
			})
		})

		describe('case 2: handles check function throwing synchronous error', () => {
			it('should return failure with CHECK_FAILED and error', () => {
				const checkFn: RunCheck<string> = () => {
					throw new Error('check error')
				}
				const schema = new PipeStepCheckSchema({ meta: { run: checkFn } })
				const lastResult = { value: 'test' }
				const result = schema.validate(lastResult as any)
				expect(result).toEqual({
					issues: [{
						code: 'CHECK_FAILED',
						error: new Error('check error'),
						message: 'Invalid value.',
						path: undefined,
					}],
				})
			})
		})

		describe('case 3: handles async check function rejecting', () => {
			it('should return promise resolving to failure with error', async () => {
				const checkFn: RunCheck<string> = async () => {
					throw new Error('async check error')
				}
				const schema = new PipeStepCheckSchema({ meta: { run: checkFn } })
				const lastResult = { value: 'test' }
				const result = await schema.validate(lastResult as any)
				expect(result).toEqual({
					issues: [{
						code: 'CHECK_FAILED',
						error: new Error('async check error'),
						message: 'Invalid value.',
						path: undefined,
					}],
				})
			})
		})

		describe('case 4: combines custom issues with CHECK_FAILED when returning false', () => {
			it('should return combined issues', () => {
				const checkFn: RunCheck<string> = (_value, { addIssue }) => {
					addIssue({ code: 'CUSTOM_ERROR', message: 'Custom error' })
					return false
				}
				const schema = new PipeStepCheckSchema({ meta: { run: checkFn } })
				const lastResult = { value: 'test' }
				const result = schema.validate(lastResult as any)
				expect(result).toEqual({
					issues: [
						{ code: 'CUSTOM_ERROR', message: 'Custom error' },
						{
							code: 'CHECK_FAILED',
							message: 'Invalid value.',
							path: undefined,
						},
					],
				})
			})
		})

		describe('case 5: combines custom issues with CHECK_FAILED when returning string', () => {
			it('should return combined issues', () => {
				const checkFn: RunCheck<string> = (_value, { addIssue }) => {
					addIssue({ code: 'CUSTOM_ERROR', message: 'Custom error' })
					return 'check message'
				}
				const schema = new PipeStepCheckSchema({ meta: { run: checkFn } })
				const lastResult = { value: 'test' }
				const result = schema.validate(lastResult as any)
				expect(result).toEqual({
					issues: [
						{ code: 'CUSTOM_ERROR', message: 'Custom error' },
						{
							code: 'CHECK_FAILED',
							message: 'check message',
							path: undefined,
						},
					],
				})
			})
		})
	})
})

describe('tests of `defineRunCheck`', () => {
	describe('happy path cases', () => {
		describe('case 1: returns an object with implement method', () => {
			it('should return object with implement function', () => {
				const result = defineRunCheck<string>()
				expect(typeof result.implement).toBe('function')
			})
		})
		describe('case 2: implement method returns the run function', () => {
			it('should return the provided run function', () => {
				const runFn = () => true
				const result = defineRunCheck<string>()
				expect(result.implement(runFn)).toBe(runFn)
			})
		})
	})
})
