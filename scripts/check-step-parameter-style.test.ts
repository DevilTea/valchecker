import { describe, expect, it } from 'vitest'
import { checkSideEffectMarker, checkStepParameterStyle } from './check-step-parameter-style'

describe('step parameter and tree-shake marker checks', () => {
	it('rejects a positional message even when StepOptions is not mentioned', () => {
		const errors = checkStepParameterStyle('type Plugin = DefineStepMethod<Meta, (value: string, message?: string) => void>\n', 'fixture.ts')
		expect(errors.some(error => error.includes('positional message parameters are forbidden')))
			.toBe(true)
	})

	it('finds a marker-protected construction across a line break', () => {
		expect(checkSideEffectMarker('/* @__NO_SIDE_EFFECTS__ */\nexport const plugin =\n\timplStepPlugin({})\n', 'fixture.ts'))
			.toEqual([])
	})

	it('does not let an intervening annotation satisfy the marker rule', () => {
		const errors = checkSideEffectMarker('/* @__NO_SIDE_EFFECTS__ */\n/** intervening annotation */\nexport const plugin = implStepPlugin({})\n', 'fixture.ts')
		expect(errors)
			.toHaveLength(1)
	})
})
