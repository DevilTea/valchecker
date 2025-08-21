import { describe, expect, it } from 'vitest'
import { createObject, ExecutionChain, throwNotImplementedError } from '../src'

describe('createObject', () => {
	it('should create an empty object with null prototype', () => {
		const obj = createObject()
		expect(obj instanceof Object).toBe(false)
		expect(Object.keys(obj).length).toBe(0)
	})

	it('should create an object with given properties and null prototype', () => {
		const data = { a: 1, b: 'test' }
		const obj = createObject(data)
		expect(obj instanceof Object).toBe(false)
		expect(obj.a).toBe(1)
		expect(obj.b).toBe('test')
	})
})

describe('throwNotImplementedError', () => {
	it('should throw a not implemented error', () => {
		expect(throwNotImplementedError).toThrow('Method not implemented.')
	})
})

describe('executionChain', () => {
	it('should handle synchronous execution', () => {
		const chain = new ExecutionChain(5)
			.then(val => val * 2)
			.then(val => val.toString())
		expect(chain.value).toBe('10')
	})

	it('should handle asynchronous execution', async () => {
		const chain = new ExecutionChain(Promise.resolve(5))
			.then(val => val * 2)
			.then(val => Promise.resolve(val.toString()))
		await expect(chain).resolves.toBe('10')
	})

	it('should chain multiple then calls correctly', () => {
		const chain = new ExecutionChain(1)
			.then(v => v + 1)
			.then(v => v + 1)
			.then(v => v + 1)
		expect(chain.value).toBe(4)
	})

	it('should handle synchronous error with onrejected', () => {
		const error = new Error('Sync error')
		const result = new ExecutionChain(1)
			.then(() => {
				throw error
			})
			.then(null, (err) => {
				return err.message
			})
			.value

		expect(result).toBe('Sync error')
	})

	it('should handle asynchronous error with onrejected', async () => {
		const error = new Error('Async error')
		const chain = new ExecutionChain(Promise.resolve(1))
			.then(() => {
				return Promise.reject(error)
			})
			.then(null, (err) => {
				return err.message
			})
		expect(await chain.value).toBe('Async error')
	})

	it('should propagate error if onrejected is not provided', () => {
		const error = new Error('Test Error')
		expect(
			() => new ExecutionChain(1)
				.then(() => {
					throw error
				})
				.then(v => v)
				.value,
		).toThrow(error)
	})

	it('should get the value with the value getter', () => {
		const chain = new ExecutionChain(10)
		expect(chain.value).toBe(10)
	})
})
