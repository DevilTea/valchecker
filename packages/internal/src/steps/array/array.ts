import type { AnyExecutionIssue, DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferIssue, InferOperationMode, InferOutput, Next, StructuralStepOptions, TStepPluginDef, Use, Valchecker } from '../../core'
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
	 * By default, item traversal stops after the first failing item. Set
	 * `collectAllIssues: true` to continue through later items.
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
			? IsExactlyAnyOrUnknown<InferOutput<this['CurrentValchecker']>> extends true
				? <Item extends Use<Valchecker>>(
						item: Item,
						options?: StructuralStepOptions<Meta['SelfIssue'] | InferIssue<Item>>,
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
		utils: { addSuccessStep, success, createIssue, failure, isFailure, prependIssuePath },
		params: [item, options],
	}) => {
		const operationMode = item['~core']?.operationMode === 'sync' ? 'sync' : 'maybe-async'
		const childIsSynchronous = operationMode === 'sync'
		const execute = item['~execute']
		const collectAllIssues = options?.collectAllIssues === true

		const expectedArrayFailure = (value: unknown) => failure(createIssue({
			code: 'array:expected_array',
			payload: { value },
			customMessage: options?.message,
			defaultMessage: 'Expected an array.',
		}))

		const prependChildIssues = (result: ExecutionResult, index: number): AnyExecutionIssue[] => {
			const issues: AnyExecutionIssue[] = []
			if (isFailure(result)) {
				for (const issue of result.issues)
					issues.push(prependIssuePath(issue, [index], options?.message))
			}
			return issues
		}

		const executeFirstIssue = (value: unknown) => {
			if (!Array.isArray(value))
				return expectedArrayFailure(value)

			const len = value.length
			// eslint-disable-next-line unicorn/no-new-array
			const output = new Array(len)

			const continueAsync = async (
				startIndex: number,
				firstResult: PromiseLike<ExecutionResult>,
			): Promise<ExecutionResult> => {
				for (let index = startIndex; index < len; index++) {
					const result = index === startIndex
						? await firstResult
						: await execute(value[index])
					if (isFailure(result))
						return failure(prependChildIssues(result, index))
					output[index] = result.value
				}
				return success(output)
			}

			for (let index = 0; index < len; index++) {
				const result = execute(value[index])
				if (!childIsSynchronous && isPromiseLike(result))
					return continueAsync(index, result)
				const syncResult = result as ExecutionResult
				if (isFailure(syncResult))
					return failure(prependChildIssues(syncResult, index))
				output[index] = syncResult.value
			}
			return success(output)
		}

		const executeCollectAll = (value: unknown) => {
			if (!Array.isArray(value))
				return expectedArrayFailure(value)

			let issues: AnyExecutionIssue[] | undefined
			const len = value.length
			// eslint-disable-next-line unicorn/no-new-array
			const output = new Array(len)

			const appendChildIssues = (result: ExecutionResult, index: number): boolean => {
				if (!isFailure(result))
					return false
				let hasInternal = false
				const target = issues ??= []
				for (const issue of result.issues) {
					if (issue.category === 'internal')
						hasInternal = true
					target.push(prependIssuePath(issue, [index], options?.message))
				}
				return hasInternal
			}

			const continueAsync = async (
				startIndex: number,
				firstResult: PromiseLike<ExecutionResult>,
			): Promise<ExecutionResult> => {
				for (let index = startIndex; index < len; index++) {
					const result = index === startIndex
						? await firstResult
						: await execute(value[index])
					if (appendChildIssues(result, index))
						return failure(issues!)
					if (!isFailure(result))
						output[index] = result.value
				}
				return issues == null ? success(output) : failure(issues)
			}

			for (let index = 0; index < len; index++) {
				const result = execute(value[index])
				if (!childIsSynchronous && isPromiseLike(result))
					return continueAsync(index, result)
				const syncResult = result as ExecutionResult
				if (appendChildIssues(syncResult, index))
					return failure(issues!)
				if (!isFailure(syncResult))
					output[index] = syncResult.value
			}
			return issues == null ? success(output) : failure(issues)
		}

		addSuccessStep(collectAllIssues ? executeCollectAll : executeFirstIssue, operationMode)
	},
})