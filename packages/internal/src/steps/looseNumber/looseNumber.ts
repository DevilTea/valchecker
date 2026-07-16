import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'looseNumber'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: ExecutionIssue<'looseNumber:expected_number', { value: unknown }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is a number or a string compatible with TypeScript's `${number}` template literal type, then normalizes the output to a number.
	 *
	 * This is not general JavaScript coercion. The empty string, `"NaN"`, and infinite string values are rejected. TypeScript-compatible whitespace-only strings normalize to `0`.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, looseNumber } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [looseNumber] })
	 * const schema = v.looseNumber()
	 * const result = schema.execute('42')
	 * // { value: 42 }
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'looseNumber:expected_number'`: The value is neither a number nor a TypeScript-compatible number string.
	 */
	looseNumber: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? IsExactlyAnyOrUnknown<InferOutput<this['CurrentValchecker']>> extends true
				? (message?: MessageHandler<Meta['SelfIssue']>) => Next<
						{
							output: number
							issue: Meta['SelfIssue']
						},
						this['CurrentValchecker']
					>
				: never
			: never
	>
}

function parseLooseNumber(value: unknown): number | undefined {
	if (typeof value === 'number') {
		return value
	}
	if (typeof value !== 'string' || value === '') {
		return undefined
	}
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : undefined
}

/* @__NO_SIDE_EFFECTS__ */
export const looseNumber = implStepPlugin<PluginDef>({
	looseNumber: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [message],
	}) => {
		addSuccessStep((value) => {
			const parsed = parseLooseNumber(value)
			return parsed !== undefined
				? success(parsed)
				: failure(
						createIssue({
							code: 'looseNumber:expected_number',
							payload: { value },
							customMessage: message,
							defaultMessage: 'Expected a number or number string.',
						}),
					)
		})
	},
})
