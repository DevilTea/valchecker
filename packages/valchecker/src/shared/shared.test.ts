import { describe, expect, it } from 'vitest'
import { createObject, expectNever, NullProtoObj, returnFalse, returnTrue, throwNotImplementedError } from './shared'

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
})
