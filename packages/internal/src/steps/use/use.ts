import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, InferIssue, InferOperationMode, InferOutput, Next, TStepPluginDef, Use, Valchecker } from '../../core'
import type { IsEqual } from '../../shared'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'use'
	ExpectedCurrentValchecker: DefineExpectedValchecker
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Uses another valchecker schema to validate and transform the current value.
	 *
	 * This step allows you to compose schemas by delegating validation to another schema.
	 * The current value is passed to the provided schema, and the delegated result is used
	 * as the result of this step. Delegated async work is conditional; call `toAsync()`
	 * when the composed schema must always return a native Promise.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, string, use } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, use] })
	 *
	 * const emailSchema = v.string()
	 *   .toLowercase()
	 *   .toTrimmed()
	 *   .check(x => x.includes('@'))
	 *
	 * const schema = v.unknown().use(emailSchema)
	 * const result = schema.execute('  TEST@EXAMPLE.COM  ')
	 * // result.value: 'test@example.com'
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * None directly. This step transparently passes through any issues from the provided schema.
	 */
	use: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
			? <Schema extends Use<Valchecker>>(
					schema: Schema,
				) => Next<
					{
						operationMode: IsEqual<InferOperationMode<Schema>, 'sync'> extends true ? 'sync' : 'maybe-async'
						output: InferOutput<Schema>
						issue: InferIssue<Schema>
					},
					This
				>
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const use = implStepPlugin<PluginDef>({
	use: ({
		utils: { addSuccessStep },
		params: [schema],
	}) => {
		const operationMode = schema['~core']?.operationMode === 'sync' ? 'sync' : 'maybe-async'
		addSuccessStep(value => schema['~execute'](value), operationMode)
	},
})
