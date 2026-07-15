import * as internal from '@valchecker/internal'
import { describe, expect, it } from 'vitest'
import { allSteps } from './allSteps'

const runtimeExecutionStepDefMarker = Symbol.for('valchecker:runtimeExecutionStepDefMarker')

function isRuntimeStep(value: unknown): boolean {
	return Boolean(
		value
		&& typeof value === 'object'
		&& (value as Record<PropertyKey, unknown>)[runtimeExecutionStepDefMarker],
	)
}

describe('allSteps', () => {
	it('contains every exported runtime step and no other values', () => {
		const expected = Object.values(internal).filter(isRuntimeStep)

		expect(allSteps).toEqual(expected)
	})

	it('contains only marked step objects', () => {
		expect(Array.isArray(allSteps)).toBe(true)
		for (const step of allSteps) {
			expect(typeof step).toBe('object')
			expect(step).not.toBeNull()
			expect(Reflect.has(step as object, runtimeExecutionStepDefMarker)).toBe(true)
		}
	})

	it('does not contain duplicate step definitions', () => {
		expect(new Set(allSteps).size).toBe(allSteps.length)
	})
})
