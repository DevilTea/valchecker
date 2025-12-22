import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, MessageHandler, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Input = number | bigint | { length: number }

	export type NumberIssue = ExecutionIssue<'max:expected_max', { target: 'number', value: number, max: number }>
	export type BigIntIssue = ExecutionIssue<'max:expected_max', { target: 'bigint', value: bigint, max: bigint }>
	export type LengthIssue = ExecutionIssue<'max:expected_max', { target: 'length', value: { length: number }, max: number }>

	export type Issue<T extends Input> = [
		number extends T ? NumberIssue : never,
		bigint extends T ? BigIntIssue : never,
		{ length: number } extends T ? LengthIssue : never,
	][number]
}

type Meta<T extends Internal.Input> = T extends Internal.Input
	? DefineStepMethodMeta<{
		Name: 'max'
		ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: T }>
		SelfIssue: Internal.Issue<T>
	}>
	: never

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is less than or equal to the specified maximum.
	 *
	 * ---
	 *
	 * ### Example:
	 * #### Usage with numbers
	 * ```ts
	 * import { createValchecker, number, max } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [number, max] })
	 * const schema = v.number().max(100)
	 * const result = schema.execute(50)
	 * ```
	 *
	 * #### Usage with bigints
	 * ```ts
	 * import { createValchecker, bigint, max } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [bigint, max] })
	 * const schema = v.bigint().max(100n)
	 * const result = schema.execute(50n)
	 * ```
	 *
	 * #### Usage with lengths
	 * ```ts
	 * import { createValchecker, string, max } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, max] })
	 * const schema = v.string().max(10)
	 * const result = schema.execute('hello')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'max:expected_max'`: The value exceeds the maximum.
	 */
	max:
		| DefineStepMethod<
			Meta<number>,
			this['CurrentValchecker'] extends Meta<number>['ExpectedCurrentValchecker']
				? (max: number, message?: MessageHandler<Internal.NumberIssue>) => Next<
						{ issue: Internal.NumberIssue },
						this['CurrentValchecker']
					>
				: never
		>
		| DefineStepMethod<
			Meta<bigint>,
			this['CurrentValchecker'] extends Meta<bigint>['ExpectedCurrentValchecker']
				? (max: bigint, message?: MessageHandler<Internal.BigIntIssue>) => Next<
						{ issue: Internal.BigIntIssue },
						this['CurrentValchecker']
					>
				: never
		>
		| DefineStepMethod<
			Meta<{ length: number }>,
			this['CurrentValchecker'] extends Meta<{ length: number }>['ExpectedCurrentValchecker']
				? (max: number, message?: MessageHandler<Internal.LengthIssue>) => Next<
						{ issue: Internal.LengthIssue },
						this['CurrentValchecker']
					>
				: never
		>
}

/* @__NO_SIDE_EFFECTS__ */
export const max = implStepPlugin<PluginDef>({
	max: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [max, message],
	}) => {
		addSuccessStep((value) => {
			const v = (typeof value === 'bigint' || typeof value === 'number') ? value : value.length
			if (v <= max) {
				return success(value)
			}
			const target = ((typeof value === 'bigint')
				?	'bigint'
				:	(typeof value === 'number')
						? 'number'
						: 'length') as any
			return failure(
				createIssue({
					code: 'max:expected_max',
					payload: {
						target,
						value: value as any,
						max: max as any,
					},
					customMessage: message,
					defaultMessage: (typeof value === 'bigint' || typeof value === 'number')
						? `Expected a maximum value of ${max}.`
						: `Expected a maximum length of ${max}.`,
				}),
			)
		})
	},
})
