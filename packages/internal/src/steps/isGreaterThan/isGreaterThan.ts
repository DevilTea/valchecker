import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type NumberIssue = ExecutionIssue<'isGreaterThan:expected_greater_than', { target: 'number', value: number, minimum: number }>
	export type BigIntIssue = ExecutionIssue<'isGreaterThan:expected_greater_than', { target: 'bigint', value: bigint, minimum: bigint }>
}

type Meta<T extends number | bigint> = DefineStepMethodMeta<{
	Name: 'isGreaterThan'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: T }>
	SelfIssue: T extends number ? Internal.NumberIssue : Internal.BigIntIssue
}>

interface PluginDef extends TStepPluginDef {
	/** Checks that a number or bigint is greater than the configured bound. */
	isGreaterThan:
		| DefineStepMethod<Meta<number>, this['CurrentValchecker'] extends Meta<number>['ExpectedCurrentValchecker']
			? (minimum: number, options?: StepOptions<Internal.NumberIssue>) => Next<{ issue: Internal.NumberIssue }, this['CurrentValchecker']>
			: never>
		| DefineStepMethod<Meta<bigint>, this['CurrentValchecker'] extends Meta<bigint>['ExpectedCurrentValchecker']
			? (minimum: bigint, options?: StepOptions<Internal.BigIntIssue>) => Next<{ issue: Internal.BigIntIssue }, this['CurrentValchecker']>
			: never>
}

/* @__NO_SIDE_EFFECTS__ */
export const isGreaterThan = implStepPlugin<PluginDef>({
	isGreaterThan: ({ utils: { addSuccessStep, success, createIssue, failure }, params: [minimum, options] }) => {
		addSuccessStep((value) => value > minimum
			? success(value)
			: failure(createIssue({
					code: 'isGreaterThan:expected_greater_than',
					payload: { target: typeof value === 'bigint' ? 'bigint' : 'number', value, minimum } as any,
					customMessage: options?.message,
					defaultMessage: `Expected a value greater than ${minimum}.`,
				})))
	},
}, 'sync')
