import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferAsync, InferIssue, InferOutput, Next, TStepPluginDef, Use, Valchecker } from '../../core'
import type { UnionToIntersection } from '../../shared'
import { implStepPlugin } from '../../core'

declare namespace Internal {
	export type Branches = [Use<Valchecker>, ...Use<Valchecker>[]]

	export type Async<B extends Branches> = (B[number] extends infer S
		? S extends Use<Valchecker>
			? InferAsync<S>
			: never
		: never) extends false ? false : true

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
export const intersection = implStepPlugin<PluginDef>({
	intersection: ({
		utils: { addSuccessStep, success, failure, isFailure },
		params: [branches],
	}) => {
		addSuccessStep((value) => {
			// Optimized: Direct processing without Pipe overhead
			const issues: ExecutionIssue[] = []
			const len = branches.length
			let isInvalid = false

			const processBranchResult = (result: ExecutionResult) => {
				if (isFailure(result)) {
					// Optimize: Avoid spread by using direct loop
					for (const issue of result.issues) {
						issues.push(issue)
					}
					isInvalid = true
				}
			}

			// Process branches synchronously until we hit async or failure
			for (let i = 0; i < len; i++) {
				if (isInvalid)
					break

				const branchResult = branches[i]['~execute'](value)

				if (branchResult instanceof Promise) {
					// Hit async, chain remaining branches
					let chain = branchResult.then((r) => {
						processBranchResult(r)
						return isInvalid
					})

					for (let j = i + 1; j < len; j++) {
						const jBranch = branches[j]
						chain = chain.then((invalid) => {
							if (invalid)
								return true
							const jResult = jBranch['~execute'](value)
							return jResult instanceof Promise
								? jResult.then((r) => {
										processBranchResult(r)
										return isInvalid
									})
								: (processBranchResult(jResult), isInvalid)
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
