import type { AnyExecutionIssue, OperationMode, TStepPluginDef } from '../../core'
import type { ValueOf } from '../../shared'

export interface UnionShorthandResult {
	operationMode: OperationMode
	output: unknown
	issue: AnyExecutionIssue
}

/**
 * Open type-level registry for union shorthand inputs. Provider steps augment
 * this interface and condition each entry on their own registered PluginDef.
 */
export interface UnionShorthandInputRegistry<
	Registered extends TStepPluginDef,
> { }

/**
 * Open type-level registry that resolves an enabled shorthand branch to the
 * same operation mode, output, and issue contract as its provider schema.
 */
export interface UnionShorthandResultRegistry<
	Registered extends TStepPluginDef,
	Branch,
> { }

export type UnionShorthandInput<
	Registered extends TStepPluginDef,
> = ValueOf<UnionShorthandInputRegistry<Registered>>

export type ResolveUnionShorthand<
	Registered extends TStepPluginDef,
	Branch,
> = ValueOf<UnionShorthandResultRegistry<Registered, Branch>> extends infer Result
	? Result extends UnionShorthandResult
		? Result
		: never
	: never
