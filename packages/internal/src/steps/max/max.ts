import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
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
				? (maximum: number, message?: MessageHandler<AtMostInternal.NumberIssue>) => Next<
						{ issue: AtMostInternal.NumberIssue },
						this['CurrentValchecker']
					>
				: never
		>
		| DefineStepMethod<
			AtMostMeta<bigint>,
			this['CurrentValchecker'] extends AtMostMeta<bigint>['ExpectedCurrentValchecker']
				? (maximum: bigint, message?: MessageHandler<AtMostInternal.BigIntIssue>) => Next<
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

declare namespace LengthAtMostInternal {
	export type Issue<T extends { length: number } = { length: number }> = ExecutionIssue<
		'isLengthAtMost:expected_length_at_most',
		{ value: T, maximum: number }
	>
}

type LengthAtMostMeta = DefineStepMethodMeta<{
	Name: 'isLengthAtMost'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: { length: number } }>
	SelfIssue: LengthAtMostInternal.Issue
}>

interface LengthAtMostPluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value's length is less than or equal to the specified maximum.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, isLengthAtMost, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, isLengthAtMost] })
	 * const schema = v.string().isLengthAtMost(10)
	 * const result = schema.execute('hello')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'isLengthAtMost:expected_length_at_most'`: The value is longer than the maximum length.
	 */
	isLengthAtMost: DefineStepMethod<
		LengthAtMostMeta,
		this['CurrentValchecker'] extends LengthAtMostMeta['ExpectedCurrentValchecker']
			? InferOutput<this['CurrentValchecker']> extends infer CurrentOutput extends { length: number }
				? (maximum: number, message?: MessageHandler<LengthAtMostInternal.Issue<CurrentOutput>>) => Next<
						{ issue: LengthAtMostInternal.Issue<CurrentOutput> },
						this['CurrentValchecker']
					>
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const isLengthAtMost = implStepPlugin<LengthAtMostPluginDef>({
	isLengthAtMost: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [maximum, message],
	}) => {
		addSuccessStep(value => value.length <= maximum
			? success(value)
			: failure(
					createIssue({
						code: 'isLengthAtMost:expected_length_at_most',
						payload: { value, maximum },
						customMessage: message,
						defaultMessage: `Expected a length of at most ${maximum}.`,
					}),
				))
	},
})