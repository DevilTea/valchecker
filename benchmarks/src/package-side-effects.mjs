import { relative, sep } from 'node:path'
import picomatch from 'picomatch'

function normalizedRelative(packageRoot, modulePath) {
	return relative(packageRoot, modulePath)
		.split(sep)
		.join('/')
}

function matcherFor(pattern) {
	// webpack's package `sideEffects` field treats a bare file/glob name as matching at
	// any depth. Prefixing it keeps that consumer-facing meaning while picomatch handles
	// the actual glob grammar for precise future exceptions.
	return picomatch(pattern.includes('/') ? pattern : `**/${pattern}`, { dot: true })
}

/**
 * Convert one package's published `sideEffects` declaration into Rollup's per-module
 * `moduleSideEffects` answer. Missing metadata is conservative: the module may have
 * side effects. A malformed declaration is not silently upgraded to an optimization.
 */
export function moduleSideEffectsFromManifest(manifest, packageRoot, modulePath) {
	const declaration = manifest.sideEffects
	if (declaration === false)
		return false
	if (declaration === true || declaration === undefined)
		return true

	const patterns = typeof declaration === 'string'
		? [declaration]
		: Array.isArray(declaration) && declaration.every(value => typeof value === 'string')
			? declaration
			: null
	if (patterns == null)
		throw new TypeError(`${String(manifest.name ?? 'package')} has an invalid sideEffects declaration`)

	const path = normalizedRelative(packageRoot, modulePath)
	return patterns.some(pattern => matcherFor(pattern)(path))
}
