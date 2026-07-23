import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Issue<Input = unknown> = ExecutionIssue<'toString:conversion_failed', { value: Input, error: unknown }, 'operation'>
	export interface Options<Input = unknown> extends StepOptions<Issue<Input>> {
		/**
		 * Radix forwarded to the instance `toString` method. Meaningful for
		 * `number` and `bigint`; other built-in `toString` implementations ignore it.
		 */
		readonly radix?: number
	}
}

type Meta = DefineStepMethodMeta<{
	Name: 'toString'
	ExpectedCurrentValchecker: DefineExpectedValchecker<{ output: { toString: (...params: any[]) => string } }>
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Converts the current value to a string by delegating to the value's own
	 * `toString` instance method (e.g. `(255).toString(16)`). It deliberately does
	 * not use `String(value)` and never consults `Symbol.toPrimitive`.
	 *
	 * The optional `radix` is forwarded to the instance method; supply `message`
	 * in the same options object to customize the failure issue.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, number, toString } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [number, toString] })
	 * const result = v.number().toString({ radix: 16 }).execute(255)
	 * // { value: 'ff' }
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'toString:conversion_failed'`: The value's `toString` method threw. Categorized as `'operation'`.
	 */
	toString: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
			? (options?: Internal.Options<InferOutput<This>>) => Next<{
					output: string
					issue: Internal.Issue<InferOutput<This>>
				}, This>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const toString = implStepPlugin<PluginDef>({
	toString: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		const radix = options?.radix
		addSuccessStep((value) => {
			try {
				return success(radix === undefined ? value.toString() : value.toString(radix))
			}
			catch (error) {
				return failure(createIssue({
					code: 'toString:conversion_failed',
					category: 'operation',
					payload: { value, error },
					customMessage: options?.message,
					defaultMessage: 'String conversion failed.',
				}))
			}
		})
	},
}, 'sync')
