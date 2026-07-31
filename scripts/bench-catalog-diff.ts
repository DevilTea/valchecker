import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { catalogIdDiff, staticCatalog } from './bench-catalog-ids'

// `pnpm bench:catalog-diff --base <ref> --head <ref>`: which benchmark cells the head declares
// that the base did not, and which the base declared that the head does not.
//
// Both sides are read with `git show <ref>:<path>` and parsed, never executed — the same way
// `scripts/select-impact-scenarios.ts` reads a revision for `inert-change.ts`. That is the whole
// point: the executable catalog can only ever know the candidate's cells, because the candidate
// ref owns the apparatus, so a deleted or renamed cell is invisible to it. This reads the
// declaration instead of running it and can therefore see a revision it cannot build.
//
// It needs no build, no `benchmarks/node_modules`, and no `VALCHECKER_DIST_URL`. It needs the
// two revisions to be present in the repository, which is why the workflow runs it in the
// measuring job — that job checks out with `fetch-depth: 0` and resolves both shas.

const root = fileURLToPath(new URL('..', import.meta.url))
const stepsRoot = 'packages/internal/src/steps'

interface Options {
	base: string | null
	head: string | null
	output: string | null
}

function parseArguments(argv: string[]): Options {
	const options: Options = { base: null, head: null, output: null }
	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index]
		const value = argv[index + 1]
		if (argument === '--base' && value != null) {
			options.base = value
			index++
		}
		else if (argument === '--head' && value != null) {
			options.head = value
			index++
		}
		else if (argument === '--output' && value != null) {
			options.output = path.resolve(root, value)
			index++
		}
		else {
			throw new Error(`Unknown or incomplete argument: ${argument}`)
		}
	}
	if (options.base == null || options.head == null)
		throw new Error('--base <ref> and --head <ref> are both required: this compares the cells two revisions declare')
	return options
}

/** Every `<name>.bench.ts` a revision holds, from its tree rather than from the working copy. */
function benchPaths(ref: string): string[] {
	const listed = execFileSync('git', ['ls-tree', '-r', '--name-only', ref, '--', stepsRoot], {
		cwd: root,
		encoding: 'utf8',
		maxBuffer: 32 * 1024 * 1024,
	})
	return listed.split('\n')
		.filter(line => line.endsWith('.bench.ts'))
		.sort()
}

function readRevision(ref: string): { path: string, text: string }[] {
	return benchPaths(ref)
		.map(filePath => ({
			path: filePath,
			text: execFileSync('git', ['show', `${ref}:${filePath}`], { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }),
		}))
}

const options = parseArguments(process.argv.slice(2))
const baseFiles = readRevision(options.base!)
const diff = catalogIdDiff(staticCatalog(baseFiles), staticCatalog(readRevision(options.head!)), baseFiles.length)
const result = { schemaVersion: 2, base: options.base, head: options.head, ...diff }

if (options.output != null) {
	fs.mkdirSync(path.dirname(options.output), { recursive: true })
	fs.writeFileSync(options.output, `${JSON.stringify(result, null, 2)}\n`)
}

console.error(`[catalog-diff] ${diff.baseCells} cells at ${options.base} → ${diff.headCells} at ${options.head}: `
	+ `${diff.added.length} added, ${diff.removed.length} removed`)
for (const id of diff.added)
	console.error(`[catalog-diff] added: ${id}`)
for (const id of diff.removed)
	console.error(`[catalog-diff] removed: ${id}`)
for (const problem of diff.problems)
	console.error(`[catalog-diff] unreadable: ${problem}`)
if (diff.toleratedBaseline != null)
	console.error(`[catalog-diff] tolerated: ${diff.toleratedBaseline}`)
if (options.output == null)
	process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)

// An audit that reports itself incomplete and exits 0 is the same defect as a `removed 0` that
// could never see a removal. The file is still written, so the report can say what was wrong.
if (diff.fatalProblems.length > 0) {
	console.error(`\n[catalog-diff] ${diff.fatalProblems.length} problem${diff.fatalProblems.length === 1 ? '' : 's'} make this audit unusable rather than `
		+ 'merely incomplete. A revision whose cell declarations cannot be read statically cannot be diffed against, and the runtime comparison can never '
		+ 'see a deleted or renamed cell — so there would be no check on the benchmark contract at all.')
	process.exitCode = 1
}
