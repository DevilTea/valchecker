import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferAsync, InferIssue, InferOutput, Next, TStepPluginDef, Use, Valchecker } from '../../core'
import type { UnionToIntersection } from '../../shared'
import { implStepPlugin } from '../../core'
import { Pipe } from '../../shared'

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
			const pipe = new Pipe<void>()
			const issues: ExecutionIssue[] = []
			let isInvalid = false

			const processBranchResult = (result: ExecutionResult) => {
				if (isFailure(result)) {
					issues.push(...result.issues)
					isInvalid = true
				}
			}

			for (const branch of branches) {
				pipe.add(() => {
					if (isInvalid)
						return

					const branchResult = branch['~execute'](value)
					return branchResult instanceof Promise
						? branchResult.then(processBranchResult)
						: processBranchResult(branchResult)
				})
			}

			const processResult = () => (isInvalid || issues.length > 0) ? failure(issues) : success(value)
			const result = pipe.exec()
			return result instanceof Promise
				? result.then(processResult)
				: processResult()
		})
	},
})
