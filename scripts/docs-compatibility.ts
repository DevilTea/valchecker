import type { LegacyPageDisposition } from '../docs/_meta/compatibility'
import type { NarrativePage } from '../docs/_meta/pages'
import type { SourceTree } from './source-tree'
import path from 'node:path'
import { legacyRouteCompatibility } from '../docs/_meta/compatibility'
import { narrativePages, narrativeRoute } from '../docs/_meta/pages'

export interface CompatibilityEntry {
	from: string
	disposition: LegacyPageDisposition
	targets: readonly string[]
	redirectTo: string
}

export interface DocsCompatibilityResult {
	outputs: Map<string, string>
	problems: string[]
}

function normalizeEol(text: string): string {
	return text.replaceAll('\r\n', '\n')
}

export function compatibilityArtifactPath(route: string): string {
	return `docs${route}.md`
}

export function compatibilityArtifactPaths(
	entries: readonly CompatibilityEntry[] = legacyRouteCompatibility,
): string[] {
	return entries.map(entry => compatibilityArtifactPath(entry.from))
}

function isCanonicalLegacyRoute(route: string): boolean {
	return route.startsWith('/')
		&& route !== '/'
		&& !route.endsWith('/')
		&& !route.endsWith('.md')
		&& !route.includes('?')
		&& !route.includes('#')
		&& !route.includes('//')
		&& path.posix.normalize(route) === route
}

function relativeRedirect(from: string, to: string): string {
	const relative = path.posix.relative(path.posix.dirname(from), to)
	return relative.startsWith('.') ? relative : `./${relative}`
}

function renderCompatibilityPage(
	entry: CompatibilityEntry,
	target: NarrativePage,
): string {
	const targetRoute = narrativeRoute(target)
	const refreshTarget = relativeRedirect(entry.from, targetRoute)
	return [
		'---',
		'layout: page',
		'head:',
		'  - - meta',
		'    - http-equiv: refresh',
		`      content: "0; url=${refreshTarget}"`,
		'  - - meta',
		'    - name: robots',
		'      content: noindex',
		'---',
		'<!-- Generated compatibility route. Do not edit it; `pnpm docs:compat` checks it and `pnpm docs:compat:update` rewrites it from `docs/_meta/compatibility.ts`. -->',
		'',
		'# Documentation moved',
		'',
		`This published route is preserved for compatibility. Continue to [${target.title}](${targetRoute}).`,
		'',
	].join('\n')
}

/**
 * Validate the compatibility inventory and compose every generated old-route artifact.
 *
 * The mapping targets canonical page ids rather than copied URLs, so a canonical route move stays
 * owned by `docs/_meta/pages.ts`. Any invalid mapping fails closed and produces no partial output.
 */
export function composeDocsCompatibility(
	pages: readonly NarrativePage[] = narrativePages,
	entries: readonly CompatibilityEntry[] = legacyRouteCompatibility,
): DocsCompatibilityResult {
	const problems: string[] = []
	const pagesById = new Map(pages.map(page => [page.id, page]))
	const canonicalRoutes = new Set(pages.map(narrativeRoute))
	const seenRoutes = new Set<string>()

	for (const entry of entries) {
		if (!isCanonicalLegacyRoute(entry.from))
			problems.push(`Legacy route \`${entry.from}\` must be a normalized absolute route without a trailing slash, query, fragment, or \`.md\`.`)
		if (seenRoutes.has(entry.from))
			problems.push(`Legacy route \`${entry.from}\` is declared more than once.`)
		seenRoutes.add(entry.from)
		if (canonicalRoutes.has(entry.from))
			problems.push(`Legacy route \`${entry.from}\` collides with a canonical narrative route.`)
		if (entry.targets.length === 0)
			problems.push(`Legacy route \`${entry.from}\` has no canonical content destination.`)
		const targetIds = new Set<string>()
		for (const targetId of entry.targets) {
			if (targetIds.has(targetId))
				problems.push(`Legacy route \`${entry.from}\` lists canonical target \`${targetId}\` more than once.`)
			targetIds.add(targetId)
			if (!pagesById.has(targetId))
				problems.push(`Legacy route \`${entry.from}\` references unknown canonical page id \`${targetId}\`.`)
		}
		if (!targetIds.has(entry.redirectTo))
			problems.push(`Legacy route \`${entry.from}\` redirects to \`${entry.redirectTo}\`, which is not one of its recorded content destinations.`)
	}

	if (problems.length > 0)
		return { outputs: new Map(), problems }

	const outputs = new Map<string, string>()
	for (const entry of entries) {
		const target = pagesById.get(entry.redirectTo)!
		outputs.set(compatibilityArtifactPath(entry.from), renderCompatibilityPage(entry, target))
	}
	return { outputs, problems }
}

export function staleCompatibilityOutputs(
	tree: SourceTree,
	outputs: ReadonlyMap<string, string>,
): string[] {
	const stale: string[] = []
	for (const [file, expected] of outputs) {
		const actual = tree.read(file)
		if (actual == null || normalizeEol(actual) !== normalizeEol(expected))
			stale.push(file)
	}
	return stale
}
