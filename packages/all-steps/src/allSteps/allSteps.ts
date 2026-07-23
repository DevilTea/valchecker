import * as _all from '@valchecker/internal'

// Shared by value from @valchecker/internal so the discovery marker cannot drift
// from a second Symbol.for string and silently yield an empty collection.
const { runtimeExecutionStepDefMarker } = _all

type _All = typeof _all

export type AllSteps = _all.ValueOf<{
	[K in keyof _All]: _All[K] extends { '~def'?: _all.TStepPluginDef } ? _All[K] : never
}>[]

/* @__NO_SIDE_EFFECTS__ */
export const allSteps: AllSteps = Object.values(_all as any)
	.filter(step => (step && typeof step === 'object' && (step as any)[runtimeExecutionStepDefMarker])) as AllSteps
