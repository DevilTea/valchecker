import type { AnyExecutionIssue, DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferIssue, InferOperationMode, InferOutput, MessageHandler, Next, TStepPluginDef, Use, Valchecker } from '../../core'
import type { IsEqual, IsExactlyAnyOrUnknown } from '../../shared'
import { hasInternalIssue, implStepPlugin } from '../../core'
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
				:	never
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const array = implStepPlugin<PluginDef>({
	array: ({
		utils: { addSuccessStep, success, createIssue, failure, isFailure, prependIssuePath },
		params: [item, message],
	}) => {
		addSuccessStep((value) => {
			if (Array.isArray(value) === false) {
				return failure(createIssue({
					code: 'array:expected_array',
					payload: { value },
					customMessage: message,
					defaultMessage: 'Expected an array.',
				}))
			}

			const issues: AnyExecutionIssue[] = []
			const len = value.length
			// eslint-disable-next-line unicorn/no-new-array
			const output = new Array(len)
			const execute = item['~execute']

			const processItemResult = (result: ExecutionResult, index: number): boolean => {
				if (isFailure(result)) {
					for (const issue of result.issues)
						issues.push(prependIssuePath(issue, [index]))
					return hasInternalIssue(result.issues)
				}
				output[index] = result.value
				return false
			}

			const continueAsync = async (startIndex: number, firstResult: PromiseLike<ExecutionResult>) => {
				for (let i = startIndex; i < len; i++) {
					const result = i === startIndex
						? await firstResult
						: await execute(value[i])
					if (processItemResult(result, i))
						return failure(issues)
				}
				return issues.length > 0 ? failure(issues) : success(output)
			}

			for (let i = 0; i < len; i++) {
				const result = execute(value[i])
				if (isPromiseLike(result))
					return continueAsync(i, result)
				if (processItemResult(result, i))
					return failure(issues)
			}

			return issues.length > 0 ? failure(issues) : success(output)
		})
	},
})
