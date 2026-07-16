import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, MessageHandler, Next, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'looseBigint'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: ExecutionIssue<'looseBigint:expected_bigint', { value: unknown }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is a bigint or a string compatible with TypeScript's `${bigint}` template literal type, then normalizes the output to a bigint.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, looseBigint } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [looseBigint] })
	 * const result = v.looseBigint().execute('42')
	 * // { value: 42n }
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'looseBigint:expected_bigint'`: The value is neither a bigint nor a TypeScript-compatible bigint string.
	 */
	looseBigint: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? IsExactlyAnyOrUnknown<InferOutput<this['CurrentValchecker']>> extends true
				? (message?: MessageHandler<Meta['SelfIssue']>) => Next<
						{ output: bigint, issue: Meta['SelfIssue'] },
						this['CurrentValchecker']
					>
				: never
			: never
	>
}

const BIGINT_STRING_RE = /^(?:-?(?:0|[1-9]\d*)|-?0[xX][\da-fA-F]+|-?0[bB][01]+|-?0[oO][0-7]+)$/

function parseLooseBigint(value: unknown): bigint | undefined {
	if (typeof value === 'bigint') {
		return value
	}
	if (typeof value !== 'string' || !BIGINT_STRING_RE.test(value)) {
		return undefined
	}
	return value.startsWith('-0x') || value.startsWith('-0X')
		|| value.startsWith('-0b') || value.startsWith('-0B')
		|| value.startsWith('-0o') || value.startsWith('-0O')
		? -BigInt(value.slice(1))
		: BigInt(value)
}

/* @__NO_SIDE_EFFECTS__ */
export const looseBigint = implStepPlugin<PluginDef>({
	looseBigint: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [message],
	}) => {
		addSuccessStep((value) => {
			const parsed = parseLooseBigint(value)
			return parsed !== undefined
				? success(parsed)
				: failure(
						createIssue({
							code: 'looseBigint:expected_bigint',
							payload: { value },
							customMessage: message,
							defaultMessage: 'Expected a bigint or bigint string.',
						}),
					)
		})
	},
})