import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferIssue, InferOperationMode, InferOutput, Next, OperationMode, TStepPluginDef, Use, Valchecker } from '../../core'
import type { IsEqual, UnionToIntersection } from '../../shared'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Branches = [Use<Valchecker>, ...Use<Valchecker>[]]

	export type OpMode<B extends Branches> = (
		B[number] extends infer S
			? S extends Use<Valchecker>
				? InferOperationMode<S>
				: never
			: never
	) extends infer M extends OperationMode
		// Because intersection may short-circuit, if there is any mixed mode or 'maybe-async', result is 'maybe-async'
		// If all branches are sync, result is sync
		? IsEqual<M, 'sync'> extends true
			? 'sync'
			// If any branch is async, result is async
			: IsEqual<M, 'async'> extends true
				? 'async'
				// Otherwise, result is maybe-async
				: 'maybe-async'
		: never

	export type Output<B extends Branches> = UnionToIntersection<B[number] extends infer S
		? S extends Use<Valchecker>
			? InferOutput<S>
			: never
		: never>

	export type Issue<B extends Branches> = B[number] extends infer S
		? S extends Use<Valchecker>
			? InferIssue<S>
			: never
		: never
}

type Meta = DefineStepMethodMeta<{
	Name: 'intersection'
	ExpectedThis: DefineExpectedValchecker
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value passes all of the provided branches.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, intersection, string, min } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [intersection, string, min] })
	 * const schema = v.intersection([v.string(), v.string().min(5)])
	 * const result = schema.execute('hello')
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * - Issues from the branches.
	 */
	intersection: DefineStepMethod<
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
export const intersection = implStepPlugin<PluginDef>({
	intersection: ({
		utils: { addSuccessStep, success, failure, isFailure },
		params: [branches],
	}) => {
		// Pre-compute execute functions to avoid proxy access in loop
		const branchExecutors = branches.map(b => b['~execute'])
		const len = branches.length

		addSuccessStep((value) => {
			// Optimized: Direct processing without Pipe overhead
			const issues: ExecutionIssue[] = []
			let isInvalid = false

			const processBranchResult = (result: ExecutionResult) => {
				if (isFailure(result)) {
					// Optimize: Avoid spread by using direct loop
					for (const issue of result.issues!) {
						issues.push(issue)
					}
					isInvalid = true
				}
			}

			// Process branches synchronously until we hit async or failure
			let isAsync = false
			for (let i = 0; i < len; i++) {
				if (isInvalid)
					break
				if (isAsync) {
					// Already in async mode, skip
					continue
				}

				const branchResult = branchExecutors[i]!(value)

				if (branchResult instanceof Promise) {
					isAsync = true
					// Hit async, chain remaining branches
					let chain = branchResult.then((r) => {
						processBranchResult(r)
						return isInvalid
					})

					for (let j = i + 1; j < len; j++) {
						const jExecutor = branchExecutors[j]!
						chain = chain.then((invalid) => {
							if (invalid)
								return true
							return Promise.resolve(jExecutor(value))
								.then((r) => {
									processBranchResult(r)
									return isInvalid
								})
						})
					}

					return chain.then(() =>
						(isInvalid || issues.length > 0) ? failure(issues) : success(value),
					)
				}

				processBranchResult(branchResult)
			}

			return (isInvalid || issues.length > 0) ? failure(issues) : success(value)
		})
	},
})
