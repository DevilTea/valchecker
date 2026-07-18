import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace AtMostInternal {
	export type NumberIssue = ExecutionIssue<'isAtMost:expected_at_most', { target: 'number', value: number, maximum: number }>
	export type BigIntIssue = ExecutionIssue<'isAtMost:expected_at_most', { target: 'bigint', value: bigint, maximum: bigint }>
}

type AtMostMeta<T extends number | bigint> = DefineStepMethodMeta<{
	Name: 'isAtMost'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: T }>
	SelfIssue: T extends number ? AtMostInternal.NumberIssue : AtMostInternal.BigIntIssue
}>

interface AtMostPluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that a number or bigint is less than or equal to the specified maximum.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isAtMost, number } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [number, isAtMost] })
	 * const schema = v.number().isAtMost(100)
	 * const result = schema.execute(50)
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isAtMost:expected_at_most'`: The numeric value exceeds the maximum.
	 */
	isAtMost:
		| DefineStepMethod<
			AtMostMeta<number>,
			this['CurrentValchecker'] extends AtMostMeta<number>['ExpectedCurrentValchecker']
				? (maximum: number, options?: StepOptions<AtMostInternal.NumberIssue>) => Next<
						{ issue: AtMostInternal.NumberIssue },
						this['CurrentValchecker']
					>
				: never
		>
		| DefineStepMethod<
			AtMostMeta<bigint>,
			this['CurrentValchecker'] extends AtMostMeta<bigint>['ExpectedCurrentValchecker']
				? (maximum: bigint, options?: StepOptions<AtMostInternal.BigIntIssue>) => Next<
						{ issue: AtMostInternal.BigIntIssue },
						this['CurrentValchecker']
					>
				: never
		>
}

/* @__NO_SIDE_EFFECTS__ */
export const isAtMost = implStepPlugin<AtMostPluginDef>({
	isAtMost: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [maximum, options],
	}) => {
		addSuccessStep((value) => {
			if (value <= maximum) {
				return success(value)
			}
			const target = (typeof value === 'bigint' ? 'bigint' : 'number') as any
			return failure(
				createIssue({
					code: 'isAtMost:expected_at_most',
					payload: { target, value: value as any, maximum: maximum as any },
					customMessage: options?.message,
					defaultMessage: `Expected a value of at most ${maximum}.`,
				}),
			)
		})
	},
})
