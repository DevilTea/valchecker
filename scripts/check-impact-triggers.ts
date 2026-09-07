import type { Attribution, SourceTree } from './impact-selection'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { YAML } from 'zx'
import { buildAttribution, classifyChange, gateDefiningPaths } from './impact-selection'
import { performanceVerdictWorkflowProblems } from './performance-workflow-contract'

// The Performance Impact workflow's `paths` filters and `scripts/impact-selection.ts`
// have to agree, and nothing but this check makes them.
//
// The selector's most conservative rules — a lockfile, a package manifest, a
// `tsdown.config.ts`, a `tsconfig.json`, an unrecognised new path, and the files that
// define the gate itself — force a full run. A rule whose path never starts the
// workflow cannot fire, and the first version of this gate had exactly that shape: the
// filters listed `packages/*/src/**` and two `.github` files, so a pull request that
// only bumped a dependency got no comparison at all, and the claim that a selection
// rule can never be relaxed without one complete comparison was false.
//
// The direction that matters is one-way. A path the selector forces a full run for MUST
// start the workflow; a path that starts it without needing to only costs runner time.
// So this fails on a full-run path the filters miss, and separately on a handful of
// documentation-only paths that must stay out, because a filter of plain `**` would
// satisfy the first rule while making the gate run on every README.

const root = process.cwd()
const workflowPath = '.github/workflows/performance-impact.yml'

/**
 * The `paths` list of one `on:` event.
 *
 * Parsed with the `yaml` package that `zx` — already a root devDependency — bundles
 * and re-exports. An earlier version read the block positionally, on the belief that
 * no parser was resolvable here; it was, and the hand-written reader failed on
 * Windows because a CRLF checkout makes `on:` never match exactly. A check whose job
 * is to prove two files agree must not be the thing that disagrees with the platform.
 *
 * It still throws rather than returning an empty list, so a restructured workflow
 * fails loudly instead of silently checking nothing.
 */
function readEventPaths(text: string, event: string): string[] {
	const document = YAML.parse(text) as { on?: Record<string, { paths?: unknown }> } | null
	// `on` is the YAML 1.1 boolean `true`, which the parser preserves as the string
	// key here; read both so a parser or schema change cannot silently find nothing.
	const events = document?.on ?? (document as Record<string, unknown> | null)?.true as Record<string, { paths?: unknown }> | undefined
	if (events == null || typeof events !== 'object')
		throw new Error(`${workflowPath}: no top-level \`on:\` block`)

	const paths = events[event]?.paths
	if (!Array.isArray(paths) || paths.length === 0)
		throw new Error(`${workflowPath}: no \`paths\` list under \`on.${event}\``)
	for (const pattern of paths) {
		if (typeof pattern !== 'string')
			throw new TypeError(`${workflowPath}: the ${event} \`paths\` list contains a non-string entry: ${JSON.stringify(pattern)}`)
	}
	return paths as string[]
}

/**
 * One GitHub filter pattern as a regular expression. Only the subset this workflow
 * uses is accepted — `**`, `*`, `?`, and literals — because a pattern this function
 * silently mistranslated would make the whole check report agreement that is not there.
 */
function patternToRegExp(pattern: string): RegExp {
	let source = '^'
	for (let index = 0; index < pattern.length; index++) {
		const character = pattern[index]!
		if (character === '*') {
			if (pattern[index + 1] === '*') {
				source += '.*'
				index++
			}
			else {
				source += '[^/]*'
			}
		}
		else if (character === '?') {
			source += '[^/]'
		}
		else if ('+[]{}()^$|\\'.includes(character)) {
			throw new Error(`${workflowPath}: the path filter '${pattern}' uses glob syntax this check does not implement; extend \`patternToRegExp\` before using it`)
		}
		else {
			source += character.replace(/\./g, '\\$&')
		}
	}
	return new RegExp(`${source}$`)
}

interface Filter {
	event: string
	rules: { expression: RegExp, negated: boolean }[]
}

function compileFilter(text: string, event: string): Filter {
	return {
		event,
		rules: readEventPaths(text, event)
			.map((pattern) => {
				const negated = pattern.startsWith('!')
				return { expression: patternToRegExp(negated ? pattern.slice(1) : pattern), negated }
			}),
	}
}

/**
 * GitHub's own rule: every pattern is tested in order and the last one that matches
 * decides, so a `!` pattern after a positive one removes the path and a positive one
 * after a `!` puts it back.
 */
function triggers(filter: Filter, filePath: string): boolean {
	let matched = false
	for (const rule of filter.rules) {
		if (rule.expression.test(filePath))
			matched = !rule.negated
	}
	return matched
}

function fileSystemTree(rootDirectory: string): SourceTree {
	const resolve = (relative: string): string => path.join(rootDirectory, relative)
	return {
		read: (relative) => {
			try {
				return fs.readFileSync(resolve(relative), 'utf8')
			}
			catch {
				return null
			}
		},
		list: (relative) => {
			try {
				return fs.readdirSync(resolve(relative))
			}
			catch {
				return null
			}
		},
		isDirectory: (relative) => {
			try {
				return fs.statSync(resolve(relative))
					.isDirectory()
			}
			catch {
				return false
			}
		},
	}
}

function trackedFiles(): string[] {
	return execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
		.split(/\r?\n/)
		.map(line => line.trim())
		.filter(Boolean)
}

/**
 * Change classes the working tree does not currently contain, so that the check covers
 * the selector's conservative rules even when no such file happens to exist today. A
 * deleted source file is the important one: it has no tree entry left, which is the
 * case the selector cannot place and therefore measures everything.
 */
const syntheticProbes = [
	'Makefile',
	'renovate.json',
	'packages/new-package/package.json',
	'packages/new-package/tsdown.config.ts',
	'packages/internal/src/steps/isEmail/deleted-source.ts',
	'packages/valchecker/src/removed.ts',
]

/**
 * Paths that must not start the workflow. Without these the check would accept a
 * filter of plain `**`, which agrees with the selector by triggering on everything and
 * costs a 55-minute job on a typo in a Markdown file.
 */
const mustNotTrigger = [
	'README.md',
	'docs/guide/index.md',
	'docs/.vitepress/config.ts',
	'.claude/skills/valchecker-dev/SKILL.md',
	'.github/workflows/ci.yml',
	'scripts/check-issue-codes.ts',
	'type-performance/budget.json',
]

// Line endings normalized at the read, because a checkout's are the platform's and the rules
// below are about the file's content. This is the second time this check has been caught by
// it: `readEventPaths` used to match `on:` positionally and failed on a CRLF checkout, and
// the counterbalance rule below — which matches a shell block ending in `done` — failed the
// same way on `windows-latest` while every other platform passed. One `replaceAll` at the
// boundary is the fix for the class, not for either instance.
const workflowText = fs.readFileSync(path.join(root, workflowPath), 'utf8')
	.replaceAll('\r\n', '\n')
const filters = [compileFilter(workflowText, 'pull_request'), compileFilter(workflowText, 'push')]
const attribution: Attribution = buildAttribution(fileSystemTree(root))
const errors: string[] = []

// The last job is the only one allowed to turn measurements into a required-check result.
// Its executable shape is a fail-closed contract: comments, `if: false`, or a permissive
// `continue-on-error` cannot satisfy it merely by leaving the expected words in the YAML.
for (const problem of performanceVerdictWorkflowProblems(workflowText))
	errors.push(`${workflowPath}: ${problem}`)

if (attribution.problems.length > 0) {
	for (const problem of attribution.problems)
		errors.push(`the import graph this check classifies with is incomplete: ${problem}`)
}

const probes = [...new Set([...trackedFiles(), ...syntheticProbes, ...gateDefiningPaths])]
let fullRunPaths = 0
let measurementPaths = 0
for (const probe of probes.sort()) {
	const { effect } = classifyChange(probe, attribution)
	if (effect === 'full') {
		fullRunPaths++
		for (const filter of filters) {
			if (!triggers(filter, probe))
				errors.push(`${probe}: forces a full impact run, but does not match the \`on.${filter.event}\` paths filter of ${workflowPath}, so the run never starts`)
		}
		continue
	}
	// A step's bench file is the third thing that has to start this workflow, for a reason
	// neither of the other two covers: it cannot change either build, so nothing it does
	// reaches the bundle, but it declares the cells the gate measures. A rewritten cell that
	// never starts the job is a measurement change nothing ever looks at, and the first run
	// to include it would be some later diff's, which would attribute it to that diff.
	if (effect === 'measurement') {
		measurementPaths++
		for (const filter of filters) {
			if (!triggers(filter, probe))
				errors.push(`${probe}: declares benchmark cells the gate measures, but does not match the \`on.${filter.event}\` paths filter of ${workflowPath}, so a change to what is measured never starts a run`)
		}
	}
}

for (const probe of mustNotTrigger) {
	for (const filter of filters) {
		if (triggers(filter, probe))
			errors.push(`${probe}: cannot change either build, but matches the \`on.${filter.event}\` paths filter of ${workflowPath}, which spends a full job on it`)
	}
}

// `benchmarks/**` is the one deliberate asymmetry between the two events, and it is an
// argument rather than an oversight, so state it as an expectation instead of leaving
// the difference to be rediscovered.
const [pullRequest, push] = filters as [Filter, Filter]
if (!triggers(pullRequest, 'benchmarks/src/compare.mjs'))
	errors.push(`benchmarks/src/compare.mjs: must start the pull-request gate, where the canary is the only thing that would notice the measuring apparatus moving both sides at once`)
if (triggers(push, 'benchmarks/src/compare.mjs'))
	errors.push(`benchmarks/src/compare.mjs: must not start the post-merge run, which compares two revisions that build the same library and so has nothing to find`)

// Temporal pairing is implemented in `benchmarks/src/cells/pairing.mjs`, where unit tests
// pin the exact per-cell order. This workflow check therefore verifies the other half of the
// contract: **every** repetition loop used for screen or confirmation delegates both builds to
// that paired runner in one invocation. Two independent `cells` calls, even with AB/BA parity,
// are whole-side ordering and can separate one cell's observations by the rest of the shard.
const loops = [...workflowText.matchAll(/for repetition in[^\n]*\n([\s\S]*?)\n[ \t]*done\n/g)]
	.map(match => match[1]!)
	.filter(body => body.includes('pnpm --dir benchmarks cells'))
if (loops.length < 2)
	errors.push(`${workflowPath}: expected paired cell measurement loops for both screen and confirmation; found ${loops.length}`)
const conditionalSelectionRoleLines = [
	'selection_args=()',
	'if [[ -f artifacts/performance-impact/selection.json ]]; then',
	'selection_args=(--selection-roles',
	'../artifacts/performance-impact/selection.json',
]
if (conditionalSelectionRoleLines.some(line => !workflowText.includes(line))) {
	errors.push(`${workflowPath}: screen measurement must pass selection roles only when the PR scoping artifact exists; unscoped push runs have no selection.json and treat every measured row as affected`)
}

for (const [index, loop] of loops.entries()) {
	const label = `${workflowPath}: paired measurement loop ${index + 1} of ${loops.length}`
	for (const required of [
		'--repetition "$repetition"',
		'--baseline-dist "$BEFORE_DIST"',
		'--candidate-dist "$AFTER_DIST"',
		'--baseline-output',
		'--candidate-output',
		// Only the screen loop has the scope artifact; confirmation already selects exactly the
		// affected group members from the screen plan and may omit this input.
	]) {
		if (!loop.includes(required))
			errors.push(`${label} does not pass ${required} to the paired cell runner`)
	}
	if (loop.includes('run_side baseline') || loop.includes('run_side candidate'))
		errors.push(`${label} still invokes whole sides separately; one cell's baseline/candidate observations are not adjacent`)
	if (index === 0 && !loop.includes('selection_args'))
		errors.push(`${label} does not pass the conditionally resolved affected/canary role arguments to the paired cell runner`)
}

if (errors.length > 0) {
	console.error(`Performance Impact triggers disagree with scripts/impact-selection.ts (${errors.length} problem${errors.length === 1 ? '' : 's'}):`)
	for (const error of errors)
		console.error(`- ${error}`)
	process.exitCode = 1
}
else {
	console.log(`[impact-triggers] ${fullRunPaths} of ${probes.length} probed paths force a full run and ${measurementPaths} select their own step's cells, and every one of them starts both the pull-request and post-merge jobs; every screen/confirmation repetition delegates both builds to the tested adjacent-cell paired runner`)
}
