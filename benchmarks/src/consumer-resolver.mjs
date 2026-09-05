import { existsSync, readFileSync } from 'node:fs'
import { builtinModules, createRequire } from 'node:module'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { moduleSideEffectsFromManifest } from './package-side-effects.mjs'

const builtins = new Set([...builtinModules, ...builtinModules.map(name => `node:${name}`)])
const valcheckerPackages = new Set(['valchecker', '@valchecker/internal', '@valchecker/all-steps'])

function packageMetadata(modulePath) {
	let current = dirname(modulePath)
	while (true) {
		const manifestPath = join(current, 'package.json')
		if (existsSync(manifestPath)) {
			const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
			if (typeof manifest.name === 'string')
				return { root: current, manifest }
		}
		const parent = dirname(current)
		if (parent === current)
			return null
		current = parent
	}
}

function resolveFile(source, importer, packedConsumer) {
	if (isAbsolute(source))
		return source
	if (source.startsWith('.')) {
		if (importer == null || importer.startsWith('\0'))
			throw new Error(`Relative bundle import ${source} has no filesystem importer`)
		return createRequire(importer)
			.resolve(source)
	}
	if (valcheckerPackages.has(source)) {
		return importer != null && !importer.startsWith('\0')
			? createRequire(importer)
					.resolve(source)
			: packedConsumer.resolve(source)
	}
	if (importer != null && !importer.startsWith('\0')) {
		return createRequire(importer)
			.resolve(source)
	}

	// Keep the existing benchmark's ESM entry selection for competitors. Their scenarios
	// are context only; the Valchecker impact sides above always come from packed consumers.
	const url = import.meta.resolve(source)
	return url.startsWith('file:') ? fileURLToPath(url) : null
}

export function consumerResolver(entryCode, packedConsumer) {
	return {
		name: 'consumer-package-resolver',
		resolveId(source, importer) {
			if (source === 'virtual:entry')
				return '\0virtual:entry'
			if (builtins.has(source))
				return { id: source.startsWith('node:') ? source : `node:${source}`, external: true }
			const id = resolveFile(source, importer, packedConsumer)
			if (id == null)
				return null
			const metadata = packageMetadata(id)
			return {
				id: resolve(id),
				// No manifest means no consumer promise, so stay conservative. A package manifest
				// is authoritative when present; this is the D15 boundary the old resolver erased.
				moduleSideEffects: metadata == null
					? true
					: moduleSideEffectsFromManifest(metadata.manifest, metadata.root, id),
			}
		},
		load(id) {
			return id === '\0virtual:entry' ? entryCode : null
		},
	}
}
