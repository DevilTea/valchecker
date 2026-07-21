import type { StepMethodUtils } from './types'

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

interface RuntimeExecutionEffectsUtils {
	'~previousExecutionEffects': ExecutionEffects
	'~executionEffects': ExecutionEffects
}

const executionEffectsBySchema = new WeakMap<object, ExecutionEffects>()

function patchExecutionEffects(
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

export function setExecutionEffects(
	utils: StepMethodUtils<any, any, any, any>,
	effects: ExecutionEffects,
): void {
	const runtimeUtils = utils as StepMethodUtils<any, any, any, any> & RuntimeExecutionEffectsUtils
	runtimeUtils['~executionEffects'] = effects
}

export function preserveExecutionEffects(
	utils: StepMethodUtils<any, any, any, any>,
	patch: ExecutionEffectsPatch = {},
): void {
	const runtimeUtils = utils as StepMethodUtils<any, any, any, any> & RuntimeExecutionEffectsUtils
	runtimeUtils['~executionEffects'] = patchExecutionEffects(
		runtimeUtils['~previousExecutionEffects'],
		patch,
	)
}

export function getPreviousExecutionEffects(
	utils: StepMethodUtils<any, any, any, any>,
): ExecutionEffects {
	return (utils as StepMethodUtils<any, any, any, any> & RuntimeExecutionEffectsUtils)['~previousExecutionEffects']
}

export function registerExecutionEffects(
	schema: object,
	effects: ExecutionEffects,
): void {
	executionEffectsBySchema.set(schema, effects)
}

export function getExecutionEffects(schema: object): ExecutionEffects {
	return executionEffectsBySchema.get(schema) ?? conservativeExecutionEffects
}
