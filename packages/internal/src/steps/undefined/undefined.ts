import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import type { TUnionShorthandDef } from '../union/union-shorthand'
import { implStepPlugin } from '../../core'

type Issue = ExecutionIssue<'undefined:expected_undefined', { value: unknown }>

interface UnionShorthandDef extends TUnionShorthandDef {
	input: undefined
	operationMode: 'sync'
	output: undefined
	issue: Issue
}

type Meta = DefineStepMethodMeta<{
	Name: 'undefined'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Issue
}>
interface PluginDef extends TStepPluginDef {
	UnionShorthand: UnionShorthandDef
	/**
	 * ### Description:
	 * Checks that the value is undefined.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, undefined_ } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [undefined_] })
	 * const schema = v.undefined()
	 * const result = schema.execute(undefined)
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'undefined:expected_undefined'`: The value is not undefined.
	 */
	undefined: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			?	IsExactlyAnyOrUnknown<InferOutput<this['CurrentValchecker']>> extends true
				?	(options?: StepOptions<Meta['SelfIssue']>) => Next<
						{
							output: undefined
							issue: Meta['SelfIssue']
						},
						this['CurrentValchecker']
					>
				:	never
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const undefined_ = implStepPlugin<PluginDef>({
	undefined: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
		addSuccessStep(
			value => value === void 0
				?	success(value)
				:	failure(
						createIssue({
							code: 'undefined:expected_undefined',
							payload: { value },
							customMessage: options?.message,
							defaultMessage: 'Expected undefined.',
						}),
					),
		)
	},
}, 'sync')
