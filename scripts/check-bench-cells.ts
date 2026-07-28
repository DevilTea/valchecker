import { execFileSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { fileSystemTree } from './source-tree'
import { discoverSteps } from './step-inventory'

// What a step's benchmark cells must be, checked by driving them rather than by reading
// them.
//
// `benchmarks/src/step-audit.mjs` exists because a scenario's hand-maintained `steps: []`
// declaration was an unverifiable human claim: it drives every scenario's `build()`
// against a recording instance and compares what was called with what was declared. This
// gate is the same idea one level down. A comment saying a cell measures a success and a
// failure of its own step is worth nothing; executing the cell and reading the issue codes
// it produces is worth something.
//
// The runtime half runs in `benchmarks/src/cells/drive.mjs`, in a Node process whose
// `vitest` is a shim and whose `'../..'` resolves to the built dist — the same loader the
// impact gate measures through, so a cell that works here works there. This file decides
// which of its observations is a failure, because the rules and their messages belong in
// one place.
//
// Three of the rules below are weaker than the requirement they stand for, and their
// messages say so. What none of them can decide is whether a cell measures work worth
// measuring: a success cell on a degenerate input, a structure over an empty shape, and a
// transform whose enclosing collection dominates the unit all satisfy every rule here.
// That is review's job, and the reason the cell set is deliberately small enough to read.

const root = fileURLToPath(new URL('..', import.meta.url))
const driver = path.join(root, 'benchmarks/src/cells/drive.mjs')
const distEntry = path.join(root, 'packages/valchecker/dist/index.mjs')

/**
 * Steps that cannot have a success cell. One entry, and it is a property of the step
 * rather than of its benchmark: `never` fails every input by definition.
 */
const withoutSuccessCell: { step: string, reason: string }[] = [
	{
		step: 'never',
		reason: 'The `never` schema rejects every value by definition — its single success step returns a failure unconditionally — so a cell that succeeds cannot exist. Its failure cell measures the whole step.',
	},
]

const minimumReasonLength = 60

/**
 * The window the batch check decides. It is two orders of magnitude wider than the 1–10 µs
 * a cell should be sized to, on purpose: this gate runs on whatever machine `pnpm verify`
 * runs on, against whatever else that machine is doing, and a timing-based rule narrow
 * enough to enforce the target would fail on load rather than on a mis-sized batch. What
 * it catches is the order of magnitude — an unbatched 3 ns cell, or a batch of 100 wrapped
 * around 33 µs of work — and nothing finer. Whether a cell sits inside 1–10 µs is read off
 * `pnpm bench` on an idle machine, by a person.
 */
const minimumUnitNs = 50
const maximumUnitNs = 500_000

interface DrivenCell {
	id: string
	step: string
	file: string
	group: string
	batch: number
	async: boolean
	expect: { success?: boolean, constructs?: boolean, issues?: string[] }
	verification: string | null
	unitNs: number | null
}

interface Driven {
	steps: { step: string, file: string }[]
	cells: DrivenCell[]
}

function drive(): Driven {
	const stdout = execFileSync(process.execPath, [driver], {
		cwd: root,
		encoding: 'utf8',
		maxBuffer: 64 * 1024 * 1024,
		env: { ...process.env, VALCHECKER_DIST_URL: pathToFileURL(distEntry).href },
	})
	return JSON.parse(stdout) as Driven
}

/** The issue codes a step declares, read from its implementation the way every other gate reads them. */
function ownedIssueCodes(step: string, source: string): string[] {
	return [...new Set([...source.matchAll(new RegExp(`'(${step}:[a-z0-9_]+)'`, 'g'))].map(match => match[1]!))].sort()
}

const errors: string[] = []
const tree = fileSystemTree(root)
const { steps, problems } = discoverSteps(tree)
errors.push(...problems)

// ---------------------------------------------------------------------------------------
// The static half: what a bench file may import, and what may happen inside a timed region.
// ---------------------------------------------------------------------------------------

const allowedSpecifiers = new Set(['../..', '../../test-utils/step-bench'])
const constructionGroups = new Set(['construction', 'cold'])

/** Every call expression in a subtree, so a timed region's shape can be decided from it. */
function callsIn(node: ts.Node): ts.CallExpression[] {
	const calls: ts.CallExpression[] = []
	const visit = (current: ts.Node): void => {
		if (ts.isCallExpression(current))
			calls.push(current)
		ts.forEachChild(current, visit)
	}
	visit(node)
	return calls
}

/** Whether an expression is a member chain rooted at a plain identifier, with no calls in it. */
function isHoistedReference(node: ts.Expression): boolean {
	if (ts.isIdentifier(node))
		return true
	if (ts.isPropertyAccessExpression(node))
		return isHoistedReference(node.expression)
	if (ts.isElementAccessExpression(node))
		return ts.isStringLiteralLike(node.argumentExpression) && isHoistedReference(node.expression)
	return false
}

function stringProperty(cell: ts.ObjectLiteralExpression, name: string): string | null {
	for (const property of cell.properties) {
		if (ts.isPropertyAssignment(property) && property.name.getText() === name && ts.isStringLiteralLike(property.initializer))
			return property.initializer.text
	}
	return null
}

function runProperty(cell: ts.ObjectLiteralExpression): ts.PropertyAssignment | null {
	for (const property of cell.properties) {
		if (ts.isPropertyAssignment(property) && property.name.getText() === 'run')
			return property
	}
	return null
}

function checkBenchSource(step: string, relativePath: string, text: string): void {
	const source = ts.createSourceFile(relativePath, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS)

	for (const statement of source.statements) {
		if (!ts.isImportDeclaration(statement))
			continue
		// A type-only import is erased, so it cannot pull anything into the measured process.
		if (statement.importClause?.isTypeOnly === true)
			continue
		const specifier = ts.isStringLiteralLike(statement.moduleSpecifier) ? statement.moduleSpecifier.text : null
		if (specifier == null || !allowedSpecifiers.has(specifier)) {
			errors.push(
				`${relativePath}: imports '${specifier ?? '<not a literal>'}'. A step bench file may import values from '../..' and '../../test-utils/step-bench' only. `
				+ 'The impact gate loads this file in a plain Node process where \'../..\' resolves to the dist build under test; any other source import would pull the TypeScript '
				+ 'source into a process whose whole purpose is to measure the bundle. Use `import type` for a type.',
			)
		}
	}

	const stepBenchCalls = callsIn(source)
		.filter(call => ts.isIdentifier(call.expression) && call.expression.text === 'stepBench')
	if (stepBenchCalls.length !== 1) {
		errors.push(`${relativePath}: calls \`stepBench()\` ${stepBenchCalls.length} times; a step bench file declares one step's cells exactly once.`)
		return
	}
	const [declaration] = stepBenchCalls
	const [nameArgument, cellsArgument] = declaration!.arguments
	if (nameArgument == null || !ts.isStringLiteralLike(nameArgument) || nameArgument.text !== step) {
		errors.push(
			`${relativePath}: \`stepBench()\` must name the step as a string literal matching its directory ('${step}'). `
			+ 'The selector attributes a changed source file to a step and then looks up that step\'s cells by this name, so a mismatch produces cells no diff can select.',
		)
	}
	if (cellsArgument == null || !ts.isArrayLiteralExpression(cellsArgument)) {
		errors.push(`${relativePath}: \`stepBench()\` needs its cells as an array literal, so this gate can read each cell's group and timed region.`)
		return
	}

	for (const element of cellsArgument.elements) {
		if (!ts.isObjectLiteralExpression(element)) {
			errors.push(`${relativePath}: every cell must be an object literal; this gate reads \`group\` and \`run\` from the source and cannot follow a computed cell.`)
			continue
		}
		const name = stringProperty(element, 'name') ?? '<unnamed>'
		const group = stringProperty(element, 'group')
		if (group == null) {
			errors.push(`${relativePath}: cell '${name}' declares no literal \`group\`.`)
			continue
		}
		if (constructionGroups.has(group))
			continue
		const run = runProperty(element)
		if (run == null)
			continue
		const calls = callsIn(run.initializer)
		if (calls.length !== 1 || !isHoistedReference(calls[0]!.expression)) {
			errors.push(
				`${step}/${name}: its \`run\` does more than execute an already-built schema, so schema construction — or input construction — is inside the timed region. `
				+ 'A timed region must be exactly one call on a reference built above the cells, such as `() => schema.execute(input)`. '
				+ '31 of the previous generation of bench files constructed inside `run`, which dilutes an execution regression with allocation. '
				+ `Measure construction deliberately instead, with \`group: 'construction'\` or \`'cold'\`, where this rule does not apply. `
				+ 'What this cannot decide: whether the reference it calls was itself built lazily by a getter.',
			)
		}
	}
}

for (const step of steps) {
	const relativePath = `packages/internal/src/steps/${step.directory}/${step.directory}.bench.ts`
	const text = tree.read(relativePath)
	if (text == null) {
		errors.push(`${relativePath}: missing, so this step declares no benchmark cells and the impact gate cannot measure it.`)
		continue
	}
	checkBenchSource(step.name, relativePath, text)
}

// ---------------------------------------------------------------------------------------
// The runtime half: what the cells actually did.
// ---------------------------------------------------------------------------------------

let driven: Driven | null = null
try {
	driven = drive()
}
catch (error) {
	const detail = error instanceof Error && 'stderr' in error && typeof error.stderr === 'string' && error.stderr.length > 0
		? error.stderr
		: error instanceof Error ? error.message : String(error)
	errors.push(
		`benchmarks/src/cells/drive.mjs failed, so no cell could be verified. Run \`pnpm build\` first — the cells are driven against \`${path.relative(root, distEntry)}\`.\n${detail}`,
	)
}

const gateCells = driven?.cells.filter(cell => cell.group !== 'baseline') ?? []
const exempt = new Map(withoutSuccessCell.map(entry => [entry.step, entry.reason]))

for (const entry of withoutSuccessCell) {
	if (entry.reason.trim().length < minimumReasonLength)
		errors.push(`scripts/check-bench-cells.ts: the entry for '${entry.step}' needs a reason of at least ${minimumReasonLength} characters saying why a success cell cannot exist.`)
	if (!steps.some(step => step.name === entry.step))
		errors.push(`scripts/check-bench-cells.ts: the entry for '${entry.step}' names no built-in step. Remove it, or correct the name.`)
}

if (driven != null) {
	for (const cell of driven.cells) {
		if (cell.verification != null) {
			errors.push(
				`${cell.id}: ${cell.verification}. A cell's \`expect\` is checked by executing it, because that is the only thing that separates a cell measuring its own step `
				+ 'from one that fails earlier in the chain and never reaches it.',
			)
			continue
		}
		if (cell.unitNs != null && (cell.unitNs < minimumUnitNs || cell.unitNs > maximumUnitNs)) {
			errors.push(
				`${cell.id}: one measured unit is about ${(cell.unitNs / 1000).toFixed(2)} µs at \`batch: ${cell.batch}\`, outside the ${minimumUnitNs / 1000}–${maximumUnitNs / 1000} µs `
				+ 'window this gate can decide. Size `batch` so the unit is roughly 1–10 µs: below that the harness\'s own clock reads dominate the measurement (they cost about '
				+ '15 ns every 16 iterations, which is 88% of a 2.6 ns cell), and far above it the number stops describing one operation. '
				+ 'What this cannot decide: whether the unit is inside 1–10 µs, because it shares a machine with the rest of `pnpm verify`.',
			)
		}
	}

	for (const step of steps) {
		const cells = gateCells.filter(cell => cell.step === step.name)
		if (cells.length === 0) {
			errors.push(`${step.name}: declares no cell the impact gate measures. A \`baseline\` cell is excluded from the gate, so a file holding only those measures nothing.`)
			continue
		}

		const succeeds = cells.some(cell => cell.expect.success === true || cell.expect.constructs === true)
		if (!succeeds && !exempt.has(step.name)) {
			errors.push(
				`${step.name}: no cell of it succeeds. A step's representative work is its success path, and a benchmark of only its failure path measures issue construction. `
				+ 'If the step genuinely cannot succeed, add it to `withoutSuccessCell` in scripts/check-bench-cells.ts with the reason.',
			)
		}
		if (succeeds && exempt.has(step.name))
			errors.push(`scripts/check-bench-cells.ts: the \`withoutSuccessCell\` entry for '${step.name}' is stale — it now has a cell that succeeds. Remove the entry.`)

		const owned = ownedIssueCodes(step.name, step.source)
		if (owned.length === 0)
			continue
		const producesOwn = cells.some(cell => (cell.expect.issues ?? []).some(code => code.startsWith(`${step.name}:`)))
		if (!producesOwn) {
			errors.push(
				`${step.name}: no cell produces one of its own issue codes (${owned.join(', ')}). A failure cell that fails earlier in the chain measures the step that rejected the `
				+ 'input, not this one — which is what `toString`, `toLowercase`, `toTrimmed*`, `transform`, `toLength`, `toSliced`, and `toSorted` all did before this gate existed. '
				+ 'What this cannot decide: whether the failure input is representative, or whether the step\'s other issue codes are worth a cell — deliberately not required.',
			)
		}
	}
}

if (errors.length > 0) {
	console.error(errors.join('\n\n'))
	process.exitCode = 1
}
else {
	const asyncCells = gateCells.filter(cell => cell.async).length
	const groups = new Map<string, number>()
	for (const cell of gateCells)
		groups.set(cell.group, (groups.get(cell.group) ?? 0) + 1)
	const baselines = (driven?.cells.length ?? 0) - gateCells.length
	console.log(
		`Every step's benchmark cells verify: ${gateCells.length} gate cells across ${steps.length} steps `
		+ `(${asyncCells} asynchronous, ${baselines} local-only baseline cells excluded), `
		+ `in ${[...groups.entries()].sort()
			.map(([group, count]) => `${group} ${count}`)
			.join(', ')}.`,
	)
}
