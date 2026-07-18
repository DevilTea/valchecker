import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, InferOutput, Next, StepOptions, TStepPluginDef } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import type { HasRegisteredPlugin } from '../union/union-shorthand'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'null'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: ExecutionIssue<'null:expected_null', { value: unknown }>
}>

declare const nullPluginDefBrand: unique symbol

interface PluginDef extends TStepPluginDef {
	readonly [nullPluginDefBrand]: true
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
	 * const schema = v.null_()
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
		utils: { addSuccessStep, success, createIssue, failure },
		params: [options],
	}) => {
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
})

declare module '../union/union-shorthand' {
	interface UnionShorthandInputRegistry<Registered extends TStepPluginDef> {
		null: HasRegisteredPlugin<Registered, PluginDef> extends true
			? null
			: never
	}

	interface UnionShorthandResultRegistry<Registered extends TStepPluginDef, Branch> {
		null: HasRegisteredPlugin<Registered, PluginDef> extends true
			? Branch extends null
				? {
					operationMode: 'sync'
					output: null
					issue: Meta['SelfIssue']
				}
				: never
			: never
	}
}
