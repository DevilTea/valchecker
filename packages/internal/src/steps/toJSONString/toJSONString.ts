import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, MessageHandler, Next, TStepPluginDef } from '../../core'
import { implStepPlugin } from '../../core'

type Meta = DefineStepMethodMeta<{
	Name: 'toJSONString'
	ExpectedCurrentValchecker: DefineExpectedValchecker
	SelfIssue: ExecutionIssue<'toJSONString:unserializable', { value: unknown }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Converts the value to a JSON string. Values that cannot be serialized report an issue instead of being silently omitted or throwing.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, toJSONString } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [toJSONString] })
	 * const schema = v.toJSONString()
	 * const result = schema.execute({ name: 'John' })
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'toJSONString:unserializable'`: The value cannot be serialized to JSON.
	 */
	toJSONString: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			? (message?: MessageHandler<Meta['SelfIssue']>) => Next<
					{ output: string, issue: Meta['SelfIssue'] },
					this['CurrentValchecker']
				>
			: never
	>
}

function hasUnserializable(value: any, visited = new WeakSet()): boolean {
	if (
		value === null
		|| typeof value === 'number'
		|| typeof value === 'string'
		|| typeof value === 'boolean'
	) {
		return false
	}
	if (typeof value === 'object') {
		if (visited.has(value))
			return false
		visited.add(value)
		for (const key in value) {
			if (hasUnserializable(value[key], visited))
				return true
		}
		visited.delete(value)
		return false
	}
	return true
}

/* @__NO_SIDE_EFFECTS__ */
export const toJSONString = implStepPlugin<PluginDef>({
	toJSONString: ({
		utils: { addSuccessStep, success, createIssue, failure },
		params: [message],
	}) => {
		addSuccessStep((value) => {
			const createFailure = () => failure(
				createIssue({
					code: 'toJSONString:unserializable',
					payload: { value },
					customMessage: message,
					defaultMessage: 'Value cannot be serialized to JSON.',
				}),
			)

			if (hasUnserializable(value)) {
				return createFailure()
			}
			try {
				const json = JSON.stringify(value)
				return typeof json === 'string'
					? success(json)
					: createFailure()
			}
			catch {
				return createFailure()
			}
		})
	},
})
