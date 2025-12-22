import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionResult, Next, TStepPluginDef } from '../../core'
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
	 * The current value is passed to the provided schema's `execute()` method, and the
	 * result (either success or failure) is used as the result of this step.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, string, use } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, use] })
	 *
	 * // Define a reusable email schema
	 * const emailSchema = v.string()
	 *   .toLowercase()
	 *   .toTrimmed()
	 *   .check(x => x.includes('@'))
	 *
	 * // Use it in another schema
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
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			?	<Schema extends { execute: (value: any) => ExecutionResult }>(
					schema: Schema,
				) => Next<
					{
						output: Schema extends { execute: (value: any) => infer R }
							?	R extends { value: infer V }
								?	V
								:	never
							:	never
						issue: Schema extends { execute: (value: any) => infer R }
							?	R extends { issues: infer I }
								?	I extends readonly any[]
									?	I[number]
									:	never
								:	never
							:	never
					},
					this['CurrentValchecker']
				>
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const use = implStepPlugin<PluginDef>({
	use: ({
		utils: { addSuccessStep },
		params: [schema],
	}) => {
		addSuccessStep((value) => {
			const result = schema.execute(value)
			return result instanceof Promise
				?	result.then(r => r)
				:	result
		})
	},
})
