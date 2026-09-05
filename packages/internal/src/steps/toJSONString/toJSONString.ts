import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'
import { markIssueSnapshotPayload } from '../../core/core'
import { snapshotMessageOptions } from '../../core/message'

declare namespace Internal {
	export type UnserializableIssue<Input = unknown> = ExecutionIssue<
		'toJSONString:unserializable',
		{ reason: 'undefined_result', value: Input, at: [] }
	>
	export type SerializationFailedIssue<Input = unknown> = ExecutionIssue<
		'toJSONString:serialization_failed',
		{ value: Input, at: [], error: unknown },
		'operation'
	>
	export type Issue<Input = unknown> = UnserializableIssue<Input> | SerializationFailedIssue<Input>
}

type Meta = DefineStepMethodMeta<{
	Name: 'toJSONString'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Internal.Issue
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Converts the current value to JSON text with native `JSON.stringify()`
	 * semantics. Native omission and `null` coercion behavior are preserved. If
	 * `JSON.stringify()` returns `undefined`, the step emits
	 * `toJSONString:unserializable`; if serialization throws, it emits the
	 * operation issue `toJSONString:serialization_failed`.
	 *
	 * Use `toStrictJSONString()` when lossy slots such as nested `undefined`,
	 * functions, symbols, or sparse-array holes should be rejected instead.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, toJSONString, unknown } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [unknown, toJSONString] })
	 * const schema = v.unknown().toJSONString()
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'toJSONString:unserializable'`: Native serialization returned `undefined` instead of JSON text.
	 * - `'toJSONString:serialization_failed'`: Native JSON serialization threw.
	 */
	toJSONString: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
			? (options?: StepOptions<Internal.Issue<InferOutput<This>>>) => Next<
					{ output: string, issue: Internal.Issue<InferOutput<This>> },
					This
				>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const toJSONString = implStepPlugin<PluginDef>({
	toJSONString: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		const messageOptions = snapshotMessageOptions(options)
		addSuccessStep((value) => {
			try {
				const json = JSON.stringify(value)
				if (typeof json === 'string')
					return success(json)
				return failure(createIssue({
					code: 'toJSONString:unserializable',
					payload: markIssueSnapshotPayload(
						{ reason: 'undefined_result', value, at: [] },
						{ at: 'container' },
					),
					customMessage: messageOptions?.message,
					defaultMessage: 'Value cannot be serialized to JSON.',
				}))
			}
			catch (error) {
				return failure(createIssue({
					code: 'toJSONString:serialization_failed',
					category: 'operation',
					payload: markIssueSnapshotPayload(
						{ value, at: [], error },
						{ at: 'container' },
					),
					customMessage: messageOptions?.message,
					defaultMessage: 'JSON serialization failed.',
				}))
			}
		})
	},
}, 'sync')
