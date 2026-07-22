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

	for (let index = 0; index < runtimeSteps.length; index++) {
		if (!Object.hasOwn(runtimeSteps[index]!, 'prototype'))
			return false
	}
	return true
}
