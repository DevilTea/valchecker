import type { AllSteps } from './allSteps'
import { createValchecker, implStepPlugin, number } from '@valchecker/internal'
import { describe, expectTypeOf, it } from 'vitest'

type AllStep = AllSteps[number]

function acceptAllStep(step: AllStep): AllStep {
	return step
}

describe('allSteps type boundary', () => {
	it('contains step plugins without structurally admitting unrelated values', () => {
		expectTypeOf(acceptAllStep(number))
			.toMatchTypeOf<AllStep>()

		// @ts-expect-error An arbitrary object is not an AllSteps element.
		acceptAllStep({})
		// @ts-expect-error An arbitrary function is not an AllSteps element.
		acceptAllStep(() => 123)
		// @ts-expect-error Core factories are exported values, not step plugins.
		acceptAllStep(createValchecker)
		// @ts-expect-error The plugin constructor is not itself a step plugin.
		acceptAllStep(implStepPlugin)
	})
})
