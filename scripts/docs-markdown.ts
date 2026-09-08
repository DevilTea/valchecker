import type { SourceTree } from './source-tree'

interface FenceMarker {
	character: '`' | '~'
	length: number
	language: string
}

function fenceMarker(line: string): FenceMarker | null {
	const trimmed = line.trimStart()
	const character = trimmed[0]
	if (character !== '`' && character !== '~')
		return null

	let length = 0
	while (trimmed[length] === character)
		length++
	if (length < 3)
		return null

	const remainder = trimmed.slice(length)
		.trimStart()
	let languageEnd = 0
	while (languageEnd < remainder.length) {
		const char = remainder[languageEnd]!
		if (/\s/.test(char) || char === '{')
			break
		languageEnd++
	}

	return {
		character,
		length,
		language: remainder.slice(0, languageEnd).toLowerCase(),
	}
}

function unsupportedDiagramLines(markdown: string): Array<{ line: number, language: string }> {
	const unsupported = new Set(['mermaid'])
	const problems: Array<{ line: number, language: string }> = []
	let active: Pick<FenceMarker, 'character' | 'length'> | null = null

	for (const [index, line] of markdown.split(/\r?\n/).entries()) {
		const marker = fenceMarker(line)
		if (marker == null)
			continue

		if (active != null) {
			if (marker.character === active.character && marker.length >= active.length && marker.language === '')
				active = null
			continue
		}

		active = { character: marker.character, length: marker.length }
		if (unsupported.has(marker.language))
			problems.push({ line: index + 1, language: marker.language })
	}

	return problems
}

export function unauditedTypecheckSkipLines(markdown: string): number[] {
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

function collectMarkdown(tree: SourceTree, directory: string): string[] {
	const entries = tree.list(directory)
	if (entries == null)
		return []

	const files: string[] = []
	for (const name of entries) {
		if (name === 'node_modules' || name === 'dist' || name === 'cache')
			continue
		const child = `${directory}/${name}`
		if (tree.isDirectory(child)) {
			files.push(...collectMarkdown(tree, child))
			continue
		}
		if (child.endsWith('.md'))
			files.push(child)
	}
	return files
}

function packageReadmes(tree: SourceTree): string[] {
	const packages = tree.list('packages') ?? []
	return packages
		.filter(name => tree.isDirectory(`packages/${name}`))
		.map(name => `packages/${name}/README.md`)
		.filter(file => tree.read(file) != null)
}

export function auditDocumentationMarkdown(tree: SourceTree): string[] {
	const problems: string[] = []
	const docs = collectMarkdown(tree, 'docs')
		.toSorted()

	for (const file of docs) {
		const markdown = tree.read(file)!
		for (const problem of unsupportedDiagramLines(markdown)) {
			problems.push(`${file}:${problem.line} uses unsupported \`${problem.language}\` diagram syntax; use Graphviz DOT instead.`)
		}
	}

	for (const file of [...docs, ...packageReadmes(tree).toSorted()]) {
		const markdown = tree.read(file)!
		for (const line of unauditedTypecheckSkipLines(markdown)) {
			problems.push(`${file}:${line} has \`typecheck-skip\` without a preceding explanatory HTML comment.`)
		}
	}

	return problems
}
