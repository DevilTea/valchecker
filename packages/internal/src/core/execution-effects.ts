import type { StepPluginImpl } from './types'

export type OutputIdentityEffect = 'identity-preserving' | 'may-transform'
export type ParentTraversalEffect = 'direct-safe' | 'snapshot-required'

export interface FreshOrdinaryObjectOutput {
	readonly kind: 'fresh-ordinary-object'
	readonly keys: readonly PropertyKey[]
}

export interface ExecutionEffects {
	readonly identity: OutputIdentityEffect
	readonly parentTraversal: ParentTraversalEffect
	readonly structuralOutput: FreshOrdinaryObjectOutput | null
}

export interface ExecutionEffectsPatch {
	readonly identity?: OutputIdentityEffect | undefined
	readonly parentTraversal?: ParentTraversalEffect | undefined
	readonly structuralOutput?: FreshOrdinaryObjectOutput | null | undefined
}

export const PRESERVE_EXECUTION_EFFECTS = 0
export const CONSERVATIVE_EXECUTION_EFFECTS = 1

export type ExecutionEffectsResolver =
	| typeof PRESERVE_EXECUTION_EFFECTS
	| typeof CONSERVATIVE_EXECUTION_EFFECTS
	| ((
		previous: ExecutionEffects,
		params: readonly unknown[],
		stepMetadata: unknown,
	) => ExecutionEffects)

export const neutralExecutionEffects: ExecutionEffects = {
	identity: 'identity-preserving',
	parentTraversal: 'direct-safe',
	structuralOutput: null,
}

export const conservativeExecutionEffects: ExecutionEffects = {
	identity: 'may-transform',
	parentTraversal: 'snapshot-required',
	structuralOutput: null,
}

export const executionEffectsKey = Symbol('valchecker.executionEffects')

interface SchemaWithExecutionEffects {
	readonly [executionEffectsKey]?: ExecutionEffects | undefined
}

type ExecutionEffectsResolvers = Readonly<Record<PropertyKey, ExecutionEffectsResolver>>
const executionEffectsResolversByPlugin = new WeakMap<object, ExecutionEffectsResolvers>()

export function withExecutionEffects<Plugin extends StepPluginImpl<any>>(
	plugin: Plugin,
	resolvers: Partial<Record<keyof Plugin, ExecutionEffectsResolver>>,
): Plugin {
	executionEffectsResolversByPlugin.set(plugin, resolvers as ExecutionEffectsResolvers)
	return plugin
}

export function getStepPluginExecutionEffects(
	plugin: StepPluginImpl<any>,
): ExecutionEffectsResolvers | undefined {
	return executionEffectsResolversByPlugin.get(plugin)
}

export function preserveExecutionEffects(
	base: ExecutionEffects,
	patch: ExecutionEffectsPatch,
): ExecutionEffects {
	return {
		identity: patch.identity ?? base.identity,
		parentTraversal: patch.parentTraversal ?? base.parentTraversal,
		structuralOutput: Object.hasOwn(patch, 'structuralOutput')
			? patch.structuralOutput ?? null
			: base.structuralOutput,
	}
}

export function getExecutionEffects(schema: object): ExecutionEffects {
	return (schema as SchemaWithExecutionEffects)[executionEffectsKey] ?? conservativeExecutionEffects
}
