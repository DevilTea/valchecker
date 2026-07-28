import type { CatalogEntry, Selection } from './impact-selection'
import type { Revisions } from './inert-change'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { buildAttribution, selectImpactScenarios } from './impact-selection'
import { inertChangedPaths } from './inert-change'
import { fileSystemTree } from './source-tree'

// Scopes one Performance Impact run to the scenarios its diff can move.
//
// The gate used to measure every standard-tier scenario on every pull request,
// which is 55 minutes against a 90-minute timeout. Neither of the two decisions that
// put it there can be reverted — five paired repetitions are what make a scenario
// classifiable at all, and one process per cell is what makes a subset measure the
// same numbers as the whole suite — so what changes is the *set* of scenarios rather
// than how any one of them is measured. The mapping and everything it refuses to
// decide live in `impact-selection.ts`; this file is the input and output around it.
//
// Output is deliberately loud. A reader of a passing gate has to be able to see that
// it measured 34 scenarios and which ones, rather than assume it measured everything.
//
// Two revisions are read here rather than one tree, because whether a changed file
// *means* anything different is a question about a pair. `--base` names the baseline the
// comparison is against; without it nothing can be judged inert and every path is
// classified from its path alone, which is said out loud rather than assumed.

const root = process.cwd()

interface Options {
	tree: string
	changedFiles: string[]
	/** The baseline revision, when there is one to read file contents from. */
	base: string | null
	/** The candidate revision, or `null` to read the candidate from `--tree`. */
	head: string | null
	markdown: string | null
	githubOutput: string | null
	summary: string | null
}

function readChangedFiles(source: string): string[] {
	const text = source === '-'
		? fs.readFileSync(0, 'utf8')
		: fs.readFileSync(path.resolve(root, source), 'utf8')
	return text.split('\n')
		.map(line => line.trim())
		.filter(Boolean)
}

/** `git diff --name-only base [head]`; with no head, against the working tree. */
function diffNames(base: string, head: string | null): string[] {
	return execFileSync('git', ['diff', '--name-only', base, ...head == null ? [] : [head]], { cwd: root, encoding: 'utf8' })
		.split('\n')
		.map(line => line.trim())
		.filter(Boolean)
}

/** One revision's copy of a file, or `null` when that revision does not have it. */
function gitText(ref: string, filePath: string): string | null {
	try {
		return execFileSync('git', ['show', `${ref}:${filePath}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
	}
	catch {
		return null
	}
}

function parseArguments(argv: string[]): Options {
	const options: Options = { tree: root, changedFiles: [], base: null, head: null, markdown: null, githubOutput: null, summary: null }
	let changedFrom: string | null = null

	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index]
		const value = argv[index + 1]
		if (argument === '--tree' && value != null) {
			options.tree = path.resolve(root, value)
			index++
		}
		else if (argument === '--changed-files' && value != null) {
			changedFrom = value
			index++
		}
		else if (argument === '--base' && value != null) {
			options.base = value
			index++
		}
		else if (argument === '--head' && value != null) {
			options.head = value
			index++
		}
		else if (argument === '--markdown' && value != null) {
			options.markdown = path.resolve(root, value)
			index++
		}
		else if (argument === '--github-output' && value != null) {
			options.githubOutput = path.resolve(root, value)
			index++
		}
		else if (argument === '--summary' && value != null) {
			options.summary = path.resolve(root, value)
			index++
		}
		else {
			throw new Error(`Unknown or incomplete argument: ${argument}`)
		}
	}

	if (changedFrom != null)
		options.changedFiles = readChangedFiles(changedFrom)
	else if (options.base != null)
		options.changedFiles = diffNames(options.base, options.head)
	else
		throw new Error('Provide either --changed-files <path|-> or --base <ref>, optionally with --head <ref>')

	return options
}

function markdownCell(value: string): string {
	return value.replaceAll('|', '\\|')
}

function renderMarkdown(selection: Selection): string {
	const lines: string[] = ['## Scenario scope', '']

	if (selection.full) {
		const forcing = selection.classifications.filter(classification => classification.effect === 'full')
		lines.push(
			`Measuring **all ${selection.totalScenarios}** standard-tier scenarios.`,
			'',
			'Forced by:',
			'',
		)
		for (const classification of forcing)
			lines.push(`- \`${markdownCell(classification.path)}\` — ${classification.reason}`)
		for (const problem of selection.problems)
			lines.push(`- the import graph is incomplete — ${markdownCell(problem)}`)
		if (forcing.length === 0 && selection.problems.length === 0)
			lines.push('- the diff reaches every scenario through the steps it changed')
	}
	else {
		const attributed = new Set(selection.attributedIds)
		const canaryOnly = selection.canaryIds.filter(id => !attributed.has(id))
		lines.push(
			`Measuring **${selection.scenarioIds.length} of ${selection.totalScenarios}** standard-tier scenarios: `
			+ `${selection.attributedIds.length} the diff can move, ${canaryOnly.length} more from the canary set`
			+ `${selection.topUpIds.length > 0 ? `, ${selection.topUpIds.length} to keep a group's severe-group trigger possible` : ''}.`,
			'',
			selection.steps.length > 0
				? `Steps the diff reaches: ${selection.steps.map(step => `\`${step}\``)
					.join(', ')}.`
				: 'The diff reaches no step, so only the canary set runs.',
		)
	}

	lines.push(
		'',
		'| Changed path | Effect |',
		'| --- | --- |',
	)
	for (const classification of selection.classifications)
		lines.push(`| \`${markdownCell(classification.path)}\` | ${classification.effect === 'ignored' ? 'ignored' : classification.effect === 'full' ? '**full run**' : 'selects'} — ${markdownCell(classification.reason)} |`)

	lines.push(
		'',
		'| Benchmark group | Scenarios measured | Severe-group trigger |',
		'| --- | ---: | --- |',
	)
	for (const coverage of selection.groups) {
		// "possible" alone reads as coverage of the group, which 5 of 113 is not. The
		// trigger really is possible there — the scenarios left out are the ones the diff
		// cannot move — but the aggregate is over what ran, and the reader has to be told
		// which of the two they are looking at. `impact.md` repeats the same denominator
		// beside the geometric mean it actually computed.
		const trigger = !coverage.triggerPossible
			? 'not possible — fewer than two scenarios measured'
			: coverage.selected === coverage.total
				? 'possible, over the whole group'
				: `possible, over the ${coverage.selected} measured of ${coverage.total}`
		lines.push(`| ${markdownCell(coverage.group)} | ${coverage.selected}/${coverage.total} | ${trigger} |`)
	}

	lines.push(
		'',
		'<details><summary>Scenarios measured</summary>',
		'',
		selection.scenarioIds.map(id => `- \`${id}\``)
			.join('\n'),
		'',
		'</details>',
		'',
	)
	return `${lines.join('\n')}\n`
}

const options = parseArguments(process.argv.slice(2))
const catalogEntry = path.join(root, 'benchmarks/src/scenarios/index.mjs')
const { getScenarioCatalog } = await import(pathToFileURL(catalogEntry).href) as {
	getScenarioCatalog: (mode: string) => CatalogEntry[]
}

const tree = fileSystemTree(options.tree)
const attribution = buildAttribution(tree)

// The candidate's text comes from `--head` when there is one and from `--tree` otherwise,
// which is the working tree: that is what makes an uncommitted edit reproducible locally
// with `--base main` alone. Both sides come from git in the workflow, where the tree is a
// worktree of exactly the revision `--head` names.
const revisions: Revisions | null = options.base == null
	? null
	: {
			base: filePath => gitText(options.base!, filePath),
			head: options.head == null ? filePath => tree.read(filePath) : filePath => gitText(options.head!, filePath),
		}
const inertPaths = revisions == null ? new Set<string>() : inertChangedPaths(options.changedFiles, revisions)

const selection = selectImpactScenarios({
	changedFiles: options.changedFiles,
	attribution,
	catalog: getScenarioCatalog('standard'),
	inertPaths,
})

const markdown = renderMarkdown(selection)
if (options.markdown != null) {
	fs.mkdirSync(path.dirname(options.markdown), { recursive: true })
	fs.writeFileSync(options.markdown, markdown)
}
if (options.summary != null)
	fs.appendFileSync(options.summary, markdown)
if (options.githubOutput != null) {
	fs.appendFileSync(options.githubOutput, [
		`full=${String(selection.full)}`,
		`count=${selection.scenarioIds.length}`,
		// A full run passes no filter at all, so it is byte-identical to the run the
		// gate produced before scenario scoping existed.
		`scenarios=${selection.full ? '' : selection.scenarioIds.join(',')}`,
		'',
	].join('\n'))
}

console.error(selection.full
	? `[impact-scope] full run: ${selection.totalScenarios} scenarios`
	: `[impact-scope] ${selection.scenarioIds.length} of ${selection.totalScenarios} scenarios `
		+ `(${selection.attributedIds.length} attributed, ${selection.canaryIds.filter(id => !selection.attributedIds.includes(id)).length} canary-only, ${selection.topUpIds.length} top-up)`)
if (revisions == null) {
	console.error('[impact-scope] no --base revision, so no change can be shown to be inert; every path is classified from its path alone')
}
else if (inertPaths.size > 0) {
	console.error(`[impact-scope] ${inertPaths.size === 1 ? '1 changed path means' : `${inertPaths.size} changed paths mean`} the same in both revisions: ${[...inertPaths].sort()
		.join(', ')}`)
}
for (const problem of selection.problems)
	console.error(`[impact-scope] incomplete attribution: ${problem}`)
