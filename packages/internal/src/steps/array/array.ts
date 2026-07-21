import type { AnyExecutionIssue, DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferIssue, InferOperationMode, InferOutput, Next, StructuralStepOptions, TStepPluginDef, Use, Valchecker } from '../../core'
import type { IsEqual, IsExactlyAnyOrUnknown } from '../../shared'
import { implStepPlugin } from '../../core'
import { getStructuralRawSyncExecutor } from '../../core/raw-sync-executor'
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
		const execute = childIsSynchronous
			? getStructuralRawSyncExecutor(item)
			: item['~execute']
		const collectAllIssues = options?.collectAllIssues === true

		const appendChildIssues = (
			result: ExecutionResult,
			index: number,
			issues: AnyExecutionIssue[] | undefined,
		): { issues: AnyExecutionIssue[], hasInternal: boolean } => {
			let hasInternal = false
			const target = issues ?? []
			if (isFailure(result)) {
				for (const issue of result.issues) {
					if (issue.category === 'internal')
						hasInternal = true
					target.push(prependIssuePath(issue, [index], options?.message))
				}
			}
			return { issues: target, hasInternal }
		}

		const continueAsync = async (
			value: unknown[],
			startIndex: number,
			firstResult: PromiseLike<ExecutionResult>,
			output: unknown[],
			issues: AnyExecutionIssue[] | undefined,
		): Promise<ExecutionResult> => {
			for (let index = startIndex; index < value.length; index++) {
				const result = index === startIndex
					? await firstResult
					: await execute(value[index])
				if (isFailure(result)) {
					const appended = appendChildIssues(result, index, issues)
					issues = appended.issues
					if (appended.hasInternal || !collectAllIssues)
						return failure(issues)
				}
				else {
					output[index] = result.value
				}
			}
			return issues == null ? success(output) : failure(issues)
		}

		addSuccessStep((value) => {
			if (!Array.isArray(value)) {
				return failure(createIssue({
					code: 'array:expected_array',
					payload: { value },
					customMessage: options?.message,
					defaultMessage: 'Expected an array.',
				}))
			}

			let issues: AnyExecutionIssue[] | undefined
			const len = value.length
			// eslint-disable-next-line unicorn/no-new-array
			const output = new Array(len)

			for (let index = 0; index < len; index++) {
				const result = execute(value[index])
				if (!childIsSynchronous && isPromiseLike(result))
					return continueAsync(value, index, result, output, issues)

				const syncResult = result as ExecutionResult
				if (isFailure(syncResult)) {
					const appended = appendChildIssues(syncResult, index, issues)
					issues = appended.issues
					if (appended.hasInternal || !collectAllIssues)
						return failure(issues)
				}
				else {
					output[index] = syncResult.value
				}
			}

			return issues == null ? success(output) : failure(issues)
		}, operationMode)
	},
})
