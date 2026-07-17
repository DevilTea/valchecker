import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, MessageHandler, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type NumberIssue = ExecutionIssue<'isAtMost:expected_at_most', { target: 'number', value: number, maximum: number }>
	export type BigIntIssue = ExecutionIssue<'isAtMost:expected_at_most', { target: 'bigint', value: bigint, maximum: bigint }>
}

type Meta<T extends number | bigint> = DefineStepMethodMeta<{
	Name: 'isAtMost'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: T }>
	SelfIssue: T extends number ? Internal.NumberIssue : Internal.BigIntIssue
}>

interface PluginDef extends TStepPluginDef {
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
			Meta<number>,
			this['CurrentValchecker'] extends Meta<number>['ExpectedCurrentValchecker']
				? (maximum: number, message?: MessageHandler<Internal.NumberIssue>) => Next<
						{ issue: Internal.NumberIssue },
						this['CurrentValchecker']
					>
				: never
		>
		| DefineStepMethod<
			Meta<bigint>,
			this['CurrentValchecker'] extends Meta<bigint>['ExpectedCurrentValchecker']
				? (maximum: bigint, message?: MessageHandler<Internal.BigIntIssue>) => Next<
						{ issue: Internal.BigIntIssue },
						this['CurrentValchecker']
					>
				: never
		>
}

/* @__NO_SIDE_EFFECTS__ */
export const isAtMost = implStepPlugin<PluginDef>({
	isAtMost: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [maximum, message],
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
					customMessage: message,
					defaultMessage: `Expected a value of at most ${maximum}.`,
				}),
			)
		})
	},
})
