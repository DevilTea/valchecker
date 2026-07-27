import type { AnyExecutionIssue, OperationMode, TStepPluginDef } from '../../core'

/**
 * Runtime half of the shorthand mechanism. A provider claims the branch values
 * it recognizes and names the initial step that validates them, so `union`
 * resolves a shorthand through whichever providers are registered instead of
 * hardcoding the built-in three. Register one with
 * `declareStepPluginCapability(plugin, unionShorthandCapability, provider)`.
 *
 * Providers are consulted in registration order and the first match wins, so
 * two providers claiming the same value resolve to whichever was registered
 * first. Keep `matches` mutually exclusive when that matters.
 */
export interface UnionShorthandProvider {
	/** Whether this provider recognizes `branch` as one of its shorthand values. */
	matches: (branch: unknown) => boolean
	/** Initial step method that validates a matched branch. */
	method: string
	/** Parameters for that method; defaults to none. */
	toParams?: (branch: unknown) => readonly unknown[]
}

export const unionShorthandCapability: unique symbol = Symbol.for('valchecker.unionShorthand')

/**
 * Type-state-only half of the shorthand mechanism, declared under a provider
 * PluginDef's `Capabilities` slot so it can never be mistaken for a step
 * method — as a top-level field it leaked into `RegisteredStepMethodName`.
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
> = Registered extends { Capabilities: { UnionShorthand: infer Def extends TUnionShorthandDef } }
	? Def
	: never

export type UnionShorthandInput<
	Registered extends TStepPluginDef,
> = RegisteredUnionShorthandDef<Registered>['input']

/**
 * A provider contributes to a branch only when the branch satisfies the
 * provider's declared `input`. For the three built-in providers this is exactly
 * the predicate `normalizeBranch` applies at runtime: `null` and `undefined`
 * reach their own initial schemas, and every other accepted value reaches
 * `literal`. (`normalizeBranch` hardcodes those three rather than dispatching
 * through registered providers, so a third-party provider's `input` widens this
 * type without being reachable at runtime — a separate, pre-existing gap.)
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
