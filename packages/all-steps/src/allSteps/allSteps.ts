import * as _all from '@valchecker/internal'

type _All = typeof _all

export type AllSteps = _all.ValueOf<{
	[K in keyof _All]: _All[K] extends { '~def'?: _all.TStepPluginDef } ? _All[K] : never
}>[]

/* @__NO_SIDE_EFFECTS__ */
export const allSteps: AllSteps = Object.values(_all as any)
	.filter(step => (step && typeof step === 'object' && (step as any)[_all.runtimeExecutionStepDefMarker])) as AllSteps
