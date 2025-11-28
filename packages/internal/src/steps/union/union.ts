import type { IsEqual } from 'type-fest'
import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferIssue, InferOperationMode, InferOutput, Next, OperationMode, TStepPluginDef, Use, Valchecker } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {

	type Branches = [Use<Valchecker>, ...Use<Valchecker>[]]

	type OpMode<B extends Branches> = (
		B[number] extends infer S
			? S extends Use<Valchecker>
				? InferOperationMode<S>
				: never
			: never
	) extends infer M extends OperationMode
		// Because union may short-circuit, if there is any mixed mode or 'maybe-async', result is 'maybe-async'
		// If all branches are sync, result is sync
		? IsEqual<M, 'sync'> extends true
			? 'sync'
			// If any branch is async, result is async
			: IsEqual<M, 'async'> extends true
				? 'async'
				// Otherwise, result is maybe-async
				: 'maybe-async'
		: never

	type Output<B extends Branches> = B[number] extends infer S
		? S extends Use<Valchecker>
			? InferOutput<S>
			: never
		: never

	type Issue<B extends Branches> = B[number] extends infer S
		? S extends Use<Valchecker>
			? InferIssue<S>
			: never
		: never
}

type Meta = DefineStepMethodMeta<{
	Name: 'union'
	ExpectedThis: DefineExpectedValchecker
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value passes at least one of the provided branches.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, string, number, union } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [string, number, union] })
	 * const schema = v.union([v.string(), v.number()])
	 * const result = schema.execute('hello')
	 * // result.value: 'hello'
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - Issues from the branches if none pass.
	 */
	union: DefineStepMethod<
		Meta,
		this['This'] extends Meta['ExpectedThis']
			?	<B extends [Use<Valchecker>, ...Use<Valchecker>[]]>(
					branches: B,
				) => Next<
					{
						operationMode: Internal.OpMode<B>
						output: Internal.Output<B>
						issue: Internal.Issue<B>
					},
					this['This']
				>
			:	never
	>
}

/* @__NO_SIDE_EFFECTS__ */
export const union = implStepPlugin<PluginDef>({
	union: ({
		utils: { addSuccessStep, success, failure, isFailure },
		params: [branches],
	}) => {
		// Pre-compute execute functions to avoid proxy access in loop
		const branchExecutors = branches.map(b => b['~execute'])
		const len = branches.length

		addSuccessStep((value) => {
			// Optimized: Direct processing without Pipe overhead
			const issues: ExecutionIssue[] = []

			const processBranchResult = (result: ExecutionResult) => {
				if (isFailure(result)) {
					// Optimize: Avoid spread by using direct loop
					for (const issue of result.issues!) {
						issues.push(issue)
					}
					return false
				}
				return true
			}

			// Try each branch synchronously until we hit async or find success
			let isAsync = false
			for (let i = 0; i < len; i++) {
				if (isAsync) {
					// Already in async mode, skip
					continue
				}
				const branchResult = branchExecutors[i]!(value)

				if (branchResult instanceof Promise) {
					isAsync = true
					// Hit async, chain remaining branches
					let chain = branchResult.then((r) => {
						if (processBranchResult(r)) {
							return { success: true }
						}
						return { success: false }
					})

					for (let j = i + 1; j < len; j++) {
						const jExecutor = branchExecutors[j]!
						chain = chain.then((result) => {
							if (result.success)
								return result
							return Promise.resolve(jExecutor(value))
								.then(r => ({
									success: processBranchResult(r),
								}))
						})
					}

					return chain.then(result =>
						(result.success || issues.length === 0) ? success(value) : failure(issues),
					)
				}

				if (processBranchResult(branchResult)) {
					return success(value)
				}
			}

			return issues.length === 0 ? success(value) : failure(issues)
		})
	},
})
