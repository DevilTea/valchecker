/**
 * The version of the build an adapter actually loaded.
 *
 * Every adapter used to report a source literal — `'3.25.76'`, `'1.4.2'`,
 * `'workspace'` — which made two guards meaningless. `run.mjs` compares each cell
 * worker's reported version to catch a run that measured two builds of one library,
 * and `merge` compares them across shards for the same reason; both were comparing
 * constants that were equal by construction. A literal also cannot be traced: the
 * coverage gate's allowlist reasons cite the pinned versions as the evidence they were
 * verified against, and a report that states the version it measured is what makes
 * that citation checkable.
 *
 * The version is read from the nearest `package.json` above the resolved entry point
 * rather than from the module's own exports, because none of these packages exports
 * one. `benchmarks/` is installed with `--ignore-workspace --lockfile=false`, so the
 * competitor entries resolve inside `benchmarks/node_modules`, where the alias
 * directory (`zod3`) holds the real package manifest (`"name": "zod"`) — which is why
 * the name is not checked, only the presence of a version. A nested manifest that
 * carries only `{"type": "module"}` is skipped for the same reason.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The version of the package containing `moduleUrl`. */
export function versionOfModule(moduleUrl) {
	let directory = dirname(fileURLToPath(moduleUrl))
	for (;;) {
		const manifestPath = join(directory, 'package.json')
		if (existsSync(manifestPath)) {
			const version = JSON.parse(readFileSync(manifestPath, 'utf8')).version
			if (typeof version === 'string' && version.length > 0)
				return version
		}
		const parent = dirname(directory)
		if (parent === directory)
			throw new Error(`No package.json with a version above ${fileURLToPath(moduleUrl)}`)
		directory = parent
	}
}

/** The installed version of a bare specifier, resolved the way the adapter imports it. */
export function installedVersion(specifier) {
	return versionOfModule(import.meta.resolve(specifier))
}
