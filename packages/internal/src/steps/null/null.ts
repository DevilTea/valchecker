import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import type { TUnionShorthandDef } from '../union/union-shorthand'
import { implStepPlugin } from '../../core'
import { templateLiteralPartMarker } from '../templateLiteral/template-literal-part'

type Issue = ExecutionIssue<'null:expected_null', { value: unknown }>

interface UnionShorthandDef extends TUnionShorthandDef {
	input: null
	operationMode: 'sync'
	output: null
	issue: Issue
}

type Meta = DefineStepMethodMeta<{
	Name: 'null'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: Issue
}>
interface PluginDef extends TStepPluginDef {
	UnionShorthand: UnionShorthandDef
	/**
	 * ### Description:
	 * Checks that the value is null.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, null_ } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [null_] })
	 * const schema = v.null()
	 * const result = schema.execute(null)
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'null:expected_null'`: The value is not null.
	 */
	null: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			?	IsExactlyAnyOrUnknown<InferOutput<this['CurrentValchecker']>> extends true
				?	(options?: StepOptions<Meta['SelfIssue']>) => Next<
						{
							output: null
							issue: Meta['SelfIssue']
						},
						this['CurrentValchecker']
					>
				:	never
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const null_ = implStepPlugin<PluginDef>({
	null: ({
		utils: { addSuccessStep, success, createIssue, failure, setMetadata },
		params: [options],
	}) => {
		setMetadata(templateLiteralPartMarker, { kind: 'literal', value: null })
		addSuccessStep(
			value => value === null
				?	success(value)
				:	failure(
						createIssue({
							code: 'null:expected_null',
							payload: { value },
							customMessage: options?.message,
							defaultMessage: 'Expected null.',
						}),
					),
		)
	},
}, 'sync')
