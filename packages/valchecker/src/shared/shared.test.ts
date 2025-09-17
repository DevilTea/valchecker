import type { AnyFn, Equal, IsAllPropsOptional, MaybePromise, Optional, Simplify } from './shared'
import { describe, expect, it } from 'vitest'
import {

	createExecutionChain,
	createObject,

	ExecutionChain,
	expectNever,

	NullProtoObj,

	returnFalse,
	returnTrue,

	throwNotImplementedError,
} from './shared'

describe('tests of `AnyFn`', () => {
	describe('happy path cases', () => {
		describe('case 1', () => {
			it('should accept various function signatures', () => {
				const fn1: AnyFn = () => 'test'
				const fn2: AnyFn = (a: string, b: number) => a + b
				expect(typeof fn1).toBe('function')
				expect(typeof fn2).toBe('function')
			})
		})
	})
})

describe('tests of `Simplify<T>`', () => {
	describe('happy path cases', () => {
		describe('case 1', () => {
			it('should simplify intersection types', () => {
				type TestType = Simplify<{ a: string } & { b: number }>
				const obj: TestType = { a: 'test', b: 42 }
				expect(obj.a).toBe('test')
				expect(obj.b).toBe(42)
			})
		})
	})
})

describe('tests of `Optional<T>`', () => {
	describe('happy path cases', () => {
		describe('case 1', () => {
			it('should make type optional', () => {
				type TestType = Optional<string>
				const value: TestType = undefined
				expect(value).toBeUndefined()
			})
		})
	})
})

describe('tests of `IsAllPropsOptional<T>`', () => {
	describe('happy path cases', () => {
		describe('case 1', () => {
			it('should return true for all optional properties', () => {
				type TestType = IsAllPropsOptional<{ a?: string, b?: number }>
				const result: TestType = true
				expect(result).toBe(true)
			})
		})
		describe('case 2', () => {
			it('should return false when not all properties are optional', () => {
				type TestType = IsAllPropsOptional<{ a: string, b?: number }>
				const result: TestType = false
				expect(result).toBe(false)
			})
		})
	})
})

describe('tests of `Equal<X, Y>`', () => {
	describe('happy path cases', () => {
		describe('case 1', () => {
			it('should return true for equal types', () => {
				type TestType = Equal<string, string>
				const result: TestType = true
				expect(result).toBe(true)
			})
		})
		describe('case 2', () => {
			it('should return false for unequal types', () => {
				type TestType = Equal<string, number>
				const result: TestType = false
				expect(result).toBe(false)
			})
		})
	})
})

describe('tests of `MaybePromise<T>`', () => {
	describe('happy path cases', () => {
		describe('case 1', () => {
			it('should accept value or promise', () => {
				type TestType = MaybePromise<string>
				const value: TestType = 'test'
				const promise: TestType = Promise.resolve('test')
				expect(value).toBe('test')
				expect(promise).toBeInstanceOf(Promise)
			})
		})
	})
})

describe('tests of `NullProtoObj`', () => {
	describe('happy path cases', () => {
		describe('case 1', () => {
			it('should create object with null prototype', () => {
				const obj = new NullProtoObj()
				expect(Object.getPrototypeOf(Object.getPrototypeOf(obj))).toBeNull()
			})
		})
	})
})

describe('tests of `createObject<T>`', () => {
	describe('happy path cases', () => {
		describe('case 1', () => {
			it('should create object with properties', () => {
				const obj = createObject({ a: 1, b: 2 })
				expect(obj.a).toBe(1)
				expect(obj.b).toBe(2)
				expect(Object.getPrototypeOf(Object.getPrototypeOf(obj))).toBeNull()
			})
		})
		describe('case 2', () => {
			it('should create empty object', () => {
				const obj = createObject()
				expect(Object.keys(obj)).toHaveLength(0)
				expect(Object.getPrototypeOf(Object.getPrototypeOf(obj))).toBeNull()
			})
		})
	})
	describe('edge cases', () => {
		describe('case 1', () => {
			it('should copy all property descriptors including non-enumerable', () => {
				const source = {}
				Object.defineProperty(source, 'hidden', {
					value: 'secret',
					enumerable: false,
				})
				const obj = createObject(source)
				expect(Object.getOwnPropertyDescriptor(obj, 'hidden')).toEqual({
					value: 'secret',
					enumerable: false,
					configurable: false,
					writable: false,
				})
				expect(Object.getPrototypeOf(Object.getPrototypeOf(obj))).toBeNull()
			})
		})
	})
})

describe('tests of `throwNotImplementedError`', () => {
	describe('error cases', () => {
		describe('case 1', () => {
			it('should throw error', () => {
				expect(() => throwNotImplementedError()).toThrow('Method not implemented.')
			})
		})
	})
})

describe('tests of `expectNever`', () => {
	describe('error cases', () => {
		describe('case 1', () => {
			it('should throw with undefined', () => {
				expect(() => expectNever()).toThrow('Expected never, but got: undefined')
			})
		})
		describe('case 2', () => {
			it('should throw with provided value', () => {
				expect(() => expectNever('unexpected' as never)).toThrow('Expected never, but got: unexpected')
			})
		})
	})
})

describe('tests of `returnTrue`', () => {
	describe('happy path cases', () => {
		describe('case 1', () => {
			it('should return true', () => {
				expect(returnTrue()).toBe(true)
			})
		})
	})
})

describe('tests of `returnFalse`', () => {
	describe('happy path cases', () => {
		describe('case 1', () => {
			it('should return false', () => {
				expect(returnFalse()).toBe(false)
			})
		})
	})
})

describe('tests of `ExecutionChain<T>`', () => {
	describe('happy path cases', () => {
		describe('case 1', () => {
			it('should construct with sync value', () => {
				const chain = new ExecutionChain('test')
				expect(chain.output).toBe('test')
			})
		})
		describe('case 2', () => {
			it('should construct with promise value', async () => {
				const chain = new ExecutionChain(Promise.resolve('test'))
				expect(await chain.output).toBe('test')
			})
		})
		describe('case 3', () => {
			it('should construct with sync error', () => {
				const chain = new ExecutionChain(undefined, new Error('test'))
				expect(() => chain.output).toThrow('test')
			})
		})
		describe('case 4', () => {
			it('should construct with another ExecutionChain', () => {
				const original = new ExecutionChain('test')
				const chain = new ExecutionChain(original)
				expect(chain.output).toBe('test')
			})
		})
		describe('case 5', () => {
			it('should chain with onfulfilled for sync value', () => {
				const chain = new ExecutionChain('test')
				const result = chain.then(v => v.toUpperCase())
				expect(result.output).toBe('TEST')
			})
		})
		describe('case 6', () => {
			it('should return same chain when no callbacks for sync value', () => {
				const chain = new ExecutionChain('test')
				const result = chain.then(null, null)
				expect(result).toBe(chain)
			})
		})
		describe('case 12', () => {
			it('should return same chain when onfulfilled is null for sync value', () => {
				const chain = new ExecutionChain('test')
				const result = chain.then(null)
				expect(result).toBe(chain)
			})
		})
		describe('case 13', () => {
			it('should return same chain when onrejected is null for sync error', () => {
				const chain = new ExecutionChain(undefined, new Error('test'))
				const result = chain.then(null, null)
				expect(result).toBe(chain)
			})
		})
		describe('case 14', () => {
			it('should return same chain when onrejected is null but onfulfilled provided for sync error', () => {
				const chain = new ExecutionChain(undefined, new Error('test'))
				const result = chain.then(() => 'fallback', null)
				expect(result).toBe(chain)
			})
		})
		describe('case 15', () => {
			it('should return same chain when onfulfilled is null but onrejected provided for sync value', () => {
				const chain = new ExecutionChain('test')
				const result = chain.then(null, () => 'error')
				expect(result).toBe(chain)
			})
		})
		describe('case 7', () => {
			it('should chain with onrejected for sync error', () => {
				const chain = new ExecutionChain(undefined, new Error('test'))
				const result = chain.then(null, _e => 'handled')
				expect(result.output).toBe('handled')
			})
		})
		describe('case 8', () => {
			it('should chain with promise value', async () => {
				const chain = new ExecutionChain(Promise.resolve('test'))
				const result = chain.then(v => v.toUpperCase())
				expect(await result.output).toBe('TEST')
			})
		})
		describe('case 9', () => {
			it('should get value for sync value', () => {
				const chain = new ExecutionChain('test')
				expect(chain.output).toBe('test')
			})
		})
		describe('case 10', () => {
			it('should get value for promise value', async () => {
				const chain = new ExecutionChain(Promise.resolve('test'))
				expect(await chain.output).toBe('test')
			})
		})
		describe('case 11', () => {
			it('should throw error in value getter for sync error', () => {
				const chain = new ExecutionChain(undefined, new Error('test'))
				expect(() => chain.output).toThrow('test')
			})
		})
	})
	describe('edge cases', () => {
		describe('case 1', () => {
			it('should return same chain when no callbacks', () => {
				const chain = new ExecutionChain('test')
				const result = chain.then()
				expect(result).toBe(chain)
			})
		})
		describe('case 2', () => {
			it('should handle onfulfilled throwing error', () => {
				const chain = new ExecutionChain('test')
				const result = chain.then(() => {
					throw new Error('callback error')
				})
				expect(() => result.output).toThrow('callback error')
			})
		})
		describe('case 3', () => {
			it('should handle onrejected throwing error', () => {
				const chain = new ExecutionChain(undefined, new Error('original'))
				const result = chain.then(null, () => {
					throw new Error('callback error')
				})
				expect(() => result.output).toThrow('callback error')
			})
		})
	})
	describe('error cases', () => {
		describe('case 1', () => {
			it('should throw when both async value and sync error provided', () => {
				expect(() => new (ExecutionChain as any)(Promise.resolve('test'), new Error('test'))).toThrow(
					'ExecutionChain cannot have both an async value and a sync error.',
				)
			})
		})
	})
})

describe('tests of `createExecutionChain`', () => {
	describe('happy path cases', () => {
		describe('case 1', () => {
			it('should create chain with no arguments', () => {
				const chain = createExecutionChain()
				expect(chain.output).toBeUndefined()
			})
		})
		describe('case 2', () => {
			it('should create chain with value', () => {
				const chain = createExecutionChain('test')
				expect(chain.output).toBe('test')
			})
		})
	})
})
