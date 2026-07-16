import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferIssue, InferOperationMode, InferOutput, MessageHandler, Next, TStepPluginDef, Use, Valchecker } from '../../core'
import type { IsEqual, IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'
import { isPromiseLike } from '../../shared'

declare namespace Internal {
	export type OpMode<Item extends Use<Valchecker>> = IsEqual<InferOperationMode<Item>, 'sync'> extends true
		? 'sync'
		: 'maybe-async'
}

type Meta = DefineStepMethodMeta<{
	Name: 'array'
	ExpectedCurrentValchecker: DefineExpectedValchecker
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
		this['CurrentValchecker'] extends Meta['ExpectedCurrentValchecker']
			?	IsExactlyAnyOrUnknown<InferOutput<this['CurrentValchecker']>> extends true
				?	<Item extends Use<Valchecker>>(
						item: Item,
						message?: MessageHandler<Meta['SelfIssue']>,
					) => Next<
						{
							operationMode: Internal.OpMode<Item>
							output: InferOutput<Item>[]
							issue: Meta['SelfIssue'] | InferIssue<Item>
						},
						this['CurrentValchecker']
					>
				: never
			: never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const array = implStepPlugin<PluginDef>({
	array: ({
		utils: { addSuccessStep, success, createIssue, failure, prependIssuePath },
		params: [item, message],
	}) => {
		const execute = item['~execute']

		const appendItemIssues = (
			issues: ExecutionIssue[] | undefined,
			itemIssues: ExecutionIssue[],
			index: number,
		): ExecutionIssue[] => {
			const target = issues ?? []
			const path = [index]
			for (const issue of itemIssues)
				target.push(prependIssuePath(issue, path))
			return target
		}

		const continueAsync = async (
			firstResult: PromiseLike<ExecutionResult>,
			firstIndex: number,
			remainingValues: unknown[],
			output: unknown[],
			initialIssues: ExecutionIssue[] | undefined,
		): Promise<ExecutionResult> => {
			let result = await firstResult
			let issues = initialIssues
			let index = firstIndex

			while (true) {
				if ('issues' in result)
					issues = appendItemIssues(issues, result.issues, index)
				else
					output[index] = result.value

				index++
				if (index >= output.length)
					return issues == null ? success(output) : failure(issues)

				result = await execute(remainingValues[index - firstIndex - 1])
			}
		}

		addSuccessStep((value) => {
			if (Array.isArray(value) === false) {
				return failure(
					createIssue({
						code: 'array:expected_array',
						payload: { value },
						customMessage: message,
						defaultMessage: 'Expected an array.',
					}),
				)
			}

			const len = value.length
			// eslint-disable-next-line unicorn/no-new-array
			const output = new Array(len)
			let issues: ExecutionIssue[] | undefined

			for (let i = 0; i < len; i++) {
				const itemResult = execute(value[i])

				if (isPromiseLike(itemResult)) {
					const remainingLen = len - i - 1
					// Preserve the existing contract: remaining item values are read
					// immediately when the first asynchronous result is encountered.
					// eslint-disable-next-line unicorn/no-new-array
					const remainingValues = new Array(remainingLen)
					for (let j = 0; j < remainingLen; j++)
						remainingValues[j] = value[i + j + 1]

					return continueAsync(itemResult, i, remainingValues, output, issues)
				}

				if ('issues' in itemResult)
					issues = appendItemIssues(issues, itemResult.issues, i)
				else
					output[i] = itemResult.value
			}

			return issues == null ? success(output) : failure(issues)
		})
	},
})
