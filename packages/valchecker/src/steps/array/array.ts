import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferAsync, InferIssue, InferOutput, MessageHandler, Next, TStepPluginDef, Use, Valchecker } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'
import { Pipe } from '../../shared'

type Meta = DefineStepMethodMeta<{
	Name: 'array'
	ExpectedThis: DefineExpectedValchecker
	SelfIssue: ExecutionIssue<'array:expected_array', { value: unknown }>
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value is an array.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, array, string } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [array, string] })
	 * const schema = v.array(v.string())
	 * const result = schema.execute(['hello', 'world'])
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - `'array:expected_array'`: The value is not an array.
	 */
	array: DefineStepMethod<
		Meta,
		this['This'] extends Meta['ExpectedThis']
			?	IsExactlyAnyOrUnknown<InferOutput<this['This']>> extends true
				?	<Item extends Use<Valchecker>>(
						item: Item,
						message?: MessageHandler<Meta['SelfIssue']>,
					) => Next<
						{
							async: InferAsync<Item>
							output: InferOutput<Item>[]
							issue: Meta['SelfIssue'] | InferIssue<Item>
						},
						this['This']
					>
				:	never
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const array = implStepPlugin<PluginDef>({
	array: ({
		utils: { addSuccessStep, success, resolveMessage, failure, isFailure, prependIssuePath },
		params: [item, message],
	}) => {
		addSuccessStep((value) => {
			if (Array.isArray(value) === false) {
				return failure({
					code: 'array:expected_array',
					payload: { value },
					message: resolveMessage(
						{
							code: 'array:expected_array',
							payload: { value },
						},
						message,
						'Expected an array.',
					),
				})
			}

			const pipe = new Pipe<void>()
			const issues: ExecutionIssue[] = []
			const output = [...value]
			const processItemResult = (result: ExecutionResult, i: number) => {
				if (isFailure(result))
					issues.push(...result.issues.map(issue => prependIssuePath(issue, [i])))
				else
					output[i] = result.value
			}
			for (let i = 0; i < value.length; i++) {
				const itemValue = value[i]!
				pipe.add(() => {
					const itemResult = item['~execute'](itemValue)
					return itemResult instanceof Promise
						? itemResult.then(r => processItemResult(r, i))
						: processItemResult(itemResult, i)
				})
			}

			const processResult = () => issues.length > 0 ? failure(issues) : success(output)
			const result = pipe.exec()
			return result instanceof Promise
				? result.then(processResult)
				: processResult()
		})
	},
})
