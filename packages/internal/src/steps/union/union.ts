import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferAsync, InferIssue, InferOutput, Next, TStepPluginDef, Use, Valchecker } from '../../core'
import { implStepPlugin } from '../../core'

declare namespace Internal {

	type Branches = [Use<Valchecker>, ...Use<Valchecker>[]]

	type Async<B extends Branches> = (B[number] extends infer S
		? S extends Use<Valchecker>
			? InferAsync<S>
			: never
		: never) extends false ? false : true

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
						async: Internal.Async<B>
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
		addSuccessStep((value) => {
			// Optimized: Direct processing without Pipe overhead
			const issues: ExecutionIssue[] = []
			const len = branches.length

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
				const branchResult = branches[i]!['~execute'](value)

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
						const jBranch = branches[j]!
						chain = chain.then((result) => {
							if (result.success)
								return result
							return Promise.resolve(jBranch['~execute'](value))
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
