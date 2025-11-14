import type { DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionIssue, ExecutionResult, InferAsync, InferIssue, InferOutput, Next, TStepPluginDef, Use, Valchecker } from '../../core'
import { implStepPlugin } from '../../core'
import { Pipe } from '../../shared'

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
			const pipe = new Pipe<void>()
			const issues: ExecutionIssue[] = []
			let isValid = false

			const processBranchResult = (result: ExecutionResult) => {
				if (isFailure(result)) {
					issues.push(...result.issues)
					return
				}
				isValid = true
			}

			for (const branch of branches) {
				pipe.add(() => {
					if (isValid)
						return

					const branchResult = branch['~execute'](value)
					return branchResult instanceof Promise
						? branchResult.then(processBranchResult)
						: processBranchResult(branchResult)
				})
			}

			const processResult = () => (isValid || issues.length === 0) ? success(value) : failure(issues)
			const result = pipe.exec()
			return result instanceof Promise
				? result.then(processResult)
				: processResult()
		})
	},
})
