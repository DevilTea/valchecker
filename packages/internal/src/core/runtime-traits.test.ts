import { describe, expect, it } from 'vitest'
import { createValchecker, implStepPlugin } from './core'
import { markIdentityRuntimeStepPlugin } from './runtime-traits'

const throwingIdentity = markIdentityRuntimeStepPlugin(implStepPlugin<any>({
	throwingIdentity: ({ utils }: any) => {
		utils.addSuccessStep(() => {
			throw new Error('trusted identity failure')
		}, 'sync')
	},
}, 'sync'))

const v = createValchecker({ steps: [throwingIdentity] }) as any

describe('runtime step traits', () => {
	it('keeps unknown-exception handling for trusted identity wrappers', () => {
		expect(v.throwingIdentity().execute('value')).toMatchObject({
			issues: [{
				code: 'core:unknown_exception',
				category: 'internal',
				payload: {
					method: 'throwingIdentity',
					value: 'value',
				},
			}],
		})
	})
})
