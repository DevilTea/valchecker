import type { AnyExecutionIssue, DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferIssue, InferOperationMode, InferOutput, Next, StepOptions, TStepPluginDef, Use, Valchecker } from '../../core'
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
						options?: StepOptions<Meta['SelfIssue']>,
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
		params: [item, options],
	}) => {
		const operationMode = item['~core']?.operationMode === 'sync' ? 'sync' : 'maybe-async'
		const childIsSynchronous = operationMode === 'sync'
		addSuccessStep((value) => {
			if (Array.isArray(value) === false) {
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
			const execute = item['~execute']

			for (let i = 0; i < len; i++) {
				const result = execute(value[i])
				if (!childIsSynchronous && isPromiseLike(result)) {
					return (async () => {
						for (let j = i; j < len; j++) {
							const resolved = j === i ? await result : await execute(value[j])
							if (isFailure(resolved)) {
								let hasInternal = false
								const target = issues ??= []
								for (const issue of resolved.issues) {
									if (issue.category === 'internal')
										hasInternal = true
									target.push(prependIssuePath(issue, [j]))
								}
								if (hasInternal)
									return failure(target)
							}
							else {
								output[j] = resolved.value
							}
						}
						return issues == null ? success(output) : failure(issues)
					})()
				}

				const syncResult = result as ExecutionResult
				if (isFailure(syncResult)) {
					let hasInternal = false
					const target = issues ??= []
					for (const issue of syncResult.issues) {
						if (issue.category === 'internal')
							hasInternal = true
						target.push(prependIssuePath(issue, [i]))
					}
					if (hasInternal)
						return failure(target)
				}
				else {
					output[i] = syncResult.value
				}
			}

			return issues == null ? success(output) : failure(issues)
		}, operationMode)
	},
})
