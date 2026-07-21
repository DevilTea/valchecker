import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'isSafeInteger'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: number }>
	SelfIssue: ExecutionIssue<'isSafeInteger:expected_safe_integer', { value: number }>
}>

interface PluginDef extends TStepPluginDef {
	isSafeInteger: DefineStepMethod<Meta, this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
		? (options?: StepOptions<Meta['SelfIssue']>) => Next<{ issue: Meta['SelfIssue'] }, this['CurrentValchecker']>
		: never>
}

/* @__NO_SIDE_EFFECTS__ */
export const isSafeInteger = implStepPlugin<PluginDef>({
	isSafeInteger: ({ utils: { addSuccessStep, success, createIssue, failure }, params: [options] }) => {
		addSuccessStep(value => Number.isSafeInteger(value)
			? success(value)
			: failure(createIssue({
					code: 'isSafeInteger:expected_safe_integer',
					payload: { value },
					customMessage: options?.message,
					defaultMessage: 'Expected a safe integer.',
				})))
	},
}, 'sync')
