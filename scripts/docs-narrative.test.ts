import type { NarrativePage } from '../docs/_meta/pages'
import { describe, expect, it } from 'vitest'
import { documentationSections } from '../docs/_meta/pages'
import { auditNarrativeDocs, parseNarrativePage } from './docs-narrative'
import { objectTree } from './source-tree'

const semanticRoot = 'packages/internal/src/core/example.ts'

const pages: NarrativePage[] = documentationSections.map(section => ({
	id: section.id,
	path: `docs/${section.id}/index.md`,
	section: section.id,
	order: 10,
	title: section.label,
	archetype: section.id === 'getting-started' ? 'tutorial' : 'concept',
}))

function pageText(page: NarrativePage): string {
	return [
		'---',
		`description: ${page.title} documentation.`,
		'relatedSources:',
		`  - ${semanticRoot}`,
		'---',
		`# ${page.title}`,
		'',
	].join('\n')
}

function files(overrides: Record<string, string> = {}): Record<string, string> {
	const result: Record<string, string> = {
		'docs/index.md': '# Landing\n',
		[semanticRoot]: 'export const example = true\n',
	}
	for (const page of pages)
		result[page.path] = pageText(page)
	return { ...result, ...overrides }
}

describe('narrative frontmatter', () => {
	it('parses only page-local metadata', () => {
		const parsed = parseNarrativePage([
			'---',
			'description: A source-backed concept page.',
			'relatedSources:',
			`  - ${semanticRoot}`,
			'relatedPackages:',
			'  - valchecker',
			'---',
			'# Example',
		].join('\n'))

		expect(parsed.problems)
			.toEqual([])
		expect(parsed.frontmatter)
			.toEqual({
				description: 'A source-backed concept page.',
				relatedSources: [semanticRoot],
				relatedPackages: ['valchecker'],
			})
	})

	it('rejects registry-owned metadata in page frontmatter', () => {
		const parsed = parseNarrativePage('---\nsection: concepts\n---\n# Example\n')
		expect(parsed.problems)
			.toEqual([
				'`section` is not narrative page-local metadata. Allowed fields: `description`, `relatedSources`, `relatedPackages`.',
			])
	})
})

describe('narrative documentation audit', () => {
	it('accepts the final canonical inventory with source-backed page metadata', () => {
		expect(auditNarrativeDocs(objectTree(files()), pages))
			.toEqual([])
	})

	it('ignores installed package Markdown under docs/node_modules', () => {
		expect(auditNarrativeDocs(objectTree(files({
			'docs/node_modules/vitepress/README.md': '# VitePress\n',
			'docs/node_modules/vitepress/template/index.md': '# Template\n',
		})), pages))
			.toEqual([])
	})

	it('excludes only exact generated compatibility paths from narrative ownership', () => {
		expect(auditNarrativeDocs(objectTree(files({
			'docs/guide/quick-start.md': '# Generated compatibility artifact\n',
		})), pages))
			.toEqual([])

		const problems = auditNarrativeDocs(objectTree(files({
			'docs/guide/unregistered.md': '# Legacy prose returned\n',
		})), pages)
		expect(problems)
			.toContain('Unregistered narrative page `docs/guide/unregistered.md` exists under `docs/`.')
	})

	it('rejects unregistered pages and canonical H1 drift', () => {
		const problems = auditNarrativeDocs(objectTree(files({
			[pages[0]!.path]: pageText(pages[0]!)
				.replace(`# ${pages[0]!.title}`, '# Wrong title'),
			'docs/core-concepts/stray.md': '# Stray\n',
		})), pages)
		expect(problems)
			.toContain(`\`${pages[0]!.path}\` must open with canonical H1 \`# ${pages[0]!.title}\`, found \`# Wrong title\`.`)
		expect(problems)
			.toContain('Unregistered narrative page `docs/core-concepts/stray.md` exists under `docs/`.')
	})

	it('requires source-backed metadata for every canonical narrative page', () => {
		const withoutMetadata = auditNarrativeDocs(objectTree(files({
			[pages[0]!.path]: `# ${pages[0]!.title}\n`,
		})), pages)
		expect(withoutMetadata)
			.toContain(`\`${pages[0]!.path}\` has no narrative frontmatter. Narrative pages require \`description\` and non-empty \`relatedSources\`.`)

		const missingSource = auditNarrativeDocs(objectTree(files({
			[semanticRoot]: '',
			[pages[0]!.path]: [
				'---',
				'description: Final page.',
				'relatedSources:',
				'  - packages/internal/src/core/missing.ts',
				'---',
				`# ${pages[0]!.title}`,
			].join('\n'),
		})), pages)
		expect(missingSource)
			.toContain(`\`${pages[0]!.path}\` references missing related source \`packages/internal/src/core/missing.ts\`.`)
	})

	it('enforces deterministic heading, visual, and local-file requirements when declared', () => {
		const constrained: NarrativePage = {
			...pages[0]!,
			requiredHeadings: ['Pipeline'],
			visualRequirement: 'dot',
		}
		const constrainedPages = [constrained, ...pages.slice(1)]
		const problems = auditNarrativeDocs(objectTree(files({
			[constrained.path]: `${pageText(constrained)}\n![Flow](./flow.svg)\n`,
		})), constrainedPages)
		expect(problems)
			.toContain(`\`${constrained.path}\` is missing required heading \`Pipeline\`.`)
		expect(problems)
			.toContain(`\`${constrained.path}\` requires a Graphviz/DOT visual.`)
		expect(problems)
			.toContain(`\`${constrained.path}\` references missing local asset/include \`docs/getting-started/flow.svg\`.`)
	})
})
