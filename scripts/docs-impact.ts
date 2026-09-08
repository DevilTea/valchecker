import type { NarrativePage } from '../docs/_meta/pages'
import type { SourceTree } from './source-tree'
import { narrativePages } from '../docs/_meta/pages'
import { parseNarrativePage } from './docs-narrative'
import { buildSourceImportGraph, importPath } from './source-import-graph'
import { discoverSteps, stepsRoot } from './step-inventory'

export type ImpactRevision = 'current' | 'base'
export type DocsImpactKind = 'narrative' | 'step-reference'

export interface DocsImpactCause {
	/** The changed path that selected this documentation owner. */
	changedPath: string
	/** Semantic source root whose import closure reaches the changed path. */
	root: string
	/** Root → changed dependency causal chain. */
	chain: string[]
	/** Which source graph proved the relationship. Base is needed for deleted/moved dependencies. */
	revision: ImpactRevision
}

export interface DocsImpactEntry {
	kind: DocsImpactKind
	path: string
	title: string
	touched: boolean
	causes: DocsImpactCause[]
}

export interface DocsImpactReport {
	impacts: DocsImpactEntry[]
	/** Graph/inventory uncertainty. `docs:status` reports these but remains non-blocking. */
	problems: string[]
}

/**
 * Parse `git diff --name-status` output. Rename/copy records deliberately contribute
 * both old and new paths so a move cannot disappear from documentation review scope.
 */
export function parseNameStatus(text: string): string[] {
	const paths: string[] = []
	for (const line of text.split(/\r?\n/)) {
		if (line.trim() === '')
			continue
		const fields = line.split('\t')
		const status = fields[0] ?? ''
		if (/^[RC]\d*$/.test(status)) {
			if (fields[1] != null && fields[1] !== '')
				paths.push(fields[1])
			if (fields[2] != null && fields[2] !== '')
				paths.push(fields[2])
			continue
		}
		if (fields[1] != null && fields[1] !== '')
			paths.push(fields[1])
	}
	return [...new Set(paths)]
}

function causesForRoot(
	root: string,
	changedPaths: readonly string[],
	currentGraph: ReturnType<typeof buildSourceImportGraph>,
	baseGraph: ReturnType<typeof buildSourceImportGraph> | null,
): DocsImpactCause[] {
	const causes: DocsImpactCause[] = []
	for (const changedPath of changedPaths) {
		const current = importPath(currentGraph, root, changedPath)
		if (current != null) {
			causes.push({ changedPath, root, chain: current, revision: 'current' })
			continue
		}
		const previous = baseGraph == null ? null : importPath(baseGraph, root, changedPath)
		if (previous != null)
			causes.push({ changedPath, root, chain: previous, revision: 'base' })
	}
	return causes
}

function uniqueCauses(causes: DocsImpactCause[]): DocsImpactCause[] {
	const seen = new Set<string>()
	return causes.filter((cause) => {
		const key = `${cause.revision}\0${cause.root}\0${cause.changedPath}\0${cause.chain.join('\0')}`
		if (seen.has(key))
			return false
		seen.add(key)
		return true
	})
}

/**
 * Map source changes to the documentation owners that must be semantically reviewed.
 *
 * Current import reachability covers ordinary edits and the new side of moves. An
 * optional base tree covers deleted dependencies and the old side of moves after the
 * current import graph no longer contains that path. Source impact is review scope;
 * this function never claims that impacted prose is stale.
 */
export function analyzeDocsImpact(
	currentTree: SourceTree,
	changedPathsInput: readonly string[],
	options: {
		baseTree?: SourceTree | null
		pages?: readonly NarrativePage[]
	} = {},
): DocsImpactReport {
	const pages = options.pages ?? narrativePages
	const baseTree = options.baseTree ?? null
	const changedPaths = [...new Set(changedPathsInput)].sort()
	const touched = new Set(changedPaths)
	const problems: string[] = []

	const narrativeRoots = new Map<string, string[]>()
	for (const page of pages) {
		const text = currentTree.read(page.path)
		if (text == null)
			continue
		const parsed = parseNarrativePage(text)
		if (parsed.problems.length > 0)
			problems.push(...parsed.problems.map(problem => `${page.path}: ${problem}`))
		narrativeRoots.set(page.path, parsed.frontmatter?.relatedSources ?? [])
	}

	const inventory = discoverSteps(currentTree)
	problems.push(...inventory.problems)

	const semanticRoots = [
		...new Set([
			...narrativeRoots.values().flat(),
			...inventory.steps.map(step => step.path),
		]),
	]
	const currentGraph = buildSourceImportGraph(currentTree, semanticRoots)
	problems.push(...currentGraph.problems)

	let baseGraph: ReturnType<typeof buildSourceImportGraph> | null = null
	if (baseTree != null) {
		const baseRoots = semanticRoots.filter(root => baseTree.read(root) != null)
		baseGraph = buildSourceImportGraph(baseTree, baseRoots)
		problems.push(...baseGraph.problems.map(problem => `[base] ${problem}`))
	}

	const impacts: DocsImpactEntry[] = []
	for (const page of pages) {
		const causes = uniqueCauses((narrativeRoots.get(page.path) ?? [])
			.flatMap(root => causesForRoot(root, changedPaths, currentGraph, baseGraph)))
		if (causes.length === 0)
			continue
		impacts.push({
			kind: 'narrative',
			path: page.path,
			title: page.title,
			touched: touched.has(page.path),
			causes,
		})
	}

	for (const step of inventory.steps) {
		const causes = uniqueCauses(causesForRoot(step.path, changedPaths, currentGraph, baseGraph))
		if (causes.length === 0)
			continue
		const docPath = `${stepsRoot}/${step.directory}/${step.directory}.doc.md`
		impacts.push({
			kind: 'step-reference',
			path: docPath,
			title: `${step.name}()`,
			touched: touched.has(docPath),
			causes,
		})
	}

	impacts.sort((left, right) => left.path.localeCompare(right.path))
	return { impacts, problems: [...new Set(problems)] }
}
