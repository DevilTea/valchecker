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

	// Phase G preserves arrow wrappers. Trusted identity steps carry one unused
	// optional parameter, giving them Function.length === 2; normal wrappers have
	// length 1. The encoding is private and accepted only if final benchmarks pass.
	for (let index = 0; index < runtimeSteps.length; index++) {
		if (runtimeSteps[index]!.length !== 2)
			return false
	}
	return true
}
