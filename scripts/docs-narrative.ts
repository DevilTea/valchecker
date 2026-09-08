import type { NarrativePage } from '../docs/_meta/pages'
import type { SourceTree } from './source-tree'
import path from 'node:path'
import {
	documentationSections,
	narrativePages,
} from '../docs/_meta/pages'

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
const listFields = new Set<string>(['relatedSources', 'relatedPackages'])

function unquote(value: string): string {
	const trimmed = value.trim()
	const quote = trimmed[0]
	if (trimmed.length >= 2 && (quote === '\'' || quote === '"') && trimmed.at(-1) === quote)
		return trimmed.slice(1, -1)
	return trimmed
}

function allowedFrontmatterFields(): string {
	return frontmatterFields
		.map(item => `\`${item}\``)
		.join(', ')
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
		const trimmedRaw = raw.trim()
		if (trimmedRaw === '')
			continue

		if (trimmedRaw.startsWith('- ')) {
			if (activeList == null) {
				problems.push(`\`${trimmedRaw}\` is a list item without a list field.`)
				continue
			}
			const value = unquote(trimmedRaw.slice(2))
			if (value === '') {
				problems.push(`\`${activeList}\` contains an empty item.`)
				continue
			}
			const targetList = activeList === 'relatedSources' ? relatedSources : relatedPackages
			targetList.push(value)
			continue
		}

		const colon = trimmedRaw.indexOf(':')
		if (colon <= 0) {
			problems.push(`\`${trimmedRaw}\` is not a supported frontmatter field or list item.`)
			activeList = null
			continue
		}
		const name = trimmedRaw.slice(0, colon)
		const rawValue = trimmedRaw.slice(colon + 1)
			.trimStart()
		if (!/^[a-z][a-z0-9]*$/i.test(name) || !(frontmatterFields as readonly string[]).includes(name)) {
			problems.push(`\`${name}\` is not narrative page-local metadata. Allowed fields: ${allowedFrontmatterFields()}.`)
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
			if (rawValue !== '')
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
		body: lines.slice(closer + 1)
			.join('\n'),
		problems,
	}
}

function visibleMarkdownLines(markdown: string): string[] {
	const visible: string[] = []
	let fence: string | null = null
	for (const line of markdown.split(/\r?\n/)) {
		const trimmed = line.trimStart()
		const delimiter = trimmed.startsWith('```')
			? '`'.repeat(trimmed.match(/^`+/)?.[0].length ?? 0)
			: trimmed.startsWith('~~~')
				? '~'.repeat(trimmed.match(/^~+/)?.[0].length ?? 0)
				: null
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

function isTableSeparator(line: string): boolean {
	let content = line.trim()
	if (content.startsWith('|'))
		content = content.slice(1)
	if (content.endsWith('|'))
		content = content.slice(0, -1)
	const cells = content.split('|')
		.map(cell => cell.trim())
	return cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell))
}

function hasTable(markdown: string): boolean {
	const lines = visibleMarkdownLines(markdown)
	return lines.some((line, index) => line.includes('|') && isTableSeparator(lines[index + 1] ?? ''))
}

function hasDot(markdown: string): boolean {
	return /^\s*```(?:dot|graphviz)\b/m.test(markdown)
}

function localTarget(pagePath: string, rawTarget: string): string | null {
	const target = rawTarget.split('#')[0]!.split('?')[0]!
	if (target === '' || /^(?:[a-z]+:)?\/\//i.test(target) || target.startsWith('data:'))
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

function markdownHeading(line: string): string | null {
	const trimmed = line.trimStart()
	let depth = 0
	while (trimmed[depth] === '#')
		depth++
	if (depth < 2 || depth > 6 || trimmed[depth] !== ' ')
		return null

	let heading = trimmed.slice(depth + 1)
		.trim()
	const anchorStart = heading.lastIndexOf(' {#')
	if (anchorStart >= 0 && heading.endsWith('}')) {
		heading = heading.slice(0, anchorStart)
			.trimEnd()
	}
	return heading === '' ? null : heading
}

function unauditedSkips(markdown: string): number[] {
	const lines = markdown.split(/\r?\n/)
	const problems: number[] = []
	for (const [index, line] of lines.entries()) {
		if (line.trim() !== '<!-- typecheck-skip -->')
			continue
		let previous = index - 1
		while (previous >= 0 && lines[previous]!.trim() === '')
			previous--
		const reason = previous >= 0 ? lines[previous]!.trim() : ''
		if (!reason.startsWith('<!-- ') || !reason.endsWith(' -->') || reason.startsWith('<!-- typecheck-'))
			problems.push(index + 1)
	}
	return problems
}

const excludedNarrativeRoots = ['docs/.vitepress', 'docs/_meta', 'docs/.examples', 'docs/api', 'docs/node_modules']
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
		if (page.navHidden === true && page.transitional !== true)
			problems.push(`\`${page.path}\` hides a canonical page from navigation; \`navHidden\` is reserved for transitional compatibility routes.`)
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

		const firstContentLine = parsed.body.split(/\r?\n/)
			.find(line => line.trim() !== '')
		const firstContent = firstContentLine?.trim() ?? ''
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
			for (const line of unauditedSkips(parsed.body))
				problems.push(`\`${page.path}\` has an unaudited \`typecheck-skip\` directive at Markdown line ${line}; precede it with an explanatory HTML comment.`)
		}

		for (const source of parsed.frontmatter?.relatedSources ?? []) {
			if (tree.read(source) == null)
				problems.push(`\`${page.path}\` references missing related source \`${source}\`.`)
		}

		const headings = new Set(visibleMarkdownLines(parsed.body)
			.map(markdownHeading)
			.filter((heading): heading is string => heading != null))
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
	for (const file of collectNarrativeMarkdown(tree)
		.toSorted()) {
		if (!registered.has(file as NarrativePage['path']))
			problems.push(`Unregistered narrative page \`${file}\` exists under \`docs/\`.`)
	}

	for (const section of documentationSections) {
		if (!pages.some(page => page.section === section.id))
			problems.push(`Documentation section \`${section.id}\` has no registered narrative page.`)
	}

	return problems
}
