import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'
import { snapshotMessage } from '../../core/message'
import { bigintLiteralPattern } from './bigint-literal'

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
				? (options?: StepOptions<Meta['SelfIssue']>) => Next<
						{ output: bigint, issue: Meta['SelfIssue'] },
						this['CurrentValchecker']
					>
				: never
			: never
	>
}

function parseLooseBigint(value: unknown): bigint | undefined {
	if (typeof value === 'bigint') {
		return value
	}
	if (typeof value !== 'string' || !bigintLiteralPattern.test(value)) {
		return undefined
	}
	// The regex already validated the string, so any '-0'-prefixed value longer than 2 chars is a negative radix
	// literal (`-0x`/`-0b`/`-0o`), which `BigInt()` cannot parse directly. Bare '-0' has length 2 and stays on the
	// direct path (`BigInt('-0') === 0n`).
	return value.startsWith('-0') && value.length > 2
		? -BigInt(value.slice(1))
		: BigInt(value)
}

/* @__NO_SIDE_EFFECTS__ */
export const looseBigint = implStepPlugin<PluginDef>({
	looseBigint: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		const message = snapshotMessage(options?.message)
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
}, 'sync')
