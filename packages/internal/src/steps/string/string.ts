import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'
import { templateLiteralPartMarker } from '../templateLiteral/template-literal-part'

type Meta = DefineStepMethodMeta<{
	Name: 'string'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: ExecutionIssue<'string:expected_string', { value: unknown }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is a string.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string] })
	 * const schema = v.string()
	 * const result = schema.execute('hello')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'string:expected_string'`: The value is not a string.
	 */
	string: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			?	IsExactlyAnyOrUnknown<InferOutput<this['CurrentValchecker']>> extends true
				?	(options?: StepOptions<Meta['SelfIssue']>) => Next<
						{
							output: string
							issue: Meta['SelfIssue']
						},
						this['CurrentValchecker']
					>
				:	never
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const string = implStepPlugin<PluginDef>({
	string: ({
		utils: { addSuccessStep, success, createIssue, failure, setMetadata },
		params: [options],
	}) => {
		setMetadata(templateLiteralPartMarker, { kind: 'string' })
		addSuccessStep(
			value => typeof value === 'string'
				?	success(value)
				:	failure(
						createIssue({
							code: 'string:expected_string',
							payload: { value },
							customMessage: options?.message,
							defaultMessage: 'Expected a string.',
						}),
					),
		)
	},
}, 'sync')
