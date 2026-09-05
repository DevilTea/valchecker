import type { TStepPluginDef } from './types'
import { describe, expectTypeOf, it } from 'vitest'
import { number } from '../steps'
import { createValchecker, implStepPlugin } from './core'

const capabilityOnlyPlugin = implStepPlugin<TStepPluginDef>({}, 'sync', {
	[Symbol.for('example.capability')]: { enabled: true },
})

describe('step plugin type boundary', () => {
	it('rejects values that were not constructed as Valchecker step plugins', () => {
		const assertRejectedConstruction = (): void => {
			// @ts-expect-error An arbitrary object is not a registered step plugin.
			createValchecker({ steps: [{}] })
			// @ts-expect-error An arbitrary function is not a registered step plugin.
			createValchecker({ steps: [() => 123] })
		}
		void assertRejectedConstruction
	})

	it('preserves built-in and methodless capability plugin registration', () => {
		const builtIn = createValchecker({ steps: [number] })
		const capabilityOnly = createValchecker({ steps: [capabilityOnlyPlugin] })

		expectTypeOf(builtIn.number)
			.toBeFunction()
		expectTypeOf(capabilityOnly)
			.toBeObject()
	})
})
