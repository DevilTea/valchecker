import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export interface Options<T> {
		readonly trueValues: readonly T[]
		readonly falseValues: readonly T[]
	}
	export type Issue<T = unknown> = ExecutionIssue<
		'toMappedBoolean:unmapped_value',
		{ value: T, trueValues: readonly T[], falseValues: readonly T[] }
	>
}

type Meta = DefineStepMethodMeta<{
	Name: 'toMappedBoolean'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string | number | bigint }>
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * Maps configured values to booleans with SameValueZero equality. Failure
	 * payloads include immutable snapshots of both configured mappings.
	 */
	toMappedBoolean: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
			? InferOutput<This> extends infer CurrentOutput
				? (
					options: Internal.Options<CurrentOutput>,
					message?: MessageHandler<Internal.Issue<CurrentOutput>>,
				) => Next<{
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
		params: [options, message],
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
				customMessage: message,
				defaultMessage: 'Expected the value to match a configured boolean mapping.',
			}))
		})
	},
})
