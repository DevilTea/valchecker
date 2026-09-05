import type { SourceTree } from './source-tree'
import ts from 'typescript'

/**
 * Which benchmark scenarios one diff can move, so the Performance Impact gate can
 * measure those instead of all of them.
 *
 * The gate compares two builds of `packages/valchecker/dist/index.mjs` produced by
 * one fixed set of benchmark scripts. Only what differs between those two builds can
 * produce a change in a number, so the question is not "what did the pull request
 * touch" but "what can the touched files put into that bundle". The mapping is:
 *
 *   changed file → the steps that transitively import it → the scenarios whose
 *   declared `steps` name any of those steps.
 *
 * **Attribution follows imports, never directories.** `steps/isIsoDate/iso-calendar-date.ts`
 * is reached by `isIsoDate` and by `isIsoDateTime`, and `steps/isBase64Url/base64url.ts`
 * by `isBase64Url` and by `isJwt`; a rule keyed on the directory would miss the second
 * step in each pair and silently drop its scenarios.
 *
 * **Under-selection is the failure mode.** A scenario that should have run and did
 * not is a regression reaching `main` with a green gate, while an over-selected
 * scenario only costs time, so every judgement here breaks toward measuring more:
 * anything this module cannot place is a full run, and a canary set runs regardless
 * of the diff.
 *
 * **A rule about a file is a rule about what the file means.** Every judgement below is
 * asked of a path whose two revisions differ in something a build or this gate can read.
 * `inert-change.ts` decides that, the caller passes the answer in as `inertPaths`, and a
 * path it proves inert is ignored here — it neither forces a full run nor selects a step.
 *
 * Nothing here reads the filesystem or git. The tree is injected, which is what lets
 * the tests drive the whole mapping over a small synthetic repository whose expected
 * answers are written out by hand.
 */

export type { SourceTree } from './source-tree'

/** One scenario, as `benchmarks/src/scenarios/index.mjs` reports it. */
export interface CatalogEntry {
	id: string
	group: string
	steps: string[]
}

export interface Attribution {
	/** Files the gate's build entry reaches, so exactly the files that can be in the measured bundle. */
	shipped: Set<string>
	/** For each shipped file, the public names of the steps that transitively import it. */
	stepsByFile: Map<string, Set<string>>
	/**
	 * Each step's own `<name>.bench.ts`, mapped to that step.
	 *
	 * A bench file is the third kind of changed file this gate has to place, and neither
	 * of the first two fits. It cannot change either build — it is not reachable from the
	 * build entry, so nothing in it reaches the bundle — but it *is* the measurement now,
	 * so treating it as inert would let a rewritten cell go unmeasured, and treating it as
	 * unplaceable would buy a full run for editing one step's benchmark. It selects its own
	 * step's cells: neither nothing nor everything.
	 */
	cellStepsByFile: Map<string, string>
	/** Shipped files that are nothing but re-export statements. */
	barrels: Set<string>
	/** Every TypeScript file present under a package's `src` directory, shipped or not. */
	packageSourceFiles: Set<string>
	/** Every built-in step's public `Meta.Name`. */
	stepNames: Set<string>
	/**
	 * Reasons the attribution cannot be trusted as complete. A non-empty list forces
	 * a full run: a specifier this scan could not resolve is an import edge missing
	 * from the graph, and a missing edge is exactly how a scenario goes unmeasured.
	 */
	problems: string[]
}

/**
 * The package entry the gate actually measures. `benchmarks/src/adapters/valchecker.mjs`
 * imports `packages/valchecker/dist/index.mjs`, and `tsdown` bundles that from this one
 * entry, so a source file this entry does not reach cannot appear in either build.
 */
export const gateBuildEntry = 'packages/valchecker/src/index.ts'

const packagesRoot = 'packages'
const stepsRoot = 'packages/internal/src/steps'

/**
 * Source files that do not ship, used only for a path the diff *deleted* — a deleted
 * file has no tree entry to compute reachability from. For every path that still
 * exists the graph decides, and `buildAttribution` records a problem if it ever finds
 * one of these reachable from the build entry, because then the pattern would be
 * excusing a file that really is in the bundle.
 */
export function isNonShippingSourcePath(path: string): boolean {
	return /^packages\/[^/]+\/src\//.test(path)
		&& (/\.(?:test|bench)\.tsx?$/.test(path) || path.includes('/src/test-utils/'))
}

function isPackageSourcePath(path: string): boolean {
	return /^packages\/[^/]+\/src\/.+\.tsx?$/.test(path)
}

/**
 * Paths that cannot change either build, enumerated rather than inferred, because the
 * default for an unrecognised path is a full run.
 *
 * Every entry is here for the same reason: `pnpm build` runs `tsdown` per package over
 * `src/index.ts`, so the only inputs to the two bundles are the reachable package
 * sources and the configuration that decides how they are compiled and which
 * dependencies are installed. Nothing below is such an input.
 *
 * - `benchmarks/**` is the measuring apparatus, and one checked-out copy of it measures
 *   both revisions, so a change there moves both sides together and cannot make a
 *   regression in the library invisible. (It can make the *mapping* wrong, since the
 *   `steps` declarations live there — that risk is the canary's, not this rule's.)
 * - `docs/**`, `type-performance/**`, `artifacts/**`, `coverage/**` and Markdown
 *   anywhere are not imported by any package build.
 * - `scripts/**`, `.github/**`, `.agents/**`, `.claude/**`, editor and lint
 *   configuration do not participate in `tsdown`'s compilation. The files that decide
 *   how this gate itself runs are the exception and are matched before this list.
 */
const cannotChangeTheBuild: RegExp[] = [
	/^docs\//,
	/^benchmarks\//,
	/^type-performance\//,
	/^artifacts\//,
	/^coverage\//,
	/^scripts\//,
	/^\.github\//,
	/^\.agents\//,
	/^\.claude\//,
	/^\.vscode\//,
	/\.md$/,
	/^LICENSE$/,
	/^\.editorconfig$/,
	/^\.gitignore$/,
	/^\.npmrc$/,
	/^eslint\.config\.js$/,
	/^vitest\.config\.ts$/,
	/^api-surface\.json$/,
]

/**
 * Changing what decides which scenarios run makes every scenario run. It costs one
 * full gate on the pull request that edits the gate, and it means a selection rule can
 * never be introduced or relaxed without the complete comparison being visible once.
 *
 * That second sentence only holds while the workflow's own `paths` filters start the
 * job for these files. They are inside `scripts/**` and `.github/**`, which the list
 * above excludes, so the filters have to re-include them explicitly — and did not,
 * for the first version of this gate, which made this the rule that could never fire.
 * `scripts/check-impact-triggers.ts` now fails when a path this module classifies as a
 * full run does not start the workflow.
 *
 * The rule is about what these files *decide*, not about their bytes: a revision pair
 * that `inert-change.ts` proves identical once comments and formatting are gone cannot
 * decide anything differently, and forcing a 55-minute comparison for a comment was
 * costing exactly that. `inert-change.ts` is itself on the list, because it now decides
 * part of the scope too.
 */
export const gateDefiningPaths: ReadonlySet<string> = new Set([
	'.github/workflows/performance-impact.yml',
	'.github/actions/setup/action.yml',
	'scripts/impact-selection.ts',
	'scripts/inert-change.ts',
	'scripts/select-impact-scenarios.ts',
	// `buildAttribution` reads the tree through this, so a change to how files are
	// read or resolved can change which steps a diff reaches without touching any
	// rule above.
	'scripts/source-tree.ts',
])

function parse(path: string, text: string): ts.SourceFile {
	return ts.createSourceFile(path, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS)
}

/**
 * Every module specifier a file imports from, taken from the TypeScript AST rather
 * than from a text search. The distinction matters here: this repository's grammar
 * files are dense with regular expressions containing quotes and slashes, which a
 * scanner that strips comments and strings by hand mis-tokenizes, and a mis-tokenized
 * file is one whose imports go missing.
 *
 * A specifier the scan cannot read as a literal is reported instead of skipped.
 */
function moduleSpecifiersOf(path: string, source: ts.SourceFile, problems: string[]): string[] {
	const specifiers: string[] = []

	const visit = (node: ts.Node): void => {
		if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
			const specifier = node.moduleSpecifier
			if (specifier != null) {
				if (ts.isStringLiteral(specifier))
					specifiers.push(specifier.text)
				else
					problems.push(`${path}: an import declaration whose specifier is not a string literal`)
			}
		}
		else if (ts.isImportEqualsDeclaration(node)) {
			problems.push(`${path}: \`import =\` is not resolved by this scan`)
		}
		else if (ts.isCallExpression(node)) {
			const callee = node.expression
			const dynamic = callee.kind === ts.SyntaxKind.ImportKeyword
			const required = ts.isIdentifier(callee) && callee.text === 'require'
			if (dynamic || required) {
				const argument = node.arguments[0]
				if (argument != null && ts.isStringLiteralLike(argument))
					specifiers.push(argument.text)
				else
					problems.push(`${path}: ${dynamic ? 'a dynamic import' : 'a require call'} whose specifier this scan cannot resolve`)
			}
		}
		ts.forEachChild(node, visit)
	}

	ts.forEachChild(source, visit)
	return specifiers
}

/** A file made of nothing but `export … from '…'`, which has no runtime code of its own. */
function isBarrel(source: ts.SourceFile): boolean {
	return source.statements.length > 0
		&& source.statements.every(statement => ts.isExportDeclaration(statement) && statement.moduleSpecifier != null)
}

function dirname(path: string): string {
	const index = path.lastIndexOf('/')
	return index < 0 ? '' : path.slice(0, index)
}

function normalize(path: string): string {
	const parts: string[] = []
	for (const part of path.split('/')) {
		if (part === '' || part === '.')
			continue
		if (part === '..')
			parts.pop()
		else
			parts.push(part)
	}
	return parts.join('/')
}

/** The workspace packages, so `@valchecker/internal` resolves to its source entry rather than to `dist`. */
function workspaceEntries(tree: SourceTree): Map<string, string> {
	const entries = new Map<string, string>()
	for (const directory of tree.list(packagesRoot) ?? []) {
		const manifest = tree.read(`${packagesRoot}/${directory}/package.json`)
		if (manifest == null)
			continue
		const name = (JSON.parse(manifest) as { name?: string }).name
		if (name != null)
			entries.set(name, `${packagesRoot}/${directory}/src/index.ts`)
	}
	return entries
}

function resolveSpecifier(tree: SourceTree, from: string, specifier: string, workspace: Map<string, string>): string | 'external' | null {
	const workspaceEntry = workspace.get(specifier)
	if (workspaceEntry != null)
		return workspaceEntry
	if (!specifier.startsWith('.'))
		return 'external'

	const base = normalize(`${dirname(from)}/${specifier}`)
	const candidates = [
		base,
		`${base}.ts`,
		`${base}.tsx`,
		`${base}/index.ts`,
		// A `.js` specifier in TypeScript source names the `.ts` file beside it.
		base.endsWith('.js') ? `${base.slice(0, -3)}.ts` : null,
	]
	for (const candidate of candidates) {
		if (candidate != null && !tree.isDirectory(candidate) && tree.read(candidate) != null)
			return candidate
	}
	return null
}

interface StepEntry {
	/** The public `Meta.Name`, which is what a scenario's `steps` declares. */
	name: string
	/** The step's main module, the root of its reachable set. */
	entry: string
}

/**
 * Each step directory with the public name declared inside it. Keyed by directory
 * rather than by name because the two are separate facts — the barrel attribution below
 * knows the directory and needs the name — and a directory that ever stops matching its
 * `Meta.Name` must not silently lose its barrel.
 */
function stepEntryPoints(tree: SourceTree, problems: string[]): Map<string, StepEntry> {
	const entries = new Map<string, StepEntry>()
	for (const directory of tree.list(stepsRoot) ?? []) {
		const main = `${stepsRoot}/${directory}/${directory}.ts`
		const text = tree.read(main)
		if (text == null)
			continue
		const name = /^\tName: '([^']+)'/m.exec(text)?.[1]
		if (name == null) {
			problems.push(`${main}: no \`Meta.Name\`, so the scenarios of this step cannot be found`)
			continue
		}
		entries.set(directory, { name, entry: main })
	}
	return entries
}

function walkSourceFiles(tree: SourceTree, directory: string, out: string[]): string[] {
	for (const entry of tree.list(directory) ?? []) {
		const path = `${directory}/${entry}`
		if (tree.isDirectory(path))
			walkSourceFiles(tree, path, out)
		else if (/\.tsx?$/.test(path))
			out.push(path)
	}
	return out
}

/**
 * The import graph of the measured bundle, the steps each of its files belongs to, and
 * every reason the result might be incomplete.
 */
export function buildAttribution(tree: SourceTree): Attribution {
	const problems: string[] = []
	const workspace = workspaceEntries(tree)
	const imports = new Map<string, string[]>()
	const barrels = new Set<string>()

	if (tree.read(gateBuildEntry) == null)
		problems.push(`${gateBuildEntry}: the gate's build entry is missing, so nothing can be attributed`)

	const pending = [gateBuildEntry]
	while (pending.length > 0) {
		const path = pending.pop()!
		if (imports.has(path))
			continue
		const text = tree.read(path)
		if (text == null) {
			problems.push(`${path}: reachable from the build entry but unreadable`)
			imports.set(path, [])
			continue
		}
		const source = parse(path, text)
		if (isBarrel(source))
			barrels.add(path)
		const targets: string[] = []
		for (const specifier of moduleSpecifiersOf(path, source, problems)) {
			const resolved = resolveSpecifier(tree, path, specifier, workspace)
			if (resolved === 'external')
				continue
			if (resolved == null) {
				problems.push(`${path}: cannot resolve '${specifier}'`)
				continue
			}
			targets.push(resolved)
			pending.push(resolved)
		}
		imports.set(path, targets)
	}

	const shipped = new Set(imports.keys())
	const stepEntries = stepEntryPoints(tree, problems)
	const stepsByFile = new Map<string, Set<string>>()
	for (const path of shipped)
		stepsByFile.set(path, new Set())

	for (const { name, entry } of stepEntries.values()) {
		if (!shipped.has(entry)) {
			problems.push(`${entry}: the '${name}' step is not reachable from the build entry`)
			continue
		}
		const seen = new Set<string>()
		const stack = [entry]
		while (stack.length > 0) {
			const path = stack.pop()!
			if (seen.has(path))
				continue
			seen.add(path)
			stepsByFile.get(path)
				?.add(name)
			for (const next of imports.get(path) ?? [])
				stack.push(next)
		}
	}

	// A step's own barrel re-exports the step rather than being imported by it, so
	// reachability from the entry point never reaches it. It belongs to that step and
	// to no other, which is the one place a directory says something imports does not.
	for (const path of shipped) {
		const directory = /^packages\/internal\/src\/steps\/([^/]+)\/index\.ts$/.exec(path)?.[1]
		const step = directory == null ? undefined : stepEntries.get(directory)
		if (step != null) {
			stepsByFile.get(path)
				?.add(step.name)
		}
	}

	// The pattern is only consulted for deleted files, and only in the direction that
	// excuses a path from forcing a full run. If a file it excuses is in the bundle
	// after all, that excuse is wrong and the attribution cannot be trusted.
	// Each package's own `src` only. Walking `packages/` wholesale would descend into
	// the installed `node_modules` of each workspace package, whose thousands of
	// dependency declaration files are neither this repository's source nor anything a
	// diff can name.
	const packageSourceFiles = new Set((tree.list(packagesRoot) ?? [])
		.filter(directory => tree.isDirectory(`${packagesRoot}/${directory}/src`))
		.flatMap(directory => walkSourceFiles(tree, `${packagesRoot}/${directory}/src`, [])))
	for (const path of packageSourceFiles) {
		if (isNonShippingSourcePath(path) && shipped.has(path))
			problems.push(`${path}: treated as not shipping, but the build entry reaches it`)
	}

	const stepNames = new Set([...stepEntries.values()].map(step => step.name))
	const cellStepsByFile = new Map<string, string>()
	for (const [directory, step] of stepEntries) {
		const bench = `${stepsRoot}/${directory}/${directory}.bench.ts`
		if (tree.read(bench) != null)
			cellStepsByFile.set(bench, step.name)
	}
	return { shipped, stepsByFile, barrels, packageSourceFiles, stepNames, cellStepsByFile, problems }
}

/**
 * The scenarios that run whatever the diff says.
 *
 * `construction` and `cold` are taken whole. Module initialisation, step registration,
 * and the shape of the prototype every schema shares are not attributable to a step
 * through its execution cells at all — a cell builds its schema at module scope, so the
 * timed region never sees that work — and the construction and cold cells are where it
 * shows. There are five of them, so taking them whole is cheap.
 *
 * The named cells are the core execution machinery every other cell is built on: the
 * per-call floor, the string pipeline, the object walk, issue construction with and
 * without a path, the deferred message chain, the collect-all traversal, and the
 * asynchronous path. They exist so that a broad regression cannot hide behind a mapping
 * that missed it. They are health controls only: a scoped product group estimator may
 * consume only cells the diff can move, so canary coverage never pads its sample size.
 *
 * They are listed rather than flagged in the bench files on purpose. A `canary: true` on
 * a cell would be a claim each step's author makes about the core, and a core path
 * nobody flagged would silently leave the canary — which is the failure mode this list
 * exists to prevent. `selectImpactScenarios` throws when a name here is not in the
 * catalog, so the list cannot rot into one that does not run.
 */
export const canaryGroups = ['construction', 'cold']

export const canaryScenarios = [
	// warm/success — the per-call floor with nothing validated in front of it, the two
	// shapes every other success cell extends, and the delegation layer.
	'unknown/passes',
	'string/valid',
	'object/valid',
	'array/valid',
	// warm/failure/library-default — issue construction at the top level and inside a
	// structure, where the path is built, plus both halves of the deferred message chain.
	'string/invalid',
	'object/missing-key',
	'string/custom-message',
	'object/enclosing-message',
	// warm/failure/all — the dual traversal policy the structures share.
	'object/collect-all',
	'array/collect-all',
	// warm/async/success — the promise machinery, reached from a callback, from a
	// structure's child, and from the step that forces it.
	'check/async-passes',
	'array/async-valid',
	'toAsync/valid',
]

export const minimumScenariosPerGroup = 2

export type ChangeEffect = 'full' | 'ignored' | 'attributed' | 'measurement'

export interface ChangeClassification {
	path: string
	effect: ChangeEffect
	/** Why, in one clause, for the summary a reader of a passing gate sees. */
	reason: string
}

export interface GroupCoverage {
	group: string
	/** All measured rows: affected plus health-canary controls. */
	selected: number
	/** Rows the diff can move and the product group estimator is allowed to consume. */
	affected: number
	total: number
	/** Whether at least two affected rows exist for a genuine group estimator. */
	triggerPossible: boolean
}

export interface Selection {
	full: boolean
	scenarioIds: string[]
	totalScenarios: number
	steps: string[]
	classifications: ChangeClassification[]
	groups: GroupCoverage[]
	/** Scenarios the canary contributed, whether or not the diff also selected them. */
	canaryIds: string[]
	/** Scenarios the diff attributed. */
	attributedIds: string[]
	/** Reasons the import graph could not be trusted, each of which forced the full run. */
	problems: string[]
}

export type MeasurementRole = 'affected' | 'health-canary'

export interface MeasurementSelectionArtifact {
	schemaVersion: 1
	full: boolean
	scenarios: { id: string, role: MeasurementRole }[]
}

/**
 * The machine-readable meaning of a scoped selection.
 *
 * A cell can be measured for two different reasons that must not be conflated by the
 * group estimator: `affected` means the diff can move it and therefore it belongs in a
 * product regression aggregate; canary cells are health signals. A full run
 * has no narrower attribution claim, so every measured cell is affected.
 */
export function measurementSelectionOf(selection: Selection): MeasurementSelectionArtifact {
	const affected = new Set(selection.full ? selection.scenarioIds : selection.attributedIds)
	return {
		schemaVersion: 1,
		full: selection.full,
		scenarios: selection.scenarioIds.map(id => ({
			id,
			role: affected.has(id) ? 'affected' : 'health-canary',
		})),
	}
}

export interface Canary {
	/** Groups taken whole. */
	groups: string[]
	/** Individually named scenarios. */
	scenarios: string[]
}

export const defaultCanary: Canary = { groups: canaryGroups, scenarios: canaryScenarios }

export interface SelectionInput {
	changedFiles: string[]
	attribution: Attribution
	/** The standard-tier catalog, in registry order. */
	catalog: CatalogEntry[]
	/** Defaults to the repository's canary; injected by the tests so they can state their own. */
	canary?: Canary
	/**
	 * Changed paths whose two revisions mean the same thing, from `inert-change.ts`.
	 * Empty when the caller has no base revision to compare against, which classifies
	 * every path from its path alone, exactly as this module did before.
	 */
	inertPaths?: ReadonlySet<string>
}

/**
 * What one changed path does to the run. Exported because it is also the authority
 * `scripts/check-impact-triggers.ts` compares the workflow's `paths` filters against:
 * a path this returns `full` for and the filters do not match is a rule that cannot
 * fire. That check passes no inertness, which is right — the filters have to admit
 * every path a *behaviour-changing* edit would force a full run for.
 *
 * `inert` comes first, ahead of the gate-defining list, because it is the stronger
 * statement: a file whose two revisions parse to the same thing decides nothing
 * differently, whichever rule would otherwise have applied to it.
 */
export function classifyChange(path: string, attribution: Attribution, inert: boolean = false): ChangeClassification {
	if (inert)
		return { path, effect: 'ignored', reason: 'its two revisions are the same once comments and formatting are removed, so neither build nor this selection can see the change' }

	if (gateDefiningPaths.has(path))
		return { path, effect: 'full', reason: 'it decides how this gate runs' }

	if (isPackageSourcePath(path)) {
		const benchStep = attribution.cellStepsByFile.get(path)
		if (benchStep != null) {
			return {
				path,
				effect: 'measurement',
				reason: `the '${benchStep}' step's own bench file. It cannot change either build, but it declares what is measured, so it selects that step's cells`,
			}
		}
		if (attribution.shipped.has(path)) {
			const steps = attribution.stepsByFile.get(path)
			if (steps != null && steps.size > 0) {
				const names = [...steps].sort()
				const listed = names.length <= 8
					? names.join(', ')
					: `${names.slice(0, 8)
						.join(', ')}, and ${names.length - 8} more`
				return { path, effect: 'attributed', reason: `${names.length === 1 ? '1 step imports' : `${names.length} steps import`} it: ${listed}` }
			}
			if (attribution.barrels.has(path))
				return { path, effect: 'ignored', reason: 'a re-export barrel with no runtime code of its own; what it can change is which modules the bundle holds, which the canary construction and cold scenarios measure' }
			return { path, effect: 'full', reason: 'in the published build and reached by no step, so nothing narrower than the whole suite covers it' }
		}
		if (attribution.packageSourceFiles.has(path))
			return { path, effect: 'ignored', reason: 'not reachable from the published build entry, so it is not in either bundle' }
		// The diff deleted it, so there is no tree entry whose reachability could be
		// read. The pattern stands in for that answer and only for paths it is certain
		// about; anything else is a full run.
		if (isNonShippingSourcePath(path))
			return { path, effect: 'ignored', reason: 'a deleted test, benchmark, or test fixture, which the published build entry never reaches' }
		return { path, effect: 'full', reason: 'deleted from the published source tree, so its reachability can no longer be read' }
	}

	for (const pattern of cannotChangeTheBuild) {
		if (pattern.test(path))
			return { path, effect: 'ignored', reason: 'not an input to either package build' }
	}

	return { path, effect: 'full', reason: 'not a path this gate can place, and an unplaced path is a full run' }
}

export function selectImpactScenarios({ changedFiles, attribution, catalog, canary = defaultCanary, inertPaths = new Set() }: SelectionInput): Selection {
	const known = new Set(catalog.map(scenario => scenario.id))
	const missingCanary = canary.scenarios.filter(id => !known.has(id))
	if (missingCanary.length > 0)
		throw new Error(`Canary scenarios missing from the catalog: ${missingCanary.join(', ')}. Update scripts/impact-selection.ts, because a canary that does not exist is a canary that does not run.`)
	const groupsInCatalog = new Set(catalog.map(scenario => scenario.group))
	const missingGroups = canary.groups.filter(group => !groupsInCatalog.has(group))
	if (missingGroups.length > 0)
		throw new Error(`Canary groups missing from the catalog: ${missingGroups.join(', ')}. Update scripts/impact-selection.ts.`)

	const classifications = [...new Set(changedFiles)]
		.sort()
		.map(path => classifyChange(path, attribution, inertPaths.has(path)))

	// Attribution asks the same question the classification above does, so it takes the
	// same answer: a JSDoc fix to a step's source used to select that step's scenarios,
	// and a change nothing can read attributes nothing.
	const steps = new Set<string>()
	for (const path of changedFiles) {
		if (inertPaths.has(path))
			continue
		for (const step of attribution.stepsByFile.get(path) ?? [])
			steps.add(step)
		// A changed bench file selects its own step's cells, through the same steps-to-cells
		// mapping a changed source file uses. That is the whole of the replacement for
		// `steps → scenarios whose declared steps name them`: a cell's step is the directory
		// it lives in, so there is no declaration left to be wrong.
		const benchStep = attribution.cellStepsByFile.get(path)
		if (benchStep != null)
			steps.add(benchStep)
	}

	const canarySet = new Set(canary.scenarios)
	const canaryIds = catalog
		.filter(scenario => canary.groups.includes(scenario.group) || canarySet.has(scenario.id))
		.map(scenario => scenario.id)

	if (attribution.problems.length > 0 || classifications.some(classification => classification.effect === 'full')) {
		return {
			full: true,
			scenarioIds: catalog.map(scenario => scenario.id),
			totalScenarios: catalog.length,
			steps: [...steps].sort(),
			classifications,
			groups: coverageOf(catalog, new Set(catalog.map(scenario => scenario.id)), new Set(catalog.map(scenario => scenario.id))),
			canaryIds,
			attributedIds: [],
			problems: attribution.problems,
		}
	}

	const attributedIds = catalog
		.filter(scenario => scenario.steps.some(step => steps.has(step)))
		.map(scenario => scenario.id)

	const selected = new Set([...canaryIds, ...attributedIds])

	const scenarioIds = catalog.filter(scenario => selected.has(scenario.id))
		.map(scenario => scenario.id)

	return {
		full: scenarioIds.length === catalog.length,
		scenarioIds,
		totalScenarios: catalog.length,
		steps: [...steps].sort(),
		classifications,
		groups: coverageOf(catalog, selected, new Set(attributedIds)),
		canaryIds,
		attributedIds,
		problems: attribution.problems,
	}
}

function coverageOf(catalog: CatalogEntry[], selected: Set<string>, affected: Set<string>): GroupCoverage[] {
	const groups = new Map<string, GroupCoverage>()
	for (const scenario of catalog) {
		const coverage = groups.get(scenario.group) ?? { group: scenario.group, selected: 0, affected: 0, total: 0, triggerPossible: false }
		coverage.total++
		if (selected.has(scenario.id))
			coverage.selected++
		if (affected.has(scenario.id))
			coverage.affected++
		groups.set(scenario.group, coverage)
	}
	for (const coverage of groups.values())
		coverage.triggerPossible = coverage.affected >= minimumScenariosPerGroup
	return [...groups.values()]
}
