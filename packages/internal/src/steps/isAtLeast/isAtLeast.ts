import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, StepOptions, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace AtLeastInternal {
	export type NumberIssue = ExecutionIssue<'isAtLeast:expected_at_least', { target: 'number', value: number, minimum: number }>
	export type BigIntIssue = ExecutionIssue<'isAtLeast:expected_at_least', { target: 'bigint', value: bigint, minimum: bigint }>
}

type AtLeastMeta<T extends number | bigint> = DefineStepMethodMeta<{
	Name: 'isAtLeast'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: T }>
	SelfIssue: T extends number ? AtLeastInternal.NumberIssue : AtLeastInternal.BigIntIssue
}>

interface AtLeastPluginDef extends TStepPluginDef {
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
			AtLeastMeta<number>,
			this['CurrentValchecker'] extends AtLeastMeta<number>['ExpectedCurrentValchecker']
				? (minimum: number, options?: StepOptions<AtLeastInternal.NumberIssue>) => Next<
						{ issue: AtLeastInternal.NumberIssue },
						this['CurrentValchecker']
					>
				: never
		>
		| DefineStepMethod<
			AtLeastMeta<bigint>,
			this['CurrentValchecker'] extends AtLeastMeta<bigint>['ExpectedCurrentValchecker']
				? (minimum: bigint, options?: StepOptions<AtLeastInternal.BigIntIssue>) => Next<
						{ issue: AtLeastInternal.BigIntIssue },
						this['CurrentValchecker']
					>
				: never
		>
}

/* @__NO_SIDE_EFFECTS__ */
export const isAtLeast = implStepPlugin<AtLeastPluginDef>({
	isAtLeast: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [minimum, options],
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
					customMessage: options?.message,
					defaultMessage: `Expected a value of at least ${minimum}.`,
				}),
			)
		})
	},
})
