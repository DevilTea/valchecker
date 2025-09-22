import { describe, expect, it } from 'vitest'
import { createExecutionChain, createObject, ExecutionChain, expectNever, NullProtoObj, returnFalse, returnTrue, throwNotImplementedError } from './shared'

// Specification: ./shared.spec.md

describe('tests for `shared.ts`', () => {
	// Corresponds to `NullProtoObj` section in the spec
	describe('`NullProtoObj`', () => {
		describe('happy path cases', () => {
			// Test Case: [NullProtoObj.happy.1]
			it('should create object with null prototype', () => {
				const obj = new NullProtoObj()
				expect(Object.getPrototypeOf(Object.getPrototypeOf(obj))).toBe(null)
			})
		})
	})

	describe('`createObject`', () => {
		describe('happy path cases', () => {
			// Test Case: [createObject.happy.1]
			it('should create empty object', () => {
				const obj = createObject()
				expect(Object.getPrototypeOf(Object.getPrototypeOf(obj))).toBe(null)
				expect(obj).toEqual({})
			})

			// Test Case: [createObject.happy.2]
			it('should create object with properties', () => {
				const obj = createObject({ a: 1, b: 2 })
				expect(Object.getPrototypeOf(Object.getPrototypeOf(obj))).toBe(null)
				expect(obj).toEqual({ a: 1, b: 2 })
			})
		})
	})

	describe('`throwNotImplementedError`', () => {
		describe('happy path cases', () => {
			// Test Case: [throwNotImplementedError.happy.1]
			it('should throw not implemented error', () => {
				expect(() => throwNotImplementedError()).toThrow('Method not implemented.')
			})
		})
	})

	describe('`expectNever`', () => {
		describe('happy path cases', () => {
			// Test Case: [expectNever.happy.1]
			it('should throw with value', () => {
				expect(() => expectNever()).toThrow('Expected never, but got: undefined')
			})
		})
	})

	describe('`returnTrue`', () => {
		describe('happy path cases', () => {
			// Test Case: [returnTrue.happy.1]
			it('should return true', () => {
				expect(returnTrue()).toBe(true)
			})
		})
	})

	describe('`returnFalse`', () => {
		describe('happy path cases', () => {
			// Test Case: [returnFalse.happy.1]
			it('should return false', () => {
				expect(returnFalse()).toBe(false)
			})
		})
	})

	describe('`ExecutionChain`', () => {
		describe('happy path cases', () => {
			// Test Case: [ExecutionChain.happy.1]
			it('should create with sync value', () => {
				const chain = new ExecutionChain('value')
				expect(chain.output).toBe('value')
			})

			// Test Case: [ExecutionChain.happy.2]
			it('should create with promise', async () => {
				const chain = new ExecutionChain(Promise.resolve('async'))
				expect(await chain.output).toBe('async')
			})

			// Test Case: [ExecutionChain.happy.3]
			it('should create with sync error', () => {
				const chain = new ExecutionChain(undefined, 'error')
				expect(() => chain.output).toThrow('error')
			})

			// Test Case: [ExecutionChain.happy.4]
			it('should then with sync value', () => {
				const chain = new ExecutionChain('val')
				const result = chain.then(v => `${v}2`)
				expect(result.output).toBe('val2')
			})

			// Test Case: [ExecutionChain.happy.5]
			it('should then with promise', async () => {
				const chain = new ExecutionChain(Promise.resolve('async'))
				const result = chain.then(v => `${v}2`)
				expect(await result.output).toBe('async2')
			})

			// Test Case: [ExecutionChain.happy.6]
			it('should output sync', () => {
				const chain = new ExecutionChain('val')
				expect(chain.output).toBe('val')
			})

			// Test Case: [ExecutionChain.happy.7]
			it('should output promise', async () => {
				const chain = new ExecutionChain(Promise.resolve('async'))
				expect(await chain.output).toBe('async')
			})
		})

		describe('edge cases', () => {
			// Test Case: [ExecutionChain.edge.1]
			it('should then without callbacks', () => {
				const chain = new ExecutionChain('val')
				const result = chain.then()
				expect(result).toBe(chain)
			})

			// Test Case: [ExecutionChain.edge.2]
			it('should copy from another chain', () => {
				const original = new ExecutionChain('val')
				const copy = new ExecutionChain(original)
				expect(copy.output).toBe('val')
			})
		})

		describe('error cases', () => {
			// Test Case: [ExecutionChain.error.1]
			it('should throw for invalid args', () => {
				expect(() => new (ExecutionChain as any)(Promise.resolve('val'), 'error')).toThrow('ExecutionChain cannot have both an async value and a sync error.')
			})

			// Test Case: [ExecutionChain.error.2]
			it('should handle then throws', () => {
				const chain = new ExecutionChain('val')
				const result = chain.then(() => {
					throw new Error('err')
				})
				expect(() => result.output).toThrow('err')
			})

			it('should handle onrejected throws', () => {
				const chain = new ExecutionChain(undefined, 'syncError')
				const result = chain.then(null, () => {
					throw new Error('rejectErr')
				})
				expect(() => result.output).toThrow('rejectErr')
			})

			it('should return same chain for sync error without onrejected', () => {
				const chain = new ExecutionChain(undefined, 'syncError')
				const result = chain.then(null, null)
				expect(result).toBe(chain)
			})
		})
	})

	describe('`createExecutionChain`', () => {
		describe('happy path cases', () => {
			// Test Case: [createExecutionChain.happy.1]
			it('should create without value', () => {
				const chain = createExecutionChain()
				expect(chain.output).toBeUndefined()
			})

			// Test Case: [createExecutionChain.happy.2]
			it('should create with value', () => {
				const chain = createExecutionChain('val')
				expect(chain.output).toBe('val')
			})
		})
	})
})
