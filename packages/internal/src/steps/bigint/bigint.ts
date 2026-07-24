import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'
import { templateLiteralPartMarker } from '../templateLiteral/template-literal-part'

type Meta = DefineStepMethodMeta<{
	Name: 'bigint'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: ExecutionIssue<'bigint:expected_bigint', { value: unknown }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is a bigint.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, bigint } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [bigint] })
	 * const schema = v.bigint()
	 * const result = schema.execute(42n)
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'bigint:expected_bigint'`: The value is not a bigint.
	 */
	bigint: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			?	IsExactlyAnyOrUnknown<InferOutput<this['CurrentValchecker']>> extends true
				?	(options?: StepOptions<Meta['SelfIssue']>) => Next<
						{
							output: bigint
							issue: Meta['SelfIssue']
						},
						this['CurrentValchecker']
					>
				:	never
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const bigint = implStepPlugin<PluginDef>({
	bigint: ({
		utils: { addSuccessStep, success, createIssue, failure, setMetadata },
		params: [options],
	}) => {
		setMetadata(templateLiteralPartMarker, { kind: 'bigint' })
		addSuccessStep(
			value => typeof value === 'bigint'
				?	success(value)
				:	failure(
						createIssue({
							code: 'bigint:expected_bigint',
							payload: { value },
							customMessage: options?.message,
							defaultMessage: 'Expected a bigint.',
						}),
					),
		)
	},
}, 'sync')
