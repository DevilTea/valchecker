import { describe, expect, it } from 'vitest'
import {
	documentationSections,
	type NarrativePage,
} from '../docs/_meta/pages'
import { auditNarrativeDocs, parseNarrativePage } from './docs-narrative'
import { objectTree } from './source-tree'

const pages: NarrativePage[] = documentationSections.map((section, index) => ({
	id: section.id,
	path: `docs/${section.id}/index.md`,
	section: section.id,
	order: 10,
	title: section.label,
	archetype: section.id === 'getting-started' ? 'tutorial' : 'concept',
	transitional: true,
}))

function files(overrides: Record<string, string> = {}): Record<string, string> {
	const result: Record<string, string> = {
		'docs/index.md': '# Landing\n',
	}
	for (const page of pages)
		result[page.path] = `# ${page.title}\n`
	return { ...result, ...overrides }
}

describe('narrative frontmatter', () => {
	it('parses only page-local metadata', () => {
		const parsed = parseNarrativePage([
			'---',
			'description: A source-backed concept page.',
			'relatedSources:',
			'  - packages/internal/src/core/example.ts',
			'relatedPackages:',
			'  - valchecker',
			'---',
			'# Example',
		].join('\n'))

		expect(parsed.problems).toEqual([])
		expect(parsed.frontmatter).toEqual({
			description: 'A source-backed concept page.',
			relatedSources: ['packages/internal/src/core/example.ts'],
			relatedPackages: ['valchecker'],
		})
	})

	it('rejects registry-owned metadata in page frontmatter', () => {
		const parsed = parseNarrativePage('---\nsection: concepts\n---\n# Example\n')
		expect(parsed.problems).toEqual([
			'`section` is not narrative page-local metadata. Allowed fields: `description`, `relatedSources`, `relatedPackages`.',
		])
	})
})

describe('narrative documentation audit', () => {
	it('accepts the transitional inventory without inventing duplicate metadata', () => {
		expect(auditNarrativeDocs(objectTree(files()), pages)).toEqual([])
	})

	it('rejects unregistered pages and canonical H1 drift', () => {
		const problems = auditNarrativeDocs(objectTree(files({
			[pages[0]!.path]: '# Wrong title\n',
			'docs/core-concepts/stray.md': '# Stray\n',
		})), pages)
		expect(problems).toContain(`\`${pages[0]!.path}\` must open with canonical H1 \`# ${pages[0]!.title}\`, found \`# Wrong title\`.`)
		expect(problems).toContain('Unregistered narrative page `docs/core-concepts/stray.md` exists under `docs/`.')
	})

	it('requires source-backed metadata once a page leaves transitional inventory', () => {
		const finalPage: NarrativePage = { ...pages[0]!, transitional: undefined }
		const finalPages = [finalPage, ...pages.slice(1)]
		const withoutMetadata = auditNarrativeDocs(objectTree(files()), finalPages)
		expect(withoutMetadata).toContain(`\`${finalPage.path}\` has no narrative frontmatter. Final narrative pages require \`description\` and non-empty \`relatedSources\`.`)

		const withMetadata = auditNarrativeDocs(objectTree(files({
			[finalPage.path]: [
				'---',
				'description: Final page.',
				'relatedSources:',
				'  - packages/internal/src/core/example.ts',
				'---',
				`# ${finalPage.title}`,
			].join('\n'),
		})), finalPages)
		expect(withMetadata).toContain(`\`${finalPage.path}\` references missing related source \`packages/internal/src/core/example.ts\`.`)
	})

	it('enforces deterministic heading, visual, and local-file requirements when declared', () => {
		const constrained: NarrativePage = {
			...pages[0]!,
			requiredHeadings: ['Pipeline'],
			visualRequirement: 'dot',
		}
		const constrainedPages = [constrained, ...pages.slice(1)]
		const problems = auditNarrativeDocs(objectTree(files({
			[constrained.path]: `# ${constrained.title}\n\n![Flow](./flow.svg)\n`,
		})), constrainedPages)
		expect(problems).toContain(`\`${constrained.path}\` is missing required heading \`Pipeline\`.`)
		expect(problems).toContain(`\`${constrained.path}\` requires a Graphviz/DOT visual.`)
		expect(problems).toContain(`\`${constrained.path}\` references missing local asset/include \`docs/getting-started/flow.svg\`.`)
	})
})
