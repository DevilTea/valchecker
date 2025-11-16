/**
 * Test plan for core module:
 * - Functions tested: implStepPlugin, isSuccess, isFailure, prependIssuePath, handleMessage, resolveMessagePriority, createPipeExecutor, createValchecker.
 * - Valid inputs: Valid execution results, issues with/without paths, message handlers (string/function), valchecker instances.
 * - Invalid inputs: Null/undefined values, edge cases like empty paths, null messages.
 * - Edge cases: Empty path arrays, null/undefined issues, sync/async pipe execution.
 * - Expected behaviors: Correct type guards, message resolution with priority, proper path prepending, valchecker creation and execution.
 * - Coverage goals: 100% statement, branch, and function coverage.
 */

import type { ExecutionIssue, ExecutionResult, StepPluginImpl, TStepPluginDef } from './types'
import { describe, expect, it } from 'vitest'
import { runtimeExecutionStepDefMarker } from '../shared'
import {
	createPipeExecutor,
	createValchecker,
	handleMessage,
	implStepPlugin,
	isFailure,
	isSuccess,
	prependIssuePath,
	resolveMessagePriority,
} from './core'

describe('core module', () => {
	describe('implStepPlugin', () => {
		it('should mark function as valchecker execution step', () => {
			const stepFn = (() => {}) as any
			const result = implStepPlugin(stepFn)

			expect((result as any)[runtimeExecutionStepDefMarker]).toBe(true)
			expect(result).toBe(stepFn)
		})

		it('should return the same function instance', () => {
			const stepFn = (() => {}) as any
			const result = implStepPlugin(stepFn)

			expect(result).toBe(stepFn)
		})

		it('should work with multiple calls', () => {
			const stepFn = (() => {}) as any
			const result1 = implStepPlugin(stepFn)
			const result2 = implStepPlugin(result1)

			expect(result1).toBe(result2)
			expect((result2 as any)[runtimeExecutionStepDefMarker]).toBe(true)
		})
	})

	describe('isSuccess', () => {
		it('should return true for success result', () => {
			const result: ExecutionResult = { value: 'test' }
			expect(isSuccess(result)).toBe(true)
		})

		it('should return true for success result with undefined value', () => {
			const result: ExecutionResult = { value: undefined }
			expect(isSuccess(result)).toBe(true)
		})

		it('should return true for success result with null value', () => {
			const result: ExecutionResult = { value: null }
			expect(isSuccess(result)).toBe(true)
		})

		it('should return false for failure result', () => {
			const result: ExecutionResult = {
				issues: [{
					code: 'test:error',
					payload: {},
					message: 'Test error',
				}],
			}
			expect(isSuccess(result)).toBe(false)
		})

		it('should return false for failure result with empty issues', () => {
			const result: ExecutionResult = { issues: [] }
			expect(isSuccess(result)).toBe(false)
		})
	})

	describe('isFailure', () => {
		it('should return true for failure result', () => {
			const result: ExecutionResult = {
				issues: [{
					code: 'test:error',
					payload: {},
					message: 'Test error',
				}],
			}
			expect(isFailure(result)).toBe(true)
		})

		it('should return true for failure result with empty issues', () => {
			const result: ExecutionResult = { issues: [] }
			expect(isFailure(result)).toBe(true)
		})

		it('should return false for success result', () => {
			const result: ExecutionResult = { value: 'test' }
			expect(isFailure(result)).toBe(false)
		})

		it('should return false for success result with null value', () => {
			const result: ExecutionResult = { value: null }
			expect(isFailure(result)).toBe(false)
		})
	})

	describe('prependIssuePath', () => {
		it('should prepend path to issue with existing path', () => {
			const issue: ExecutionIssue = {
				code: 'test:error',
				payload: {},
				message: 'Test error',
				path: ['nested', 'field'],
			}
			const newPath: PropertyKey[] = ['root', 'parent']

			const result = prependIssuePath(issue, newPath)

			expect(result).toEqual({
				code: 'test:error',
				payload: {},
				message: 'Test error',
				path: ['root', 'parent', 'nested', 'field'],
			})
		})

		it('should prepend path to issue without existing path', () => {
			const issue: ExecutionIssue = {
				code: 'test:error',
				payload: {},
				message: 'Test error',
			}
			const newPath: PropertyKey[] = ['root', 'parent']

			const result = prependIssuePath(issue, newPath)

			expect(result).toEqual({
				code: 'test:error',
				payload: {},
				message: 'Test error',
				path: ['root', 'parent'],
			})
		})

		it('should return issue unchanged when path is null', () => {
			const issue: ExecutionIssue = {
				code: 'test:error',
				payload: {},
				message: 'Test error',
				path: ['nested'],
			}

			const result = prependIssuePath(issue, null as any)

			expect(result).toEqual(issue)
		})

		it('should return issue unchanged when path is empty array', () => {
			const issue: ExecutionIssue = {
				code: 'test:error',
				payload: {},
				message: 'Test error',
				path: ['nested'],
			}
			const newPath: PropertyKey[] = []

			const result = prependIssuePath(issue, newPath)

			expect(result).toEqual(issue)
		})

		it('should handle undefined existing path', () => {
			const issue: ExecutionIssue = {
				code: 'test:error',
				payload: {},
				message: 'Test error',
				path: undefined,
			}
			const newPath: PropertyKey[] = ['root']

			const result = prependIssuePath(issue, newPath)

			expect(result).toEqual({
				code: 'test:error',
				payload: {},
				message: 'Test error',
				path: ['root'],
			})
		})

		it('should handle numeric and symbol property keys', () => {
			const sym = Symbol('test')
			const issue: ExecutionIssue = {
				code: 'test:error',
				payload: {},
				message: 'Test error',
				path: [sym, 0],
			}
			const newPath: PropertyKey[] = ['root', 1]

			const result = prependIssuePath(issue, newPath)

			expect(result).toEqual({
				code: 'test:error',
				payload: {},
				message: 'Test error',
				path: ['root', 1, sym, 0],
			})
		})
	})

	describe('handleMessage', () => {
		it('should return string message as-is', () => {
			const result = handleMessage({
				code: 'test:error',
				payload: { value: 'test' },
			}, 'Custom message')

			expect(result).toBe('Custom message')
		})

		it('should call message function with issue content', () => {
			const messageFn = (issue: any) => `Error: ${issue.code}`
			const result = handleMessage({
				code: 'test:error',
				payload: { value: 'test' },
			}, messageFn)

			expect(result).toBe('Error: test:error')
		})

		it('should return null for null message', () => {
			const result = handleMessage({
				code: 'test:error',
				payload: { value: 'test' },
			}, null)

			expect(result).toBeNull()
		})

		it('should return undefined for undefined message', () => {
			const result = handleMessage({
				code: 'test:error',
				payload: { value: 'test' },
			}, undefined)

			expect(result).toBeUndefined()
		})

		it('should include path in message function parameters', () => {
			const messageFn = (issue: any) => `${issue.path.join('.')}: ${issue.code}`
			const result = handleMessage({
				code: 'test:error',
				payload: { value: 'test' },
				path: ['user', 'email'],
			}, messageFn)

			expect(result).toBe('user.email: test:error')
		})

		it('should use default empty path when not provided', () => {
			const messageFn = (issue: any) => `Path length: ${issue.path.length}`
			const result = handleMessage({
				code: 'test:error',
				payload: { value: 'test' },
			}, messageFn)

			expect(result).toBe('Path length: 0')
		})

		it('should include payload in message function parameters', () => {
			const messageFn = (issue: any) => `Payload: ${JSON.stringify(issue.payload)}`
			const result = handleMessage({
				code: 'test:error',
				payload: { value: 'test', count: 5 },
			}, messageFn)

			expect(result).toBe('Payload: {"value":"test","count":5}')
		})

		it('should handle message function returning null', () => {
			const messageFn = () => null
			const result = handleMessage({
				code: 'test:error',
				payload: { value: 'test' },
			}, messageFn)

			expect(result).toBeNull()
		})

		it('should handle message function returning undefined', () => {
			const messageFn = () => undefined
			const result = handleMessage({
				code: 'test:error',
				payload: { value: 'test' },
			}, messageFn)

			expect(result).toBeUndefined()
		})
	})

	describe('resolveMessagePriority', () => {
		it('should use custom message if available', () => {
			const result = resolveMessagePriority(
				{ code: 'test:error', payload: { value: 'test' } },
				'Custom message',
				'Default message',
				undefined,
			)

			expect(result).toBe('Custom message')
		})

		it('should use default message if custom is null', () => {
			const result = resolveMessagePriority(
				{ code: 'test:error', payload: { value: 'test' } },
				null,
				'Default message',
				undefined,
			)

			expect(result).toBe('Default message')
		})

		it('should use default message if custom is undefined', () => {
			const result = resolveMessagePriority(
				{ code: 'test:error', payload: { value: 'test' } },
				undefined,
				'Default message',
				undefined,
			)

			expect(result).toBe('Default message')
		})

		it('should use global message if custom and default are null', () => {
			const result = resolveMessagePriority(
				{ code: 'test:error', payload: { value: 'test' } },
				null,
				null,
				'Global message',
			)

			expect(result).toBe('Global message')
		})

		it('should use fallback message if all messages are null', () => {
			const result = resolveMessagePriority(
				{ code: 'test:error', payload: { value: 'test' } },
				null,
				null,
				undefined,
			)

			expect(result).toBe('Invalid value.')
		})

		it('should call custom message function and use its result', () => {
			const customMessageFn = (issue: any) => `Custom: ${issue.code}`
			const result = resolveMessagePriority(
				{ code: 'test:error', payload: { value: 'test' } },
				customMessageFn,
				'Default message',
				undefined,
			)

			expect(result).toBe('Custom: test:error')
		})

		it('should call default message function if custom returns null', () => {
			const customMessageFn = () => null
			const defaultMessageFn = (issue: any) => `Default: ${issue.code}`
			const result = resolveMessagePriority(
				{ code: 'test:error', payload: { value: 'test' } },
				customMessageFn,
				defaultMessageFn,
				undefined,
			)

			expect(result).toBe('Default: test:error')
		})

		it('should call global message function if custom and default return null', () => {
			const customMessageFn = () => null
			const defaultMessageFn = () => null
			const globalMessageFn = (issue: any) => `Global: ${issue.code}`
			const result = resolveMessagePriority(
				{ code: 'test:error', payload: { value: 'test' } },
				customMessageFn,
				defaultMessageFn,
				globalMessageFn,
			)

			expect(result).toBe('Global: test:error')
		})

		it('should use fallback if all message functions return null', () => {
			const customMessageFn = () => null
			const defaultMessageFn = () => null
			const globalMessageFn = () => null
			const result = resolveMessagePriority(
				{ code: 'test:error', payload: { value: 'test' } },
				customMessageFn,
				defaultMessageFn,
				globalMessageFn,
			)

			expect(result).toBe('Invalid value.')
		})

		it('should handle undefined custom message function', () => {
			const result = resolveMessagePriority(
				{ code: 'test:error', payload: { value: 'test' } },
				undefined,
				'Default message',
				'Global message',
			)

			expect(result).toBe('Default message')
		})

		it('should include path in message resolution', () => {
			const globalMessageFn = (issue: any) => `Path: ${issue.path.join('.')}`
			const result = resolveMessagePriority(
				{ code: 'test:error', payload: { value: 'test' }, path: ['user', 'email'] },
				null,
				null,
				globalMessageFn,
			)

			expect(result).toBe('Path: user.email')
		})
	})

	describe('createPipeExecutor', () => {
		it('should execute single step with sync function', () => {
			const steps = [
				(result: ExecutionResult) => ({ value: (result as any).value + 1 } as ExecutionResult),
			]
			const executor = createPipeExecutor(steps)

			const result = executor(5)

			expect(result).toEqual({ value: 6 })
		})

		it('should execute multiple steps in sequence', () => {
			const steps = [
				(result: ExecutionResult) => ({ value: (result as any).value + 1 } as ExecutionResult),
				(result: ExecutionResult) => ({ value: (result as any).value * 2 } as ExecutionResult),
			]
			const executor = createPipeExecutor(steps)

			const result = executor(5)

			expect(result).toEqual({ value: 12 })
		})

		it('should execute with empty steps array', () => {
			const steps: ((lastResult: ExecutionResult) => ExecutionResult)[] = []
			const executor = createPipeExecutor(steps)

			const result = executor(5)

			expect(result).toEqual({ value: 5 })
		})

		it('should handle failure result in middle of chain', async () => {
			const steps = [
				(result: ExecutionResult) => {
					if (typeof (result as any).value === 'number') {
						return { value: (result as any).value + 1 } as ExecutionResult
					}
					return result
				},
				(result: ExecutionResult) => {
					if (isFailure(result)) {
						return result
					}
					return { issues: [{ code: 'test:error', payload: {}, message: 'Failed' }] } as ExecutionResult
				},
			]
			const executor = createPipeExecutor(steps)

			const result = await (executor(5) as any)

			expect(isFailure(result)).toBe(true)
		})

		it('should handle async steps', async () => {
			const steps = [
				async (result: ExecutionResult) => ({ value: (result as any).value + 1 } as ExecutionResult),
				(result: ExecutionResult) => ({ value: (result as any).value * 2 } as ExecutionResult),
			]
			const executor = createPipeExecutor(steps)

			const result = await executor(5)

			expect(result).toEqual({ value: 12 })
		})

		it('should handle all async steps', async () => {
			const steps = [
				async (result: ExecutionResult) => ({ value: (result as any).value + 1 } as ExecutionResult),
				async (result: ExecutionResult) => ({ value: (result as any).value * 2 } as ExecutionResult),
			]
			const executor = createPipeExecutor(steps)

			const result = await executor(5)

			expect(result).toEqual({ value: 12 })
		})

		it('should work with Pipe class', () => {
			const steps = [
				(result: ExecutionResult) => ({ value: (result as any).value + 1 } as ExecutionResult),
			]
			const executor = createPipeExecutor(steps)

			const result = executor(5)

			expect(result).toEqual({ value: 6 })
		})

		it('should handle complex value types', () => {
			const steps = [
				(result: ExecutionResult) => {
					const value = (result as any).value as string
					return { value: value.toUpperCase() } as ExecutionResult
				},
			]
			const executor = createPipeExecutor(steps)

			const result = executor('hello')

			expect(result).toEqual({ value: 'HELLO' })
		})

		it('should propagate errors through async chain', async () => {
			const steps = [
				async (_result: ExecutionResult) => {
					throw new Error('Test error')
				},
			]
			const executor = createPipeExecutor(steps)

			try {
				await executor(5)
				expect.fail('Should have thrown')
			}
			catch (error) {
				expect((error as Error).message).toBe('Test error')
			}
		})
	})

	describe('createValchecker', () => {
		it('should create valchecker instance with no steps', () => {
			const v = createValchecker({ steps: [] })

			expect(v).toBeDefined()
			expect((v as any).execute).toBeDefined()
			expect((v as any).isSuccess).toBeDefined()
			expect((v as any).isFailure).toBeDefined()
		})

		it('should handle step methods with proxy handler', () => {
			const mockStepImpl: StepPluginImpl<TStepPluginDef> = {
				testMethod: ({ utils }: any) => {
					utils.addStep((result: ExecutionResult) => result)
				},
			} as any

			const v = createValchecker({ steps: [mockStepImpl] })

			expect((v as any).testMethod).toBeDefined()
			expect(typeof (v as any).testMethod).toBe('function')
		})

		it('should create new instance when calling step method', () => {
			const mockStepImpl: StepPluginImpl<TStepPluginDef> = {
				testMethod: ({ utils }: any) => {
					utils.addStep((result: ExecutionResult) => ({ value: (result as any).value + 1 } as ExecutionResult))
				},
			} as any

			const v = createValchecker({ steps: [mockStepImpl] })
			const chainedV = (v as any).testMethod()

			expect(chainedV).toBeDefined()
			expect((chainedV as any).execute).toBeDefined()
		})

		it('should propagate step methods through the chain', () => {
			const mockStepImpl: StepPluginImpl<TStepPluginDef> = {
				firstMethod: ({ utils }: any) => {
					utils.addStep((result: ExecutionResult) => result)
				},
				secondMethod: ({ utils }: any) => {
					utils.addStep((result: ExecutionResult) => result)
				},
			} as any

			const v = createValchecker({ steps: [mockStepImpl] })

			expect((v as any).firstMethod).toBeDefined()
			expect((v as any).secondMethod).toBeDefined()
		})

		it('should execute with initial value', () => {
			const v = createValchecker({ steps: [] })

			const result = (v as any).execute(5)

			expect(result).toEqual({ value: 5 })
		})

		it('should execute with null value', () => {
			const v = createValchecker({ steps: [] })

			const result = (v as any).execute(null)

			expect(result).toEqual({ value: null })
		})

		it('should execute with undefined value', () => {
			const v = createValchecker({ steps: [] })

			const result = (v as any).execute(undefined)

			expect(result).toEqual({ value: undefined })
		})

		it('should support isSuccess method', () => {
			const v = createValchecker({ steps: [] })

			const result = (v as any).execute(5)

			expect((v as any).isSuccess(result)).toBe(true)
		})

		it('should support isFailure method', () => {
			const v = createValchecker({ steps: [] })

			const result = (v as any).execute(5)

			expect((v as any).isFailure(result)).toBe(false)
		})

		it('should have ~standard property', () => {
			const v = createValchecker({ steps: [] })

			expect((v as any)['~standard']).toBeDefined()
			expect((v as any)['~standard'].version).toBe(1)
			expect((v as any)['~standard'].vendor).toBe('valchecker')
			expect((v as any)['~standard'].validate).toBeDefined()
		})

		it('should have ~core property', () => {
			const v = createValchecker({ steps: [] })

			expect((v as any)['~core']).toBeDefined()
			expect((v as any)['~core'].runtimeSteps).toBeDefined()
			expect(Array.isArray((v as any)['~core'].runtimeSteps)).toBe(true)
		})

		it('should have ~execute property', () => {
			const v = createValchecker({ steps: [] })

			expect((v as any)['~execute']).toBeDefined()
			expect(typeof (v as any)['~execute']).toBe('function')
		})

		it('should support global message handler as string', () => {
			const v = createValchecker({
				steps: [],
				message: 'Global error message',
			})

			expect(v).toBeDefined()
			const result = (v as any).execute(5)
			expect(result).toEqual({ value: 5 })
		})

		it('should support global message handler as function', () => {
			const v = createValchecker({
				steps: [],
				message: (issue: any) => `Error: ${issue.code}`,
			})

			expect(v).toBeDefined()
			const result = (v as any).execute(5)
			expect(result).toEqual({ value: 5 })
		})

		it('should support step methods from multiple steps', () => {
			const mockStep1: StepPluginImpl<TStepPluginDef> = {
				method1: () => {},
			} as any

			const mockStep2: StepPluginImpl<TStepPluginDef> = {
				method2: () => {},
			} as any

			const v = createValchecker({ steps: [mockStep1, mockStep2] })

			expect(Object.prototype.hasOwnProperty.call(v, 'method1')).toBe(false)
			expect(Object.prototype.hasOwnProperty.call(v, 'method2')).toBe(false)
		})

		it('should return same valchecker instance type', () => {
			const v = createValchecker({ steps: [] })

			expect((v as any).execute).toBe((v as any).execute)
		})

		it('should initialize with empty runtime steps', () => {
			const v = createValchecker({ steps: [] })

			expect((v as any)['~core'].runtimeSteps).toEqual([])
		})

		it('should handle complex value types through valchecker', () => {
			const v = createValchecker({ steps: [] })

			const complexValue = { foo: 'bar', nested: { baz: 123 } }
			const result = (v as any).execute(complexValue)

			expect(result).toEqual({ value: complexValue })
		})

		it('should handle array values through valchecker', () => {
			const v = createValchecker({ steps: [] })

			const arrayValue = [1, 2, 3]
			const result = (v as any).execute(arrayValue)

			expect(result).toEqual({ value: arrayValue })
		})

		it('validate method should work', () => {
			const v = createValchecker({ steps: [] })

			const result = (v as any)['~standard'].validate(5)

			expect(result).toEqual({ value: 5 })
		})

		it('should return correct standard schema interface', () => {
			const v = createValchecker({ steps: [] })

			const standard = (v as any)['~standard']
			expect(standard.version).toBe(1)
			expect(standard.vendor).toBe('valchecker')
		})

		it('should have step method utils available through chain', () => {
			const mockStepImpl: StepPluginImpl<TStepPluginDef> = {
				customMethod: ({ utils }: any) => {
					expect(utils.addStep).toBeDefined()
					expect(utils.addSuccessStep).toBeDefined()
					expect(utils.addFailureStep).toBeDefined()
					expect(utils.isSuccess).toBeDefined()
					expect(utils.isFailure).toBeDefined()
					expect(utils.prependIssuePath).toBeDefined()
					expect(utils.resolveMessage).toBeDefined()
					expect(utils.success).toBeDefined()
					expect(utils.failure).toBeDefined()
					expect(utils.issue).toBeDefined()
				},
			} as any

			const v = createValchecker({ steps: [mockStepImpl] })
			const result = (v as any).customMethod()

			expect(result).toBeDefined()
		})

		it('should handle proxy get for internal properties', () => {
			const v = createValchecker({ steps: [] })

			const coreProperty = (v as any)['~core']
			expect(coreProperty).toBeDefined()
			expect(coreProperty.runtimeSteps).toBeDefined()

			const standardProperty = (v as any)['~standard']
			expect(standardProperty).toBeDefined()

			const executeProperty = (v as any)['~execute']
			expect(executeProperty).toBeDefined()
		})

		it('should handle addSuccessStep utility method', () => {
			const mockStepImpl: StepPluginImpl<TStepPluginDef> = {
				successStep: ({ utils }: any) => {
					utils.addSuccessStep((value: any) => utils.success(value + 10))
				},
			} as any

			const v = createValchecker({ steps: [mockStepImpl] })
			const chainedV = (v as any).successStep()

			const result = (chainedV as any).execute(5)
			expect(result).toEqual({ value: 15 })
		})

		it('should handle addFailureStep utility method', () => {
			const mockStepImpl: StepPluginImpl<TStepPluginDef> = {
				failureStep: ({ utils }: any) => {
					utils.addStep(() => utils.failure({ code: 'test:error', payload: {}, message: 'Error' }))
					utils.addFailureStep((_issues: any) => utils.success('handled'))
				},
			} as any

			const v = createValchecker({ steps: [mockStepImpl] })
			const chainedV = (v as any).failureStep()

			const result = (chainedV as any).execute(5)
			expect(result).toEqual({ value: 'handled' })
		})

		it('should handle failure in addSuccessStep chain', () => {
			const mockStepImpl: StepPluginImpl<TStepPluginDef> = {
				stepA: ({ utils }: any) => {
					utils.addStep(() => utils.failure({ code: 'test:error', payload: {}, message: 'Error' }))
				},
				stepB: ({ utils }: any) => {
					utils.addSuccessStep((value: any) => utils.success(value + 1))
				},
			} as any

			const v = createValchecker({ steps: [mockStepImpl] })
			const chainedV = (v as any).stepA().stepB()

			const result = (chainedV as any).execute(5)
			expect(isFailure(result)).toBe(true)
		})

		it('should handle success in addFailureStep chain', () => {
			const mockStepImpl: StepPluginImpl<TStepPluginDef> = {
				stepA: ({ utils }: any) => {
					utils.addStep(() => utils.success(5))
				},
				stepB: ({ utils }: any) => {
					utils.addFailureStep((_issues: any) => utils.success('handled'))
				},
			} as any

			const v = createValchecker({ steps: [mockStepImpl] })

			const chainedV = (v as any).stepA().stepB()

			const result = (chainedV as any).execute(10)
			expect(result).toEqual({ value: 5 })
		})

		it('should support resolveMessage through utils', () => {
			const mockStepImpl: StepPluginImpl<TStepPluginDef> = {
				messageStep: ({ utils }: any) => {
					const msg = utils.resolveMessage({ code: 'test:code', payload: {} }, null, 'default', undefined)
					expect(msg).toBe('default')
				},
			} as any

			const v = createValchecker({ steps: [mockStepImpl] })
			const chainedV = (v as any).messageStep()

			expect(chainedV).toBeDefined()
		})

		it('should support issue utility method', () => {
			const mockStepImpl: StepPluginImpl<TStepPluginDef> = {
				issueStep: ({ utils }: any) => {
					const issue = utils.issue({ code: 'test:error', payload: {}, message: 'Error' })
					expect(issue.code).toBe('test:error')
				},
			} as any

			const v = createValchecker({ steps: [mockStepImpl] })
			const chainedV = (v as any).issueStep()

			expect(chainedV).toBeDefined()
		})

		it('should pass params to step method', () => {
			const mockStepImpl: StepPluginImpl<TStepPluginDef> = {
				paramStep: ({ params }: any) => {
					expect(params).toEqual(['arg1', 'arg2'])
				},
			} as any

			const v = createValchecker({ steps: [mockStepImpl] })
			const chainedV = (v as any).paramStep('arg1', 'arg2')

			expect(chainedV).toBeDefined()
		})

		it('should handle multiple chained step methods', () => {
			const mockStepImpl: StepPluginImpl<TStepPluginDef> = {
				step1: ({ utils }: any) => {
					utils.addStep((result: ExecutionResult) => ({ value: (result as any).value + 1 } as ExecutionResult))
				},
				step2: ({ utils }: any) => {
					utils.addStep((result: ExecutionResult) => ({ value: (result as any).value * 2 } as ExecutionResult))
				},
				step3: ({ utils }: any) => {
					utils.addStep((result: ExecutionResult) => ({ value: (result as any).value - 3 } as ExecutionResult))
				},
			} as any

			const v = createValchecker({ steps: [mockStepImpl] })
			const chainedV = (v as any)
				.step1()
				.step2()
				.step3()

			const result = (chainedV as any).execute(5)
			expect(result).toEqual({ value: 9 })
		})

		it('should handle synchronous exceptions in step execution', () => {
			const mockStepImpl: StepPluginImpl<TStepPluginDef> = {
				throwStep: ({ utils }: any) => {
					utils.addStep((_result: ExecutionResult) => {
						throw new Error('sync error')
					})
				},
			} as any

			const v = createValchecker({ steps: [mockStepImpl] })
			const chainedV = (v as any).throwStep()

			const result = (chainedV as any).execute('test')
			expect(result).toEqual({
				issues: [{
					code: 'core:unknown_exception',
					payload: { method: 'throwStep', value: { value: 'test' }, error: new Error('sync error') },
					message: 'An unexpected error occurred during step execution',
				}],
			})
		})

		it('should handle async rejections in step execution', async () => {
			const mockStepImpl: StepPluginImpl<TStepPluginDef> = {
				asyncThrowStep: ({ utils }: any) => {
					utils.addStep(async (_result: ExecutionResult) => {
						throw new Error('async error')
					})
				},
			} as any

			const v = createValchecker({ steps: [mockStepImpl] })
			const chainedV = (v as any).asyncThrowStep()

			const result = await (chainedV as any).execute('test')
			expect(result).toEqual({
				issues: [{
					code: 'core:unknown_exception',
					payload: { method: 'asyncThrowStep', value: { value: 'test' }, error: new Error('async error') },
					message: 'An unexpected error occurred during step execution',
				}],
			})
		})
	})
})
