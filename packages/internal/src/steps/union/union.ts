import type { IsEqual } from 'type-fest'
import type { AnyExecutionIssue, DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionResult, InferIssue, InferOperationMode, InferOutput, InferRegisteredStepPluginDefs, Next, OperationMode, TStepPluginDef, Use, Valchecker } from '../../core'
import { implStepPlugin } from '../../core'
import { isPromiseLike } from '../../shared'
import type { ResolveUnionShorthand, UnionShorthandInput } from './union-shorthand'

interface UnionStepMethodContext {
	createInitialSchema: (method: string, params?: readonly unknown[]) => Use<Valchecker>
}

declare namespace Internal {
	type Branch<This extends Valchecker> =
		| Use<Valchecker>
		| UnionShorthandInput<InferRegisteredStepPluginDefs<This>>

	type Branches<This extends Valchecker> = readonly [
		Branch<This>,
		...Branch<This>[],
	]

	type ResolveBranch<This extends Valchecker, Branch> = Branch extends Use<Valchecker>
		? {
				operationMode: InferOperationMode<Branch>
				output: InferOutput<Branch>
				issue: InferIssue<Branch>
			}
		: ResolveUnionShorthand<InferRegisteredStepPluginDefs<This>, Branch>

	type Resolved<This extends Valchecker, B extends Branches<This>> = ResolveBranch<This, B[number]>

	type OpMode<This extends Valchecker, B extends Branches<This>> = Resolved<This, B>['operationMode'] extends infer M extends OperationMode
		? IsEqual<M, 'sync'> extends true
			? 'sync'
			: 'maybe-async'
		: never

	type Output<This extends Valchecker, B extends Branches<This>> = Resolved<This, B>['output']
	type Issue<This extends Valchecker, B extends Branches<This>> = Resolved<This, B>['issue']
}

type Meta = DefineStepMethodMeta<{
	Name: 'union'
	ExpectedCurrentValchecker: DefineExpectedValchecker
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * Checks that the value passes at least one branch and returns the first
	 * successful branch output. Failed branch issues receive a non-data
	 * `{ type: 'union', branchIndex }` context entry. Internal failures stop
	 * branch evaluation immediately.
	 *
	 * Registered `literal`, `null`, and `undefined` initial-schema steps also
	 * enable their corresponding shorthand branch values.
	 */
	union: DefineStepMethod<
		Meta,
		this['CurrentValchecker'] extends infer This extends Meta['ExpectedCurrentValchecker']
			? <const B extends Internal.Branches<This>>(
				branches: B,
			) => Next<{
				operationMode: Internal.OpMode<This, B>
				output: Internal.Output<This, B>
				issue: Internal.Issue<This, B>
			}, This>
			: never
	>
}

function isValcheckerSchema(value: unknown): value is Use<Valchecker> {
	return (
		typeof value === 'function'
		|| (typeof value === 'object' && value !== null)
	) && typeof Reflect.get(value, '~execute') === 'function'
}

function isLiteralShorthand(value: unknown): value is bigint | boolean | number | string | symbol {
	const type = typeof value
	return type === 'bigint'
		|| type === 'boolean'
		|| type === 'number'
		|| type === 'string'
		|| type === 'symbol'
}

function normalizeBranch(
	branch: unknown,
	index: number,
	context: UnionStepMethodContext,
): Use<Valchecker> {
	if (isValcheckerSchema(branch))
		return branch
	if (branch === null)
		return context.createInitialSchema('null')
	if (branch === undefined)
		return context.createInitialSchema('undefined')
	if (isLiteralShorthand(branch))
		return context.createInitialSchema('literal', [branch])
	throw new TypeError(`Invalid union branch at index ${index}.`)
}

/* @__NO_SIDE_EFFECTS__ */
export const union = implStepPlugin<PluginDef>({
	union: ({
		utils: { addSuccessStep, appendIssueContext, failure, isFailure },
		params: [branches],
		context,
	}) => {
		if (!Array.isArray(branches) || branches.length === 0)
			throw new TypeError('union() requires at least one branch.')

		const branchExecutors = new Array(branches.length)
		let operationMode: OperationMode = 'sync'
		for (let index = 0; index < branches.length; index++) {
			if (!Object.hasOwn(branches, index))
				throw new TypeError(`union() branch at index ${index} is missing.`)
			const branch = normalizeBranch(branches[index], index, context)
			branchExecutors[index] = branch['~execute']
			if (branch['~core']?.operationMode !== 'sync')
				operationMode = 'maybe-async'
		}
		const len = branchExecutors.length
		const branchesAreSynchronous = operationMode === 'sync'

		addSuccessStep((value) => {
			let issues: AnyExecutionIssue[] | undefined

			for (let i = 0; i < len; i++) {
				const branchResult = branchExecutors[i]!(value)
				if (!branchesAreSynchronous && isPromiseLike(branchResult)) {
					return (async () => {
						for (let j = i; j < len; j++) {
							const result = j === i
								? await branchResult
								: await branchExecutors[j]!(value)
							if (!isFailure(result))
								return result

							const collected = issues ??= []
							const branchStart = collected.length
							let hasInternal = false
							for (const issue of result.issues) {
								if (issue.category === 'internal')
									hasInternal = true
								collected.push(appendIssueContext(issue, {
									type: 'union',
									branchIndex: j,
								}))
							}
							if (hasInternal)
								return failure(collected.slice(branchStart))
						}
						return failure(issues!)
					})()
				}

				const syncBranchResult = branchResult as ExecutionResult
				if (!isFailure(syncBranchResult))
					return syncBranchResult

				const collected = issues ??= []
				const branchStart = collected.length
				let hasInternal = false
				for (const issue of syncBranchResult.issues) {
					if (issue.category === 'internal')
						hasInternal = true
					collected.push(appendIssueContext(issue, {
						type: 'union',
						branchIndex: i,
					}))
				}
				if (hasInternal)
					return failure(collected.slice(branchStart))
			}

			return failure(issues!)
		}, operationMode)
	},
})
