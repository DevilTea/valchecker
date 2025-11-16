import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferAsync, InferIssue, InferOutput, MessageHandler, Next, TStepPluginDef, Use, Valchecker } from '../../core'
import type { IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'

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

			// Optimized: Direct processing without Pipe overhead
			const issues: ExecutionIssue[] = []
			const len = value.length
			const output = Array.from({ length: len })

			const processItemResult = (result: ExecutionResult, i: number) => {
				if (isFailure(result)) {
					// Optimize: Avoid spread and map by using direct loop
					for (const issue of result.issues!) {
						issues.push(prependIssuePath(issue, [i]))
					}
				}
				else {
					output[i] = result.value!
				}
			}

			// Process items synchronously until we hit async
			for (let i = 0; i < len; i++) {
				const itemValue = value[i]!
				const itemResult = item['~execute'](itemValue)

				if (itemResult instanceof Promise) {
					// Hit async, chain remaining items
					let chain = itemResult.then(r => processItemResult(r, i))
					for (let j = i + 1; j < len; j++) {
						const jValue = value[j]!
						const jIndex = j
						chain = chain.then(() => {
							const jResult = item['~execute'](jValue)
							return jResult instanceof Promise
								? jResult.then(r => processItemResult(r, jIndex))
								: (processItemResult(jResult, jIndex), undefined)
						})
					}
					return chain.then(() => issues.length > 0 ? failure(issues) : success(output))
				}

				processItemResult(itemResult, i)
			}

			return issues.length > 0 ? failure(issues) : success(output)
		})
	},
})
