import type { AnyExecutionIssue, OperationMode, TStepPluginDef } from '../../core'

/**
 * Type-state-only capability carried by a provider PluginDef. These fields do
 * not match DefineStepMethod, so they never become runtime Valchecker methods.
 */
export interface TUnionShorthandDef {
	branch: unknown
	input: unknown
	operationMode: OperationMode
	output: unknown
	issue: AnyExecutionIssue
}

type RegisteredUnionShorthandDef<
	Registered extends TStepPluginDef,
> = Registered extends { UnionShorthand: infer Def extends TUnionShorthandDef }
	? Def
	: never

export type UnionShorthandInput<
	Registered extends TStepPluginDef,
> = RegisteredUnionShorthandDef<Registered>['input']

/**
 * A provider contributes to a branch only when the branch satisfies the
 * provider's declared `input`, which is the same predicate `normalizeBranch`
 * applies at runtime: `null` and `undefined` reach their own initial schemas,
 * and every other accepted value reaches `literal`.
 *
 * The filter lives here rather than in each provider so applicability is
 * decided once, from `input`, instead of depending on every provider
 * remembering to gate its own `output` and `issue` on `this['branch']`.
 * Without it, a provider that declares a fixed output (as `null` and
 * `undefined` do) widens EVERY shorthand branch with its output and issue.
 */
type ApplyUnionShorthand<Def, Branch> = Def extends TUnionShorthandDef
	? Branch extends Def['input']
		? Def & { branch: Branch } extends infer Applied extends TUnionShorthandDef
			? {
					operationMode: Applied['operationMode']
					output: Applied['output']
					issue: Applied['issue']
				}
			: never
		: never
	: never

export type ResolveUnionShorthand<
	Registered extends TStepPluginDef,
	Branch,
> = ApplyUnionShorthand<RegisteredUnionShorthandDef<Registered>, Branch>
