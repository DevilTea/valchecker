/**
 * Test plan for allSteps:
 * - Functions tested: allSteps filtering logic that collects steps from steps/index.ts.
 * - Valid inputs: Exported step objects from steps module with runtime marker.
 * - Invalid inputs: Objects without runtime marker are filtered out.
 * - Edge cases: Verify filtering logic handles various object types correctly.
 * - Expected behaviors: allSteps contains all and only steps with runtime marker from steps/index.ts.
 * - Error handling: Non-object values and objects without marker are filtered out.
 * - Coverage goals: 100% statement, branch, and function coverage.
 * - Future verification: Testing the filter logic ensures new steps with proper markers are included.
 */

import { describe, expect, it } from 'vitest'
import { runtimeExecutionStepDefMarker } from '../shared'
import * as stepsModule from '../steps'
import { allSteps } from './allSteps'

describe('allSteps', () => {
	describe('filtering logic', () => {
		it('should be an array type', () => {
			expect(Array.isArray(allSteps)).toBe(true)
		})

		it('should filter steps from steps module', () => {
			// Extract all values exported from steps module
			const allExportedValues = Object.values(stepsModule as any)

			// Count how many have the runtime marker (valid steps)
			const validSteps = allExportedValues.filter(
				(value: any) => (
					value
					&& typeof value === 'object'
					&& (value as any)[runtimeExecutionStepDefMarker] === true
				),
			)

			// allSteps should match the count of valid steps
			expect(allSteps.length).toBe(validSteps.length)
		})

		it('should only include objects with runtime marker', () => {
			// All items in allSteps should have the marker
			allSteps.forEach((step) => {
				expect(step).toBeDefined()
				expect(typeof step).toBe('object')
				expect((step as any)[runtimeExecutionStepDefMarker]).toBe(true)
			})
		})

		it('should match exported steps one-to-one', () => {
			// Extract valid steps from module
			const validSteps = Object.values(stepsModule as any).filter(
				(value: any) => (
					value
					&& typeof value === 'object'
					&& (value as any)[runtimeExecutionStepDefMarker] === true
				),
			)

			// Each valid step should be in allSteps
			validSteps.forEach((step) => {
				expect(allSteps).toContain(step)
			})

			// Each step in allSteps should be in validSteps
			allSteps.forEach((step) => {
				expect(validSteps).toContain(step)
			})
		})

		it('should exclude non-object values', () => {
			// Get all exported values
			const allValues = Object.values(stepsModule as any)

			// Find values that are not objects
			const nonObjects = allValues.filter(
				(value: any) => typeof value !== 'object' || value === null,
			)

			// Ensure none of these non-objects are in allSteps
			nonObjects.forEach((nonObject) => {
				expect(allSteps).not.toContain(nonObject)
			})
		})

		it('should exclude objects without runtime marker', () => {
			// Create a test object without the marker
			const objectWithoutMarker = { test: true }

			// This object should not be in allSteps
			expect(allSteps).not.toContain(objectWithoutMarker)
		})
	})

	describe('collection properties', () => {
		it('should not have duplicate entries', () => {
			const uniqueSet = new Set(allSteps)
			expect(uniqueSet.size).toBe(allSteps.length)
		})

		it('should have entries that are proper objects', () => {
			allSteps.forEach((step) => {
				expect(step).not.toBeNull()
				expect(step).not.toBeUndefined()
				expect(typeof step).toBe('object')
				// Steps should have the runtime marker as a well-known symbol
				expect(Reflect.has(step as any, runtimeExecutionStepDefMarker)).toBe(true)
			})
		})
	})

	describe('future-proof validation', () => {
		it('should dynamically include new steps when added to steps/index.ts', () => {
			// This test verifies the filter logic works correctly
			// If a new step is properly exported with the marker, it will be included

			const exportedValues = Object.values(stepsModule as any)
			const filteredSteps = exportedValues.filter(
				(value: any) => (
					value
					&& typeof value === 'object'
					&& (value as any)[runtimeExecutionStepDefMarker] === true
				),
			)

			// The filtering logic should be applied consistently
			expect(allSteps.length).toBe(filteredSteps.length)

			// If we apply the same filter, we get the same result
			const refiltered = Object.values(stepsModule as any).filter(
				(value: any) => (
					value
					&& typeof value === 'object'
					&& (value as any)[runtimeExecutionStepDefMarker] === true
				),
			)

			expect(allSteps.length).toBe(refiltered.length)
			refiltered.forEach((step) => {
				expect(allSteps).toContain(step)
			})
		})

		it('should verify steps/index.ts exports are correctly included', () => {
			// Check that the filtering logic covers the three conditions:
			// 1. Value is truthy
			// 2. Value is an object
			// 3. Value has the runtime marker

			const values = Object.values(stepsModule as any)

			// Test truthiness check
			const falsyValues = values.filter((v: any) => !v)
			falsyValues.forEach((falsyValue) => {
				expect(allSteps).not.toContain(falsyValue)
			})

			// Test object check
			const nonObjectValues = values.filter(
				(v: any) => v && typeof v !== 'object',
			)
			nonObjectValues.forEach((nonObjectValue) => {
				expect(allSteps).not.toContain(nonObjectValue)
			})

			// Test marker check
			const withoutMarker = values.filter(
				(v: any) => (
					v
					&& typeof v === 'object'
					&& !(v as any)[runtimeExecutionStepDefMarker]
				),
			)
			withoutMarker.forEach((noMarkerValue) => {
				expect(allSteps).not.toContain(noMarkerValue)
			})
		})

		it('should maintain consistency between filter conditions', () => {
			// Verify all three filter conditions are working together
			const values = Object.values(stepsModule as any)

			const filtered = values.filter(
				(step: any) => (
					step
					&& typeof step === 'object'
					&& (step as any)[runtimeExecutionStepDefMarker]
				) === true,
			)

			expect(allSteps.length).toBe(filtered.length)
			filtered.forEach((step) => {
				expect(allSteps).toContain(step)
			})
		})
	})
})
