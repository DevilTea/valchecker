import type { SourceTree } from './source-tree'
import { execFileSync } from 'node:child_process'
import process from 'node:process'
import { analyzeDocsImpact, parseNameStatus } from './docs-impact'
import { fileSystemTree } from './source-tree'

function git(...args: string[]): string {
	return execFileSync('git', args, {
		cwd: process.cwd(),
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	})
}

function argumentValue(name: string): string | null {
	const index = process.argv.indexOf(name)
	if (index < 0)
		return null
	const value = process.argv[index + 1]
	if (value == null || value.startsWith('--'))
		throw new Error(`${name} requires a value.`)
	return value
}

function mergeBase(requested: string): string {
	try {
		return git('merge-base', requested, 'HEAD').trim()
	}
	catch (error) {
		if (requested !== 'origin/main')
			throw error
		return git('merge-base', 'main', 'HEAD').trim()
	}
}

/** A read-only SourceTree backed by one committed git revision. */
function gitRevisionTree(ref: string): SourceTree {
	const files = git('ls-tree', '-r', '--name-only', ref)
		.split(/\r?\n/)
		.filter(Boolean)
	const fileSet = new Set(files)
	const directories = new Set<string>()
	const entriesByDirectory = new Map<string, Set<string>>()
	const cache = new Map<string, string>()

	for (const file of files) {
		const parts = file.split('/')
		for (let index = 1; index < parts.length; index++) {
			const directory = parts.slice(0, index).join('/')
			directories.add(directory)
			const parent = parts.slice(0, index - 1).join('/')
			const entries = entriesByDirectory.get(parent) ?? new Set<string>()
			entries.add(parts[index - 1]!)
			entriesByDirectory.set(parent, entries)
		}
		const directory = parts.slice(0, -1).join('/')
		const entries = entriesByDirectory.get(directory) ?? new Set<string>()
		entries.add(parts.at(-1)!)
		entriesByDirectory.set(directory, entries)
	}

	return {
		read: (path) => {
			if (!fileSet.has(path))
				return null
			const cached = cache.get(path)
			if (cached != null)
				return cached
			const content = git('show', `${ref}:${path}`)
			cache.set(path, content)
			return content
		},
		list: (directory) => {
			const entries = entriesByDirectory.get(directory)
			return entries == null ? null : [...entries]
		},
		isDirectory: path => directories.has(path),
	}
}

function workingChangedPaths(base: string): string[] {
	const paths = [
		...parseNameStatus(git('diff', '--name-status', '-M', '-C', base, 'HEAD')),
		...parseNameStatus(git('diff', '--cached', '--name-status', '-M', '-C')),
		...parseNameStatus(git('diff', '--name-status', '-M', '-C')),
		...git('ls-files', '--others', '--exclude-standard')
			.split(/\r?\n/)
			.filter(Boolean),
	]
	return [...new Set(paths)].sort()
}

const requestedBase = argumentValue('--base') ?? process.env.BASE_REF ?? 'origin/main'
const base = mergeBase(requestedBase)
const changedPaths = workingChangedPaths(base)
const report = analyzeDocsImpact(
	fileSystemTree(process.cwd()),
	changedPaths,
	{ baseTree: gitRevisionTree(base) },
)

if (process.argv.includes('--json')) {
	console.log(JSON.stringify({ base, changedPaths, ...report }, null, 2))
	process.exit(0)
}

console.log(`Documentation semantic review scope against ${base}:`)
if (report.impacts.length === 0) {
	console.log('  No source-backed documentation owners are impacted.')
}
else {
	for (const impact of report.impacts) {
		console.log(`- ${impact.kind === 'narrative' ? 'Narrative' : 'Step reference'}: ${impact.title} (${impact.touched ? 'TOUCHED' : 'UNTOUCHED'})`)
		console.log(`  owner: ${impact.path}`)
		for (const cause of impact.causes) {
			console.log(`  related source: ${cause.root}`)
			console.log(`  changed dependency: ${cause.changedPath}${cause.revision === 'base' ? ' (reachable in base revision)' : ''}`)
			if (cause.chain.length > 1)
				console.log(`  chain: ${cause.chain.join(' -> ')}`)
		}
	}
}

if (report.problems.length > 0) {
	console.log('\nStatus warnings (non-blocking; deterministic defects remain owned by docs:check):')
	for (const problem of report.problems)
		console.log(`- ${problem}`)
}

console.log('\nImpact means mandatory semantic review scope; it does not mean the prose is stale.')
