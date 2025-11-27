import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, MessageHandler, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Input = number | bigint | { length: number }

	export type NumberIssue = ExecutionIssue<'min:expected_min', { target: 'number', value: number, min: number }>
	export type BigIntIssue = ExecutionIssue<'min:expected_min', { target: 'bigint', value: bigint, min: bigint }>
	export type LengthIssue = ExecutionIssue<'min:expected_min', { target: 'length', value: { length: number }, min: number }>

	export type Issue<T extends Input> = [
		number extends T ? NumberIssue : never,
		bigint extends T ? BigIntIssue : never,
		{ length: number } extends T ? LengthIssue : never,
	][number]
}

type Meta<T extends Internal.Input> = T extends Internal.Input
	? DefineStepMethodMeta<{
		Name: 'min'
		ExpectedThis: DefineExpectedValchecker<{ output: T }>
		SelfIssue: Internal.Issue<T>
	}>
	: never

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is greater than or equal to the specified minimum.
	 *
	 * ---
	 *
	 * ### Example:
	 * #### Usage with numbers
	 * ```ts
	 * import { createValchecker, number, min } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [number, min] })
	 * const schema = v.number().min(10)
	 * const result = schema.execute(50)
	 * ```
	 *
	 * #### Usage with bigints
	 * ```ts
	 * import { createValchecker, bigint, min } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [bigint, min] })
	 * const schema = v.bigint().min(10n)
	 * const result = schema.execute(50n)
	 * ```
	 *
	 * #### Usage with lengths
	 * ```ts
	 * import { createValchecker, string, min } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, min] })
	 * const schema = v.string().min(5)
	 * const result = schema.execute('hello')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'min:expected_min'`: The value is below the minimum.
	 */
	min:
		| DefineStepMethod<
			Meta<number>,
			this['This'] extends Meta<number>['ExpectedThis']
				? (min: number, message?: MessageHandler<Internal.NumberIssue>) => Next<
						{ issue: Internal.NumberIssue },
						this['This']
					>
				: never
		>
		| DefineStepMethod<
			Meta<bigint>,
			this['This'] extends Meta<bigint>['ExpectedThis']
				? (min: bigint, message?: MessageHandler<Internal.BigIntIssue>) => Next<
						{ issue: Internal.BigIntIssue },
						this['This']
					>
				: never
		>
		| DefineStepMethod<
			Meta<{ length: number }>,
			this['This'] extends Meta<{ length: number }>['ExpectedThis']
				? (min: number, message?: MessageHandler<Internal.LengthIssue>) => Next<
						{ issue: Internal.LengthIssue },
						this['This']
					>
				: never
		>
}

/* @__NO_SIDE_EFFECTS__ */
export const min = implStepPlugin<PluginDef>({
	min: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [min, message],
	}) => {
		addSuccessStep((value) => {
			const v = (typeof value === 'bigint' || typeof value === 'number') ? value : value.length
			if (v >= min) {
				return success(value)
			}
			const target = ((typeof value === 'bigint')
				?	'bigint'
				:	(typeof value === 'number')
						? 'number'
						: 'length') as any
			return failure(
				createIssue({
					code: 'min:expected_min',
					payload: {
						target,
						value: value as any,
						min: min as any,
					},
					customMessage: message,
					defaultMessage: (typeof value === 'bigint' || typeof value === 'number')
						? `Expected a minimum value of ${min}.`
						: `Expected a minimum length of ${min}.`,
				}),
			)
		})
	},
})
