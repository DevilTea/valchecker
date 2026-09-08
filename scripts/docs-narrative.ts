import path from 'node:path'
import {
	documentationSections,
	narrativePages,
	type NarrativePage,
} from '../docs/_meta/pages'
import type { SourceTree } from './source-tree'

export interface NarrativeFrontmatter {
	description: string | null
	relatedSources: string[]
	relatedPackages: string[]
}

export interface ParsedNarrativePage {
	frontmatter: NarrativeFrontmatter | null
	body: string
	problems: string[]
}

const frontmatterFields = ['description', 'relatedSources', 'relatedPackages'] as const
const listFields = new Set(['relatedSources', 'relatedPackages'])

function unquote(value: string): string {
	const trimmed = value.trim()
	if (trimmed.length >= 2 && ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))))
		return trimmed.slice(1, -1)
	return trimmed
}

/**
 * Parse the intentionally small narrative frontmatter contract.
 *
 * It is YAML-shaped because VitePress understands YAML frontmatter, but the docs contract only owns
 * three fields. Keeping the accepted syntax narrow makes typos and duplicated ownership fail closed
 * without adding a second general-purpose metadata model.
 */
export function parseNarrativePage(text: string): ParsedNarrativePage {
	const lines = text.split(/\r?\n/)
	if (lines[0]?.trim() !== '---')
		return { frontmatter: null, body: text, problems: [] }

	const closer = lines.findIndex((line, index) => index > 0 && line.trim() === '---')
	if (closer === -1) {
		return {
			frontmatter: null,
			body: '',
			problems: ['frontmatter opens with `---` but never closes with another `---`.'],
		}
	}

	const problems: string[] = []
	let description: string | null = null
	const relatedSources: string[] = []
	const relatedPackages: string[] = []
	let activeList: 'relatedSources' | 'relatedPackages' | null = null
	const seen = new Set<string>()

	for (const raw of lines.slice(1, closer)) {
		if (raw.trim() === '')
			continue
		const listItem = /^\s+-\s+(.+)$/.exec(raw)
		if (listItem != null) {
			if (activeList == null) {
				problems.push(`\`${raw.trim()}\` is a list item without a list field.`)
				continue
			}
			const value = unquote(listItem[1]!)
			if (value === '') {
				problems.push(`\`${activeList}\` contains an empty item.`)
				continue
			}
			;(activeList === 'relatedSources' ? relatedSources : relatedPackages).push(value)
			continue
		}

		const field = /^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/.exec(raw.trim())
		if (field == null) {
			problems.push(`\`${raw.trim()}\` is not a supported frontmatter field or list item.`)
			activeList = null
			continue
		}
		const [, name, rawValue] = field as unknown as [string, string, string]
		if (!(frontmatterFields as readonly string[]).includes(name)) {
			problems.push(`\`${name}\` is not narrative page-local metadata. Allowed fields: ${frontmatterFields.map(item => `\`${item}\``).join(', ')}.`)
			activeList = null
			continue
		}
		if (seen.has(name)) {
			problems.push(`\`${name}\` is declared more than once.`)
			activeList = null
			continue
		}
		seen.add(name)

		if (listFields.has(name)) {
			if (rawValue.trim() !== '')
				problems.push(`\`${name}\` is a list and must put each value on its own \`- item\` line.`)
			activeList = name as 'relatedSources' | 'relatedPackages'
			continue
		}

		activeList = null
		description = unquote(rawValue)
		if (description === '')
			problems.push('`description` is empty.')
	}

	return {
		frontmatter: { description, relatedSources, relatedPackages },
		body: lines.slice(closer + 1).join('\n'),
		problems,
	}
}

function visibleMarkdownLines(markdown: string): string[] {
	const visible: string[] = []
	let fence: string | null = null
	for (const line of markdown.split(/\r?\n/)) {
		const delimiter = /^\s*(`{3,}|~{3,})/.exec(line)?.[1] ?? null
		if (fence != null) {
			if (delimiter != null && delimiter[0] === fence[0] && delimiter.length >= fence.length)
				fence = null
			continue
		}
		if (delimiter != null) {
			fence = delimiter
			continue
		}
		visible.push(line)
	}
	return visible
}

function hasTable(markdown: string): boolean {
	const lines = visibleMarkdownLines(markdown)
	return lines.some((line, index) => line.includes('|') && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1] ?? ''))
}

function hasDot(markdown: string): boolean {
	return /^\s*```(?:dot|graphviz)\b/m.test(markdown)
}

function localTarget(pagePath: string, rawTarget: string): string | null {
	const target = rawTarget.split('#')[0]!.split('?')[0]!
	if (target === '' || target.startsWith('#') || /^(?:[a-z]+:)?\/\//i.test(target) || target.startsWith('data:'))
		return null
	if (target.startsWith('@/'))
		return path.posix.join('docs', target.slice(2))
	if (target.startsWith('/'))
		return path.posix.join('docs/public', target)
	return path.posix.normalize(path.posix.join(path.posix.dirname(pagePath), target))
}

function referencedLocalFiles(pagePath: string, markdown: string): string[] {
	const targets: string[] = []
	for (const line of visibleMarkdownLines(markdown)) {
		const include = /^\s*<<<\s+([^\s{[]+)/.exec(line)?.[1]
		if (include != null) {
			const resolved = localTarget(pagePath, include)
			if (resolved != null)
				targets.push(resolved)
		}
		for (const image of line.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+['"][^'"]*['"])?\)/g)) {
			const resolved = localTarget(pagePath, image[1]!)
			if (resolved != null)
				targets.push(resolved)
		}
	}
	return targets
}

const excludedNarrativeRoots = ['docs/.vitepress', 'docs/_meta', 'docs/.examples', 'docs/api']
const excludedNarrativeFiles = new Set(['docs/index.md'])

function collectNarrativeMarkdown(tree: SourceTree, directory = 'docs'): string[] {
	const entries = tree.list(directory)
	if (entries == null)
		return []
	const files: string[] = []
	for (const name of entries) {
		const child = `${directory}/${name}`
		if (excludedNarrativeRoots.some(root => child === root || child.startsWith(`${root}/`)))
			continue
		if (tree.isDirectory(child)) {
			files.push(...collectNarrativeMarkdown(tree, child))
			continue
		}
		if (child.endsWith('.md') && !excludedNarrativeFiles.has(child))
			files.push(child)
	}
	return files
}

export function auditNarrativeDocs(
	tree: SourceTree,
	pages: readonly NarrativePage[] = narrativePages,
): string[] {
	const problems: string[] = []
	const sectionIds = new Set(documentationSections.map(section => section.id))
	const seenIds = new Set<string>()
	const seenPaths = new Set<string>()
	const orders = new Set<string>()

	for (const page of pages) {
		if (seenIds.has(page.id))
			problems.push(`Narrative page id \`${page.id}\` is registered more than once.`)
		seenIds.add(page.id)
		if (seenPaths.has(page.path))
			problems.push(`Narrative path \`${page.path}\` is registered more than once.`)
		seenPaths.add(page.path)
		if (!sectionIds.has(page.section))
			problems.push(`\`${page.path}\` uses unknown documentation section \`${page.section}\`.`)
		const orderKey = `${page.section}:${page.order}`
		if (orders.has(orderKey))
			problems.push(`Documentation section \`${page.section}\` uses order ${page.order} more than once.`)
		orders.add(orderKey)

		const text = tree.read(page.path)
		if (text == null) {
			problems.push(`Registered narrative page \`${page.path}\` does not exist.`)
			continue
		}
		const parsed = parseNarrativePage(text)
		for (const problem of parsed.problems)
			problems.push(`\`${page.path}\`: ${problem}`)

		const firstContent = parsed.body.split(/\r?\n/).find(line => line.trim() !== '')?.trim() ?? ''
		if (firstContent !== `# ${page.title}`)
			problems.push(`\`${page.path}\` must open with canonical H1 \`# ${page.title}\`, found ${firstContent === '' ? 'no H1' : `\`${firstContent}\``}.`)

		if (!page.transitional) {
			if (parsed.frontmatter == null) {
				problems.push(`\`${page.path}\` has no narrative frontmatter. Final narrative pages require \`description\` and non-empty \`relatedSources\`.`)
			}
			else {
				if (parsed.frontmatter.description == null || parsed.frontmatter.description.trim() === '')
					problems.push(`\`${page.path}\` has no non-empty \`description\`.`)
				if (parsed.frontmatter.relatedSources.length === 0)
					problems.push(`\`${page.path}\` has no \`relatedSources\` semantic root.`)
			}
		}

		for (const source of parsed.frontmatter?.relatedSources ?? []) {
			if (tree.read(source) == null)
				problems.push(`\`${page.path}\` references missing related source \`${source}\`.`)
		}

		const visible = visibleMarkdownLines(parsed.body)
		const headings = new Set(visible.map(line => /^#{2,6}\s+(.+?)\s*(?:\{#[^}]+\})?$/.exec(line.trim())?.[1]?.trim()).filter((heading): heading is string => heading != null))
		for (const required of page.requiredHeadings ?? []) {
			if (!headings.has(required))
				problems.push(`\`${page.path}\` is missing required heading \`${required}\`.`)
		}

		if (page.visualRequirement === 'dot' && !hasDot(parsed.body))
			problems.push(`\`${page.path}\` requires a Graphviz/DOT visual.`)
		if (page.visualRequirement === 'table' && !hasTable(parsed.body))
			problems.push(`\`${page.path}\` requires a Markdown table.`)
		if (page.visualRequirement === 'any' && !hasDot(parsed.body) && !hasTable(parsed.body))
			problems.push(`\`${page.path}\` requires an explanatory visual.`)

		for (const target of referencedLocalFiles(page.path, parsed.body)) {
			if (tree.read(target) == null)
				problems.push(`\`${page.path}\` references missing local asset/include \`${target}\`.`)
		}
	}

	const registered = new Set(pages.map(page => page.path))
	for (const file of collectNarrativeMarkdown(tree).toSorted()) {
		if (!registered.has(file as NarrativePage['path']))
			problems.push(`Unregistered narrative page \`${file}\` exists under \`docs/\`.`)
	}

	for (const section of documentationSections) {
		if (!pages.some(page => page.section === section.id))
			problems.push(`Documentation section \`${section.id}\` has no registered narrative page.`)
	}

	return problems
}
