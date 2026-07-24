import type { IsEqual } from 'type-fest'
import type { AnyExecutionIssue, DefineExpectedValchecker, DefineStepMethod, DefineStepMethodMeta, ExecutionResult, InferExecutionContext, InferIssue, InferOperationMode, InferOutput, InferRegisteredStepPluginDefs, Next, OperationMode, TStepPluginDef, Use, Valchecker } from '../../core'
import type { TemplateLiteralPartDescriptor } from '../templateLiteral/template-literal-part'
import type { ResolveUnionShorthand, UnionShorthandInput } from './union-shorthand'
import { implStepPlugin } from '../../core'
import { isPromiseLike } from '../../shared'
import { declareLiteralMembers, getLiteralMembers } from '../literal/literal-members'
import { templateLiteralPartMarker } from '../templateLiteral/template-literal-part'

interface UnionStepMethodContext {
	createInitialSchema: (method: string, params?: readonly unknown[]) => Use<Valchecker>
}

declare namespace Internal {
	type Branch<This extends Valchecker>
		= | Use<Valchecker>
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

	// A union advertises a finite member set only when every branch does. A
	// schema branch contributes its own `literalMembers`; a literal shorthand
	// contributes itself; a `null`/`undefined` shorthand (or anything else)
	// contributes `undefined`, which collapses the whole union to non-finite.
	type BranchMembers<Branch> = Branch extends Use<Valchecker>
		? InferExecutionContext<Branch>['literalMembers']
		: Branch extends bigint | boolean | number | string | symbol
			? readonly [Branch]
			: undefined
	export type CombinedMembers<This extends Valchecker, B extends Branches<This>>
		= undefined extends BranchMembers<B[number]>
			? undefined
			: readonly Exclude<BranchMembers<B[number]>, undefined>[number][]
}

type Meta = DefineStepMethodMeta<{
	Name: 'union'
	ExpectedCurrentValchecker: DefineExpectedValchecker
}>

interface PluginDef extends TStepPluginDef {
	/**
	 * ### Description:
	 * Checks that the value passes at least one branch and returns the first
	 * successful branch output. Failed branch issues receive a non-data
	 * `{ type: 'union', branchIndex }` context entry. Internal failures stop
	 * branch evaluation immediately.
	 *
	 * Registered `literal`, `null`, and `undefined` initial-schema steps also
	 * enable their corresponding shorthand branch values.
	 *
	 * ---
	 *
	 * ### Example:
	 * ```ts
	 * import { createValchecker, number, string, union } from 'valchecker'
	 *
	 * const v = createValchecker({ steps: [union, string, number] })
	 * const schema = v.union([v.string(), v.number()])
	 * ```
	 *
	 * ---
	 *
	 * ### Issues:
	 * None. `union` owns no issue code; every failed branch's issues are aggregated with a `{ type: 'union', branchIndex }` context entry.
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
					literalMembers: Internal.CombinedMembers<This, B>
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
		utils: { addSuccessStep, appendIssueContext, failure, isFailure, setMetadata },
		params: [branches],
		context,
	}) => {
		if (!Array.isArray(branches) || branches.length === 0)
			throw new TypeError('union() requires at least one branch.')

		const branchExecutors: Use<Valchecker>['~execute'][] = Array.from({ length: branches.length })
		let operationMode: OperationMode = 'sync'
		// A union advertises finite members only when every branch does; a single
		// non-finite branch collapses the whole union to non-finite (undefined).
		let combinedMembers: unknown[] | undefined = []
		// Derive a `templateLiteral` part descriptor from the branches. Every
		// normalized branch (including literal/null/undefined shorthands) carries
		// its own descriptor when it is a supported part; if any branch lacks one
		// (e.g. a refined schema, or a symbol literal), the union is not a usable
		// template-literal part and no descriptor is attached.
		let templatePartMembers: TemplateLiteralPartDescriptor[] | undefined = []
		for (let index = 0; index < branches.length; index++) {
			if (!Object.hasOwn(branches, index))
				throw new TypeError(`union() branch at index ${index} is missing.`)
			const branch = normalizeBranch(branches[index], index, context)
			branchExecutors[index] = branch['~execute']
			if (branch['~core']?.operationMode !== 'sync')
				operationMode = 'maybe-async'
			const branchMembers = getLiteralMembers(branch)
			if (branchMembers == null)
				combinedMembers = undefined
			else if (combinedMembers != null)
				combinedMembers.push(...branchMembers)
			if (templatePartMembers !== undefined) {
				const descriptor = branch['~core']?.metadata?.[templateLiteralPartMarker] as TemplateLiteralPartDescriptor | undefined
				if (descriptor === undefined)
					templatePartMembers = undefined
				else
					templatePartMembers.push(descriptor)
			}
		}
		if (combinedMembers != null)
			declareLiteralMembers(setMetadata, combinedMembers)
		if (templatePartMembers !== undefined)
			setMetadata(templateLiteralPartMarker, { kind: 'union', members: templatePartMembers })
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
				// Deliberately duplicated per-file inline loop: V8 inlines this per-schema loop but not a shared cross-module helper. See architecture.md (extraction measured -12%/-13% on the failure hot path, 2026-07-22).
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
