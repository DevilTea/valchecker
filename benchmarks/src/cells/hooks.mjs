/**
 * The three resolution rules that let one `<name>.bench.ts` be read by two drivers.
 *
 * `vitest bench` runs a bench file as written: TypeScript, importing the library from
 * `'../..'` — the internal package's source entry — and `describe`/`bench` from
 * `vitest`. This gate runs the same file in a plain Node process, and needs it to
 * measure a **built** `packages/valchecker/dist/index.mjs` instead, because that is the
 * artefact the comparison is between. Rewriting the imports would mean a second copy of
 * every bench file; rewriting the *resolution* means there is only ever one.
 *
 * 1. `vitest` → `./vitest-shim.mjs`. No test runner is loaded.
 * 2. A relative specifier that names a package's `src` directory or its `src/index.ts`
 *    → the dist build under test. That is the `'../..'` every bench file already has.
 *    It is matched on the *specifier*, before Node's own resolution, because Node's ESM
 *    resolver rejects a directory import outright.
 * 3. A relative specifier with no extension → the `.ts` file beside it, or its
 *    `index.ts`. Node's ESM resolver requires a full specifier and TypeScript source
 *    does not write one; this is the same extension search
 *    `scripts/impact-selection.ts` performs when it walks the import graph.
 *
 * Rule 2 is what keeps the measured artefact honest, and rule 3 is deliberately narrow
 * for the same reason: with the package entry redirected, the only source files a bench
 * file may still reach are the `stepBench` helper and whatever *it* imports, which is
 * nothing. `scripts/check-bench-cells.ts` enforces that import allow-list statically,
 * so a bench file cannot start pulling the TypeScript source into a process that is
 * supposed to be measuring the bundle.
 *
 * Type stripping is Node's own (`>=22.18` by default, and the workflows run 24), so no
 * loader compiles anything here. A bench file must therefore write `import type` for a
 * type-only import, which is this repository's convention anyway.
 */

import { existsSync } from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const shim = new URL('./vitest-shim.mjs', import.meta.url).href
const packageEntry = /\/packages\/(?:internal|valchecker)\/src(?:\/index\.ts)?$/

function distUrl() {
	const url = process.env.VALCHECKER_DIST_URL
	if (!url) {
		throw new Error(
			'VALCHECKER_DIST_URL is not set. The cell drivers measure a built '
			+ '`packages/valchecker/dist/index.mjs`; run `pnpm build`, or point it at the build under test.',
		)
	}
	return url
}

function resolveExtension(url) {
	if (/\.(?:m|c)?[jt]sx?$/.test(url) || /\.json$/.test(url))
		return null
	for (const candidate of [`${url}.ts`, `${url}.tsx`, `${url}/index.ts`]) {
		if (existsSync(fileURLToPath(candidate)))
			return candidate
	}
	return null
}

export async function resolve(specifier, context, next) {
	if (specifier === 'vitest')
		return { url: shim, shortCircuit: true, format: 'module' }

	if (specifier.startsWith('.') && context.parentURL != null) {
		const target = new URL(specifier, context.parentURL).href.replace(/\/$/, '')
		if (packageEntry.test(target))
			return { url: distUrl(), shortCircuit: true, format: 'module' }
		const withExtension = resolveExtension(target)
		if (withExtension != null)
			return { url: withExtension, shortCircuit: true, format: 'module' }
	}

	return next(specifier, context)
}
