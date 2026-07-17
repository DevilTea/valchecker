import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, MessageHandler, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type NumberIssue = ExecutionIssue<'isAtLeast:expected_at_least', { target: 'number', value: number, minimum: number }>
	export type BigIntIssue = ExecutionIssue<'isAtLeast:expected_at_least', { target: 'bigint', value: bigint, minimum: bigint }>
}

type Meta<T extends number | bigint> = DefineStepMethodMeta<{
	Name: 'isAtLeast'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: T }>
	SelfIssue: T extends number ? Internal.NumberIssue : Internal.BigIntIssue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that a number or bigint is greater than or equal to the specified minimum.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isAtLeast, number } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [number, isAtLeast] })
	 * const schema = v.number().isAtLeast(10)
	 * const result = schema.execute(50)
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isAtLeast:expected_at_least'`: The numeric value is below the minimum.
	 */
	isAtLeast:
		| DefineStepMethod<
			Meta<number>,
			this['CurrentValchecker'] extends Meta<number>['ExpectedCurrentValchecker']
				? (minimum: number, message?: MessageHandler<Internal.NumberIssue>) => Next<
						{ issue: Internal.NumberIssue },
						this['CurrentValchecker']
					>
				: never
		>
		| DefineStepMethod<
			Meta<bigint>,
			this['CurrentValchecker'] extends Meta<bigint>['ExpectedCurrentValchecker']
				? (minimum: bigint, message?: MessageHandler<Internal.BigIntIssue>) => Next<
						{ issue: Internal.BigIntIssue },
						this['CurrentValchecker']
					>
				: never
		>
}

/* @__NO_SIDE_EFFECTS__ */
export const isAtLeast = implStepPlugin<PluginDef>({
	isAtLeast: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [minimum, message],
	}) => {
		addSuccessStep((value) => {
			if (value >= minimum) {
				return success(value)
			}
			const target = (typeof value === 'bigint' ? 'bigint' : 'number') as any
			return failure(
				createIssue({
					code: 'isAtLeast:expected_at_least',
					payload: { target, value: value as any, minimum: minimum as any },
					customMessage: message,
					defaultMessage: `Expected a value of at least ${minimum}.`,
				}),
			)
		})
	},
})
