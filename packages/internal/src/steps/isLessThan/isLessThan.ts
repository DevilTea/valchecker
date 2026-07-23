import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type NumberIssue = ExecutionIssue<'isLessThan:expected_less_than', { target: 'number', value: number, maximum: number }>
	export type BigIntIssue = ExecutionIssue<'isLessThan:expected_less_than', { target: 'bigint', value: bigint, maximum: bigint }>
}

type Meta<T extends number | bigint> = DefineStepMethodMeta<{
	Name: 'isLessThan'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: T }>
	SelfIssue: T extends number ? Internal.NumberIssue : Internal.BigIntIssue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that a number or bigint is strictly less than the configured bound.
	 * The bound itself is rejected.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isLessThan, number } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [number, isLessThan] })
	 * const schema = v.number().isLessThan(10)
	 * const result = schema.execute(1)
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isLessThan:expected_less_than'`: The value is not less than the bound.
	 */
	isLessThan:
		| DefineStepMethod<Meta<number>, this['CurrentValchecker'] extends Meta<number>['ExpectedCurrentValchecker']
			? (maximum: number, options?: StepOptions<Internal.NumberIssue>) => Next<{ issue: Internal.NumberIssue }, this['CurrentValchecker']>
			: never>
			| DefineStepMethod<Meta<bigint>, this['CurrentValchecker'] extends Meta<bigint>['ExpectedCurrentValchecker']
				? (maximum: bigint, options?: StepOptions<Internal.BigIntIssue>) => Next<{ issue: Internal.BigIntIssue }, this['CurrentValchecker']>
				: never>
}

/* @__NO_SIDE_EFFECTS__ */
export const isLessThan = implStepPlugin<PluginDef>({
	isLessThan: ({ utils: { addSuccessStep, success, createIssue, failure }, params: [maximum, options] }) => {
		addSuccessStep(value => value < maximum
			? success(value)
			: failure(createIssue({
					code: 'isLessThan:expected_less_than',
					payload: { target: typeof value === 'bigint' ? 'bigint' : 'number', value, maximum } as any,
					customMessage: options?.message,
					defaultMessage: `Expected a value less than ${maximum}.`,
				})))
	},
}, 'sync')
