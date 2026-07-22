import { describe, expect, it } from 'vitest'
import { createValchecker, implStepPlugin } from './core'
import { hasIdentityOnlyRuntimeSteps, markIdentityRuntimeStepPlugin } from './runtime-traits'

const throwingIdentity = markIdentityRuntimeStepPlugin(implStepPlugin<any>({
	throwingIdentity: ({ utils }: any) => {
		utils.addSuccessStep(() => {
			throw new Error('trusted identity failure')
		}, 'sync')
	},
}, 'sync'))

const passthrough = implStepPlugin<any>({
	passthrough: ({ utils }: any) => {
		utils.addSuccessStep((value: unknown) => utils.success(value), 'sync')
	},
}, 'sync')

const v = createValchecker({ steps: [passthrough, throwingIdentity] }) as any

describe('runtime step traits', () => {
	it('encodes trust without changing arrow-function call semantics', () => {
		const trusted = v.throwingIdentity()
		const untrusted = v.passthrough()
		const trustedStep = trusted['~core'].runtimeSteps[0]
		const untrustedStep = untrusted['~core'].runtimeSteps[0]

		expect(Object.hasOwn(trustedStep, 'prototype')).toBe(false)
		expect(Object.hasOwn(untrustedStep, 'prototype')).toBe(false)
		expect(trustedStep.length).toBe(2)
		expect(untrustedStep.length).toBe(1)
		expect(hasIdentityOnlyRuntimeSteps(trusted)).toBe(true)
		expect(hasIdentityOnlyRuntimeSteps(untrusted)).toBe(false)
	})

	it('rejects empty pipelines and mixed trusted pipelines', () => {
		expect(hasIdentityOnlyRuntimeSteps(v)).toBe(false)
		expect(hasIdentityOnlyRuntimeSteps(v.throwingIdentity().passthrough())).toBe(false)
	})

	it('keeps unknown-exception handling for trusted identity wrappers', () => {
		expect(v.throwingIdentity().execute('value')).toMatchObject({
			issues: [{
				code: 'core:unknown_exception',
				category: 'internal',
				payload: {
					method: 'throwingIdentity',
				},
			}],
		})
	})
})
