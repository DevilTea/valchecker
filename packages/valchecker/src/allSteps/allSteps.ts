import type { TStepPluginDef } from 'valchecker'
import { runtimeExecutionStepDefMarker } from 'valchecker'
import * as _all from 'valchecker'

type AllSteps = typeof _all extends Record<string, infer Step extends { readonly '~def'?: TStepPluginDef }>
	? Step[]
	: never

/* @__NO_SIDE_EFFECTS__ */
export const allSteps = Object.values(_all as any)
	.filter(
		step => (
			step
			&& typeof step === 'object'
			&& (step as any)[runtimeExecutionStepDefMarker]
		) === true,
	) as AllSteps
