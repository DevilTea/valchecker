import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toMappedBoolean'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: string | number | bigint }>
	SelfIssue: ExecutionIssue<'toMappedBoolean:unmapped_value', { value: unknown }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Converts configured values to booleans using SameValueZero equality, the same equality semantics used by JavaScript `Set`.
	 *
	 * Values outside both mappings produce an issue. The mappings do not trim, normalize case, or perform coercion. Overlapping mappings and two empty mappings are invalid schema configurations and throw immediately.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, string, toMappedBoolean } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, toMappedBoolean] })
	 * const schema = v.string().toMappedBoolean({
	 *   trueValues: ['Y', 'yes'],
	 *   falseValues: ['N', 'no'],
	 * })
	 * const result = schema.execute('Y')
	 * // { value: true }
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'toMappedBoolean:unmapped_value'`: The value is not present in either configured mapping.
	 */
	toMappedBoolean: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? (
				options: {
					readonly trueValues: readonly InferOutput<this['CurrentValchecker']>[]
					readonly falseValues: readonly InferOutput<this['CurrentValchecker']>[]
				},
				message?: MessageHandler<Meta['SelfIssue']>,
			) => Next<
				{
					output: boolean
					issue: Meta['SelfIssue']
				},
				this['CurrentValchecker']
			>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const toMappedBoolean = implStepPlugin<PluginDef>({
	toMappedBoolean: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options, message],
	}) => {
		if (options.trueValues.length === 0 && options.falseValues.length === 0) {
			throw new TypeError('toMappedBoolean() requires at least one configured value.')
		}

		const trueValues = new Set(options.trueValues)
		const falseValues = new Set(options.falseValues)
		for (const value of trueValues) {
			if (falseValues.has(value)) {
				throw new TypeError('toMappedBoolean() trueValues and falseValues must not overlap.')
			}
		}

		addSuccessStep((value) => {
			if (trueValues.has(value)) {
				return success(true)
			}
			if (falseValues.has(value)) {
				return success(false)
			}

			return failure(
				createIssue({
					code: 'toMappedBoolean:unmapped_value',
					payload: { value },
					customMessage: message,
					defaultMessage: 'Expected the value to match a configured boolean mapping.',
				}),
			)
		})
	},
})
