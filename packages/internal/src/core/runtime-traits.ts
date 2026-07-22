import type { StepPluginImpl, Valchecker } from './types'

const identityRuntimeStepPlugins = new WeakSet<object>()

export function markIdentityRuntimeStepPlugin<Plugin extends StepPluginImpl<any>>(
	plugin: Plugin,
): Plugin {
	identityRuntimeStepPlugins.add(plugin)
	return plugin
}

export function isIdentityRuntimeStepPlugin(plugin: StepPluginImpl<any>): boolean {
	return identityRuntimeStepPlugins.has(plugin)
}

export function hasIdentityOnlyRuntimeSteps(schema: Valchecker): boolean {
	const runtimeSteps = schema['~core']?.runtimeSteps
	if (runtimeSteps == null || runtimeSteps.length === 0)
		return false

	// Phase G preserves arrow-function call semantics for every runtime step.
	// Trusted identity wrappers carry one unused optional parameter, so their
	// Function.length is 2; every normal wrapper has length 1. This encoding is
	// intentionally private and remains subject to the final performance gate.
	for (let index = 0; index < runtimeSteps.length; index++) {
		if (runtimeSteps[index]!.length !== 2)
			return false
	}
	return true
}
