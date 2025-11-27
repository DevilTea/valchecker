import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, MessageHandler, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'stringifyJSON'
	ExpectedThis: DefineExpectedValchecker
	SelfIssue: ExecutionIssue<'stringifyJSON:unserializable', { value: unknown }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Converts the value to a JSON string. If the value cannot be serialized (e.g., functions, Dates, etc.), it reports an issue instead of ignoring or throwing.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, stringifyJSON } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [stringifyJSON] })
	 * const schema = v.stringifyJSON()
	 * const result = schema.execute({ name: 'John', age: 30 })
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'stringifyJSON:unserializable'`: The value cannot be serialized to JSON.
	 */
	stringifyJSON: DefineStepMethod<
		Meta,
		this['This'] extends Meta['ExpectedThis']
			?	(message?: MessageHandler<Meta['SelfIssue']>) => Next<
					{
						output: string
						issue: Meta['SelfIssue']
					},
					this['This']
				>
			:	never
	>
}

function hasUnserializable(val: any, visited = new WeakSet()): boolean {
	// Early return for serializable types
	if (
		val === null
		|| typeof val === 'number'
		|| typeof val === 'string'
		|| typeof val === 'boolean'
	) {
		return false
	}

	// Recursive checks for complex types (objects and arrays)
	if (typeof val === 'object') {
		if (visited.has(val))
			return false // circular, will be handled by JSON.stringify
		visited.add(val)
		for (const key in val) {
			if (hasUnserializable(val[key], visited))
				return true
		}
		visited.delete(val)
		return false
	}

	return true // functions, undefined, symbols, bigints, Dates, etc.
}

/* @__NO_SIDE_EFFECTS__ */
export const stringifyJSON = implStepPlugin<PluginDef>({
	stringifyJSON: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [message],
	}) => {
		addSuccessStep(
			(value) => {
				if (hasUnserializable(value)) {
					return failure(
						createIssue({
							code: 'stringifyJSON:unserializable',
							payload: { value },
							customMessage: message,
							defaultMessage: 'Value cannot be serialized to JSON.',
						}),
					)
				}
				try {
					const json = JSON.stringify(value)
					return success(json)
				}
				catch {
					return failure(
						createIssue({
							code: 'stringifyJSON:unserializable',
							payload: { value },
							customMessage: message,
							defaultMessage: 'Value cannot be serialized to JSON.',
						}),
					)
				}
			},
		)
	},
})
