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

type ApplyUnionShorthand<Def, Branch> = Def extends TUnionShorthandDef
	? Def & { branch: Branch } extends infer Applied extends TUnionShorthandDef
		? {
			operationMode: Applied['operationMode']
			output: Applied['output']
			issue: Applied['issue']
		}
		: never
	: never

export type ResolveUnionShorthand<
	Registered extends TStepPluginDef,
	Branch,
> = ApplyUnionShorthand<RegisteredUnionShorthandDef<Registered>, Branch>
