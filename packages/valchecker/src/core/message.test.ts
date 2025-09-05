import { describe, expect, it } from 'vitest'
import { defaultInvalidValueMessage, resolveMessage } from './message'

describe('tests of `resolveMessage`', () => {
	describe('happy path cases', () => {
		it('case 1: should return the specific message from the user-provided message map', () => {
			const result = resolveMessage({
				payload: { code: 'TEST_CODE', value: 'test' },
				message: { TEST_CODE: 'User message' },
			})
			expect(result).toEqual('User message')
		})

		it('case 2: should return the message from the user-provided message function', () => {
			const result = resolveMessage({
				payload: { code: 'TEST_CODE', value: 'test' },
				message: p => `Value is ${p.value}`,
			})
			expect(result).toEqual('Value is test')
		})

		it('case 3: should return the user-provided global message string', () => {
			const result = resolveMessage({
				payload: { code: 'TEST_CODE', value: 'test' },
				message: 'Global user message',
			})
			expect(result).toEqual('Global user message')
		})

		it('case 4: should return the specific message from the default message map', () => {
			const result = resolveMessage({
				payload: { code: 'TEST_CODE', value: 'test' },
				defaultMessage: { TEST_CODE: 'Default message' },
			})
			expect(result).toEqual('Default message')
		})

		it('case 5: should return the message from the default message function', () => {
			const result = resolveMessage({
				payload: { code: 'TEST_CODE', value: 'test' },
				defaultMessage: p => `Default value is ${p.value}`,
			})
			expect(result).toEqual('Default value is test')
		})

		it('case 6: should return the default global message string', () => {
			const result = resolveMessage({
				payload: { code: 'TEST_CODE', value: 'test' },
				defaultMessage: 'Global default message',
			})
			expect(result).toEqual('Global default message')
		})

		it('case 7: should prioritize user message over default message', () => {
			const result = resolveMessage({
				payload: { code: 'TEST_CODE', value: 'test' },
				defaultMessage: 'Default',
				message: 'User',
			})
			expect(result).toEqual('User')
		})

		it('case 8: should return defaultInvalidValueMessage when no message is resolved', () => {
			const result = resolveMessage({
				payload: { code: 'TEST_CODE', value: 'test' },
			})
			expect(result).toEqual(defaultInvalidValueMessage)
		})

		it('case 9: should handle nested message resolution in maps', () => {
			const result = resolveMessage({
				payload: { code: 'ANOTHER_CODE', value: 'test' },
				message: { TEST_CODE: 'Won\'t be used' },
			})
			expect(result).toEqual(defaultInvalidValueMessage)
		})
	})

	describe('edge cases', () => {
		it('case 1: should handle null and undefined for message and defaultMessage', () => {
			const result = resolveMessage({
				payload: { code: 'TEST_CODE', value: 'test' },
				message: null as any,
				defaultMessage: undefined,
			})
			expect(result).toEqual(defaultInvalidValueMessage)
		})

		it('case 2: should pass path and error to the message function', () => {
			const error = new Error('test error')
			const result = resolveMessage({
				payload: { code: 'TEST_CODE', value: 'test', path: ['a', 'b'], error },
				message: p => `Path: ${p.path?.join('.')}, Error: ${(p.error as Error)?.message}`,
			})
			expect(result).toEqual('Path: a.b, Error: test error')
		})
	})
})
