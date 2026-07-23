import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Issue<T = unknown> = ExecutionIssue<
		'toMappedBoolean:unmapped_value',
		{ value: T, trueValues: readonly T[], falseValues: readonly T[] }
	>
	export interface Options<T> extends StepOptions<Issue<T>> {
		readonly trueValues: readonly T[]
		readonly falseValues: readonly T[]
	}
}

type Meta = DefineStepMethodMeta<{
	Name: 'toMappedBoolean'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string | number | bigint }>
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Maps configured string, number, or bigint values to booleans using
	 * SameValueZero equality, without coercion, trimming, or case normalization.
	 * The `trueValues` and `falseValues` arrays are captured as immutable
	 * schema-time snapshots and included in the failure payload. Supplying two
	 * empty arrays, or overlapping values, throws a `TypeError` while constructing
	 * the schema.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, string, toMappedBoolean } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, toMappedBoolean] })
	 * const schema = v.string().toMappedBoolean({
	 * 	trueValues: ['Y', 'yes'],
	 * 	falseValues: ['N', 'no'],
	 * })
	 * const result = schema.execute('yes')
	 * // result.value: true
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'toMappedBoolean:unmapped_value'`: The value matches no configured mapping.
	 */
	toMappedBoolean: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
			? InferOutput<This> extends infer CurrentOutput
				? (options: Internal.Options<CurrentOutput>) => Next<{
						output: boolean
						issue: Internal.Issue<CurrentOutput>
					}, This>
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const toMappedBoolean = implStepPlugin<PluginDef>({
	toMappedBoolean: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		if (options.trueValues.length === 0 && options.falseValues.length === 0)
			throw new TypeError('toMappedBoolean() requires at least one configured value.')

		const trueValuesSnapshot = Object.freeze([...options.trueValues])
		const falseValuesSnapshot = Object.freeze([...options.falseValues])
		const trueValues = new Set(trueValuesSnapshot)
		const falseValues = new Set(falseValuesSnapshot)
		for (const value of trueValues) {
			if (falseValues.has(value))
				throw new TypeError('toMappedBoolean() trueValues and falseValues must not overlap.')
		}

		addSuccessStep((value) => {
			if (trueValues.has(value))
				return success(true)
			if (falseValues.has(value))
				return success(false)
			return failure(createIssue({
				code: 'toMappedBoolean:unmapped_value',
				payload: {
					value,
					trueValues: trueValuesSnapshot,
					falseValues: falseValuesSnapshot,
				},
				customMessage: options.message,
				defaultMessage: 'Expected the value to match a configured boolean mapping.',
			}))
		})
	},
}, 'sync')
