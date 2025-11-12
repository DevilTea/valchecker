import type { TStepPluginDef } from '../core'
import { runtimeExecutionStepDefMarker } from '../shared'
import * as _all from '../steps'

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
