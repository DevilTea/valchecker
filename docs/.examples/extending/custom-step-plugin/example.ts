import type {
	DefineExpectedValchecker,
	DefineStepMethod,
	DefineStepMethodMeta,
	ExecutionIssue,
	Next,
	StepOptions,
	TStepPluginDef,
} from '@valchecker/internal'
import { implStepPlugin } from '@valchecker/internal'
import { createValchecker, number } from 'valchecker'

type Meta = DefineStepMethodMeta<{
	Name: 'isPositive'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: number }>
	SelfIssue: ExecutionIssue<
		'isPositive:expected_positive',
		{ value: number }
	>
}>

interface PluginDef extends TStepPluginDef {
	isPositive: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? (options?: StepOptions<Meta['SelfIssue']>) => Next<
					{ issue: Meta['SelfIssue'] },
					this['CurrentValchecker']
				>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const isPositive = implStepPlugin<PluginDef>({
	isPositive: ({
		utils: { addSuccessStep, createIssue, failure, success },
		params: [options],
	}) => {
		addSuccessStep((value) => {
			if (value <= 0) {
				return failure(createIssue({
					code: 'isPositive:expected_positive',
					payload: { value },
					customMessage: options?.message,
					defaultMessage: 'Expected a positive number.',
				}))
			}

			return success(value)
		})
	},
}, 'sync')

export const v = createValchecker({ steps: [number, isPositive] })
export const positiveNumber = v.number()
	.isPositive()
