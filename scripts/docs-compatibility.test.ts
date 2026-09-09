import type { NarrativePage } from '../docs/_meta/pages'
import { describe, expect, it } from 'vitest'
import {
	compatibilityArtifactPaths,
	composeDocsCompatibility,
	staleCompatibilityOutputs,
} from './docs-compatibility'
import { objectTree } from './source-tree'

const pages: NarrativePage[] = [
	{
		id: 'quick-start',
		path: 'docs/getting-started/quick-start.md',
		section: 'getting-started',
		order: 10,
		title: 'Quick Start',
		archetype: 'tutorial',
	},
	{
		id: 'structured-data',
		path: 'docs/guides-recipes/structured-data.md',
		section: 'guides-recipes',
		order: 10,
		title: 'Structured Data',
		archetype: 'recipe',
	},
]

const entries = [
	{
		from: '/guide/quick-start',
		disposition: 'migrated' as const,
		targets: ['quick-start'],
		redirectTo: 'quick-start',
	},
	{
		from: '/examples/basic-validation',
		disposition: 'absorbed' as const,
		targets: ['quick-start', 'structured-data'],
		redirectTo: 'quick-start',
	},
]

function onlyProblem(overrides: typeof entries): string {
	const { outputs, problems } = composeDocsCompatibility(pages, overrides)
	expect(outputs.size)
		.toBe(0)
	expect(problems)
		.toHaveLength(1)
	return problems[0]!
}

describe('documentation compatibility routes', () => {
	it('generates an old-route page from a canonical page id without copying the canonical URL into metadata', () => {
		const { outputs, problems } = composeDocsCompatibility(pages, entries)
		expect(problems)
			.toEqual([])
		expect(compatibilityArtifactPaths(entries))
			.toEqual(['docs/guide/quick-start.md', 'docs/examples/basic-validation.md'])
		expect(outputs.get('docs/guide/quick-start.md'))
			.toContain('content: "0; url=../getting-started/quick-start"')
		expect(outputs.get('docs/guide/quick-start.md'))
			.toContain('[Quick Start](/getting-started/quick-start)')
	})

	it('fails closed when a target page id does not exist', () => {
		expect(onlyProblem([
			{ ...entries[0]!, targets: ['missing'], redirectTo: 'missing' },
			entries[1]!,
		]))
			.toContain('unknown canonical page id `missing`')
	})

	it('rejects a route that collides with a canonical narrative route', () => {
		expect(onlyProblem([
			{ ...entries[0]!, from: '/getting-started/quick-start' },
			entries[1]!,
		]))
			.toContain('collides with a canonical narrative route')
	})

	it('rejects duplicate legacy routes', () => {
		expect(onlyProblem([
			entries[0]!,
			{ ...entries[1]!, from: entries[0]!.from },
		]))
			.toContain('is declared more than once')
	})

	it('requires the redirect target to be one of the recorded content destinations', () => {
		expect(onlyProblem([
			{ ...entries[0]!, redirectTo: 'structured-data' },
			entries[1]!,
		]))
			.toContain('is not one of its recorded content destinations')
	})

	it('compares generated artifacts independent of checkout line endings', () => {
		const { outputs } = composeDocsCompatibility(pages, entries)
		const files = Object.fromEntries([...outputs].map(([file, text]) => [file, text.replaceAll('\n', '\r\n')]))
		expect(staleCompatibilityOutputs(objectTree(files), outputs))
			.toEqual([])
		files['docs/guide/quick-start.md'] += 'hand edit\r\n'
		expect(staleCompatibilityOutputs(objectTree(files), outputs))
			.toEqual(['docs/guide/quick-start.md'])
	})
})
