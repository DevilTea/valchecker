import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

// A built-in step is more than its implementation, and until this gate existed almost none of the
// rest was required. A step could ship with only `<dir>/<dir>.ts` and pass every check in
// `pnpm verify`: no colocated test, no focused benchmark, no export, no line in the API reference.
// The conventions held by discipline and by `scripts/generate-bench-files.ts`, which creates a
// bench and then never looks again.
//
// The pieces already guarded elsewhere are deliberately not repeated here:
//
// - `Meta.Name`, its agreement with the directory, and the issue-code grammar — `check-issue-codes`;
// - the PluginDef JSDoc template — `check-step-jsdoc`;
// - the parameter style and the `/* @__NO_SIDE_EFFECTS__ */` marker — `check-step-parameter-style`;
// - `<dir>/index.ts` — `packages/internal/src/steps/index.ts` imports the directory, so a missing
//   barrel is `TS2307: Cannot find module './<dir>'` from `pnpm typecheck` and `pnpm build`;
// - the runtime `code:` literal matching the declared `ExecutionIssue<…>` union — the compiler
//   rejects a mismatch with `TS2322`, so no scan can add anything;
// - a cross-library scenario comparing the step against a competitor — `check-benchmark-coverage`.
//
// What is left is what this gate checks, and every rule below was confirmed to fail on a
// deliberately incomplete tree before it was written. Failures are collected per step and printed
// together, so adding a step means one wall listing everything it still needs rather than one
// requirement per CI run.
//
// Two derivations are reused rather than reinvented. Step names come from each `Meta.Name`, the
// same regular expression `check-issue-codes` and `check-benchmark-coverage` read. Public exports
// come from `api-surface.json`, which `check-api-surface` regenerates from the built runtime and
// declarations; scanning the barrel instead would only confirm that a line exists, not that the
// name reaches the published package under the identifier the step declares (`null` and
// `undefined` are exported as `null_` and `undefined_`).
//
// This gate reads only source, `docs/`, and `api-surface.json`. It imports nothing from
// `benchmarks/`, so it runs with `benchmarks/node_modules` absent — that directory is installed
// separately with `--ignore-workspace` and may not exist.
//
// Everything is matched against whole-file text or per-span text, never against an exact line, so
// a CRLF checkout reads the same as an LF one.

const root = process.cwd()
const stepsRoot = path.join(root, 'packages/internal/src/steps')
const docsApiRoot = path.join(root, 'docs/api')
const apiSurfacePath = path.join(root, 'api-surface.json')
const catalogPage = 'overview.md'
const errors: string[] = []

interface Step {
	/** Directory name under `packages/internal/src/steps`, which `Meta.Name` must equal. */
	directory: string
	/** The public step name, from `Meta.Name`. */
	name: string
	/** The exported plugin identifier, which differs from the name for reserved words. */
	exportIdentifier: string
	/** Every issue code the step declares it owns. */
	codes: string[]
	/** Text of every colocated `*.test.ts`, concatenated. */
	testText: string
}

interface ApiSurface {
	[packageName: string]: { runtime?: unknown }
}

/** Every issue code declared through `ExecutionIssue<'…'>`, the way `check-issue-codes` reads them. */
function declaredCodes(source: string): string[] {
	return [...new Set([...source.matchAll(/ExecutionIssue<\s*'([^']+)'/g)].map(match => match[1]!))]
}

function readSteps(): Step[] {
	const steps: Step[] = []

	for (const directory of fs.readdirSync(stepsRoot)
		.sort()) {
		const stepDirectory = path.join(stepsRoot, directory)
		if (!fs.statSync(stepDirectory)
			.isDirectory()) {
			continue
		}

		const mainFile = path.join(stepDirectory, `${directory}.ts`)
		if (!fs.existsSync(mainFile))
			continue

		const source = fs.readFileSync(mainFile, 'utf8')
		const relative = `packages/internal/src/steps/${directory}/${directory}.ts`
		const name = /^\tName: '([^']+)'/m.exec(source)?.[1]
		const exportIdentifier = /^export const (\w+) = implStepPlugin\b/m.exec(source)?.[1]

		// Both are the anchors every other rule hangs from, so a step missing either is a hard
		// failure rather than a step this gate quietly stops checking.
		if (name == null) {
			errors.push(`${relative}: no \`Meta.Name\` found, so this gate cannot tell which step it is.`)
			continue
		}
		if (exportIdentifier == null) {
			errors.push(`${relative}: no \`export const <name> = implStepPlugin\` found, so this gate cannot tell which identifier the step publishes.`)
			continue
		}

		const testText = fs.readdirSync(stepDirectory)
			.filter(entry => entry.endsWith('.test.ts'))
			.sort()
			.map(entry => fs.readFileSync(path.join(stepDirectory, entry), 'utf8'))
			.join('\n')

		steps.push({ directory, name, exportIdentifier, codes: declaredCodes(source), testText })
	}

	return steps
}

/** Every Markdown page under `docs/api`, keyed by its path relative to that directory. */
function readApiReference(): Map<string, string> {
	const pages = new Map<string, string>()

	function visit(directory: string): void {
		for (const entry of fs.readdirSync(directory, { withFileTypes: true })
			.sort((a, b) => a.name.localeCompare(b.name))) {
			const entryPath = path.join(directory, entry.name)
			if (entry.isDirectory()) {
				if (entry.name !== 'node_modules')
					visit(entryPath)
				continue
			}
			if (entry.name.endsWith('.md')) {
				pages.set(path.relative(docsApiRoot, entryPath)
					.split(path.sep)
					.join('/'), fs.readFileSync(entryPath, 'utf8'))
			}
		}
	}

	visit(docsApiRoot)
	return pages
}

/**
 * The contents of every inline code span on a page.
 *
 * The reference writes API names in code spans — table cells, bullets, and headings alike — so a
 * step is looked for there rather than in prose. Fenced blocks cannot produce a false span,
 * because a span may not contain a backtick or a newline.
 */
function codeSpans(page: string): string[] {
	return [...page.matchAll(/`([^`\n]+)`/g)].map(match => match[1]!)
}

/**
 * Whether a page documents the step in call form.
 *
 * The name must be followed by `(` or `<` and must not continue an identifier, so `isEmpty` cannot
 * be satisfied by `isNotEmpty(`. A receiver is allowed, because the reference documents chained
 * steps against the schema that offers them, as in `bigint().toSafeNumber(options?)`.
 */
function documents(spans: string[], name: string): boolean {
	const pattern = new RegExp(`(?<![\\w$])${name}\\s*[(<]`)
	return spans.some(span => pattern.test(span))
}

function readPublicExports(): Record<string, Set<string>> {
	const surface = JSON.parse(fs.readFileSync(apiSurfacePath, 'utf8')) as ApiSurface
	const exports: Record<string, Set<string>> = {}

	for (const packageName of ['@valchecker/internal', 'valchecker']) {
		const runtime = surface[packageName]?.runtime
		if (!Array.isArray(runtime) || runtime.length === 0)
			throw new Error(`api-surface.json: no runtime export list for '${packageName}'. Regenerate it with \`pnpm api:surface:update\`.`)
		exports[packageName] = new Set(runtime as string[])
	}

	return exports
}

const steps = readSteps()
const pages = readApiReference()
const catalog = pages.get(catalogPage)
if (catalog == null)
	throw new Error(`docs/api/${catalogPage} is missing; it is the catalog every built-in step must appear in.`)

const catalogSpans = codeSpans(catalog)
const detailSpans = [...pages]
	.filter(([page]) => page !== catalogPage)
	.flatMap(([, text]) => codeSpans(text))
const referenceText = [...pages.values()].join('\n')
const publicExports = readPublicExports()

let complete = 0
for (const step of steps) {
	const stepPath = `packages/internal/src/steps/${step.directory}`
	const missing: string[] = []

	if (!fs.existsSync(path.join(stepsRoot, step.directory, `${step.directory}.test.ts`)))
		missing.push(`no colocated \`${step.directory}.test.ts\`. Coverage alone does not catch this: a step is routinely executed by other steps' tests, so its file can stay at 100% with no test of its own.`)

	if (!fs.existsSync(path.join(stepsRoot, step.directory, `${step.directory}.bench.ts`)))
		missing.push(`no focused \`${step.directory}.bench.ts\`. \`pnpm exec tsx ./scripts/generate-bench-files.ts\` writes a starting point; replace its placeholder inputs with ones that exercise this step.`)

	for (const [packageName, identifiers] of Object.entries(publicExports)) {
		if (!identifiers.has(step.exportIdentifier)) {
			missing.push(`\`${step.exportIdentifier}\` is not a runtime export of '${packageName}' in api-surface.json. Add the step to \`packages/internal/src/steps/index.ts\` if it is missing there, then run \`pnpm api:surface:update\`.`)
		}
	}

	if (!documents(catalogSpans, step.name))
		missing.push(`\`${step.name}()\` is not listed in docs/api/${catalogPage}, the catalog of the public API.`)

	if (!documents(detailSpans, step.name))
		missing.push(`\`${step.name}()\` has no entry on a docs/api reference page other than ${catalogPage}, so the catalog points at nothing that describes it.`)

	for (const code of step.codes) {
		if (!referenceText.includes(code))
			missing.push(`the owned issue code \`${code}\` appears nowhere under docs/api. A consumer handling this failure has nothing to read.`)
		if (!step.testText.includes(code))
			missing.push(`the owned issue code \`${code}\` is asserted by no test in this directory, so a change to it would break consumers with every test still green.`)
	}

	if (missing.length === 0) {
		complete++
		continue
	}

	errors.push(`${stepPath}: the step '${step.name}' is incomplete.\n${missing.map(item => `  - ${item}`)
		.join('\n')}`)
}

if (errors.length > 0) {
	console.error(errors.join('\n'))
	process.exitCode = 1
}
else {
	console.log(`Built-in steps are complete: ${complete} steps each have a colocated test, a focused benchmark, a public export, a catalog and a reference entry, and documented, asserted issue codes.`)
}
