import { describe, expect, it } from 'vitest'
import { defaultInvalidValueMessage, resolveMessage } from './message'

// Specification: ./message.spec.md

describe('tests for `message.ts`', () => {
	// Corresponds to `defaultInvalidValueMessage` section in the spec
	describe('`defaultInvalidValueMessage`', () => {
		describe('happy path cases', () => {
			// Test Case: [defaultInvalidValueMessage.happy.1]
			it('should have the correct default message', () => {
				expect(defaultInvalidValueMessage).toBe('Invalid value.')
			})
		})
	})

	describe('`resolveMessage`', () => {
		const payload = { code: 'TEST', value: 'testValue', path: ['a'], error: 'testError' }

		describe('happy path cases', () => {
			// Test Case: [resolveMessage.happy.1]
			it('should resolve string message', () => {
				const result = resolveMessage({ payload, message: 'custom' })
				expect(result).toBe('custom')
			})

			// Test Case: [resolveMessage.happy.2]
			it('should resolve function message', () => {
				const result = resolveMessage({ payload, message: () => 'func' })
				expect(result).toBe('func')
			})

			// Test Case: [resolveMessage.happy.3]
			it('should resolve map message', () => {
				const result = resolveMessage({ payload: { ...payload, code: 'TEST' }, message: { TEST: 'map' } })
				expect(result).toBe('map')
			})

			// Test Case: [resolveMessage.happy.4]
			it('should fall back to default message', () => {
				const result = resolveMessage({ payload, message: undefined, defaultMessage: 'default' })
				expect(result).toBe('default')
			})

			// Test Case: [resolveMessage.happy.5]
			it('should fall back to default invalid message', () => {
				const result = resolveMessage({ payload, message: undefined, defaultMessage: undefined })
				expect(result).toBe('Invalid value.')
			})
		})

		describe('edge cases', () => {
			// Test Case: [resolveMessage.edge.1]
			it('should handle unknown code in map', () => {
				const result = resolveMessage({ payload: { ...payload, code: 'UNKNOWN' }, message: { TEST: 'test' } })
				expect(result).toBe('Invalid value.')
			})

			// Test Case: [resolveMessage.edge.2]
			it('should pass path and error to function', () => {
				const result = resolveMessage({ payload, message: p => `error: ${p.error}` })
				expect(result).toBe('error: testError')
			})
		})

		describe('error cases', () => {
			// Test Case: [resolveMessage.error.1]
			it('should handle invalid message type', () => {
				const result = resolveMessage({ payload, message: 123 as any })
				expect(result).toBe('Invalid value.')
			})
		})
	})
})
