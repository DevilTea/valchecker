import type { SourceTree } from './source-tree'
import { buildSourceImportGraph } from './source-tree'

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
 * Attribution follows imports, never directories. A helper shared by two steps belongs
 * to both regardless of which step directory happens to hold it. Anything the selector
 * cannot place becomes a full run because under-selection is the failure mode: extra
 * measurement costs time, while a missed scenario can let a regression reach `main`.
 *
 * Nothing here reads the filesystem or git. The tree is injected, and the TypeScript
 * import/workspace resolver lives in `source-tree.ts` so documentation impact analysis
 * and performance attribution cannot silently disagree about reachability.
 */

export type { SourceTree } from './source-tree'

/** One scenario, as the benchmark catalog reports it. */
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
	 * A bench file cannot change either build, but it changes the measurement itself, so
	 * editing one selects that step's cells instead of being ignored or forcing all cells.
	 */
	cellStepsByFile: Map<string, string>
	/** Shipped files that are nothing but re-export statements. */
	barrels: Set<string>
	/** Every TypeScript file present under a package's `src` directory, shipped or not. */
	packageSourceFiles: Set<string>
	/** Every built-in step's public `Meta.Name`. */
	stepNames: Set<string>
	/**
	 * Reasons the attribution cannot be trusted as complete. A missing import edge is
	 * exactly how the gate would under-select, so any problem forces a full run.
	 */
	problems: string[]
}

/** The package source entry whose built bundle Performance Impact compares. */
export const gateBuildEntry = 'packages/valchecker/src/index.ts'

const packagesRoot = 'packages'
const stepsRoot = 'packages/internal/src/steps'

/**
 * Source files known not to ship. This pattern is consulted for deleted files, whose
 * current-tree reachability can no longer be inspected, and is verified against every
 * existing package source file so it cannot silently excuse a file that actually ships.
 */
export function isNonShippingSourcePath(path: string): boolean {
	return /^packages\/[^/]+\/src\//.test(path)
		&& (/\.(?:test|bench)\.tsx?$/.test(path) || path.includes('/src/test-utils/'))
}

function isPackageSourcePath(path: string): boolean {
	return /^packages\/[^/]+\/src\/.+\.tsx?$/.test(path)
}

/**
 * Paths that cannot change either package build. The default for an unrecognised path
 * remains a full run; this allowlist is deliberately narrower than "not under src".
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
 * Files that decide how the performance selector itself works. They must be re-included
 * by the workflow path filters after `scripts/**` / `.github/**` exclusions, otherwise
 * a rule that says "full run" could never start the workflow that enforces it.
 *
 * `source-tree.ts` is intentionally here: it owns the shared import resolver now used
 * by `buildAttribution`, so changing reachability semantics is a gate-defining change.
 */
export const gateDefiningPaths: ReadonlySet<string> = new Set([
	'.github/workflows/performance-impact.yml',
	'.github/actions/setup/action.yml',
	'scripts/impact-selection.ts',
	'scripts/inert-change.ts',
	'scripts/select-impact-scenarios.ts',
	'scripts/source-tree.ts',
])

interface StepEntry {
	/** The public `Meta.Name`, which is what scenarios declare. */
	name: string
	/** The step's main module, the root of its dependency closure. */
	entry: string
}

/**
 * Discover each step's public name and source root independently from its directory.
 * Directory identity is still needed for the step-local barrel and bench-file seams.
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
 * The measured bundle import graph, the steps each reachable file belongs to, and every
 * reason that attribution might be incomplete. TypeScript resolution itself is shared
 * with documentation impact analysis through `buildSourceImportGraph`.
 */
export function buildAttribution(tree: SourceTree): Attribution {
	const problems: string[] = []
	if (tree.read(gateBuildEntry) == null)
		problems.push(`${gateBuildEntry}: the gate's build entry is missing, so nothing can be attributed`)

	const graph = buildSourceImportGraph(tree, [gateBuildEntry], {
		unreadableFile: path => `${path}: reachable from the build entry but unreadable`,
	})
	problems.push(...graph.problems)

	const imports = graph.imports
	const shipped = graph.reachable
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
	// reachability from the step entry never reaches that barrel. The directory seam is
	// the narrow extra fact that attributes this one file to exactly that one step.
	for (const path of shipped) {
		const directory = /^packages\/internal\/src\/steps\/([^/]+)\/index\.ts$/.exec(path)?.[1]
		const step = directory == null ? undefined : stepEntries.get(directory)
		if (step != null) {
			stepsByFile.get(path)
				?.add(step.name)
		}
	}

	// Walk only each package's own `src`; descending through package `node_modules`
	// would turn dependency declarations into repository source and corrupt deletion
	// classification. Existing reachable files verify the non-shipping pattern above.
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

	return {
		shipped,
		stepsByFile,
		barrels: graph.barrels,
		packageSourceFiles,
		stepNames,
		cellStepsByFile,
		problems,
	}
}

/**
 * Health controls that run whatever the diff says. Construction/cold cover work that
 * timed execution cells do not attribute to a particular step; the named warm cells
 * cover shared execution, issue, collect-all, and async machinery. Canary rows remain
 * health signals and do not pad the affected group estimator.
 */
export const canaryGroups = ['construction', 'cold']

export const canaryScenarios = [
	// warm/success — per-call floor, common shapes, and delegation.
	'unknown/passes',
	'string/valid',
	'object/valid',
	'array/valid',
	// warm/failure/library-default — issue construction and deferred messages.
	'string/invalid',
	'object/missing-key',
	'string/custom-message',
	'object/enclosing-message',
	// warm/failure/all — both sides of collect-all traversal.
	'object/collect-all',
	'array/collect-all',
	// warm/async/success — callback, structural-child, and forced-async paths.
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
	/** Rows the diff can move and the product group estimator may consume. */
	affected: number
	total: number
	/** Whether enough affected rows exist for a genuine group estimator. */
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
	/** Graph uncertainty; any entry makes the selection full. */
	problems: string[]
}

export type MeasurementRole = 'affected' | 'health-canary'

export interface MeasurementSelectionArtifact {
	schemaVersion: 1
	full: boolean
	scenarios: { id: string, role: MeasurementRole }[]
}

/**
 * Preserve why each measured cell is present. A health canary can reveal a broad
 * problem but must not be mistaken for a diff-attributed row in product aggregation.
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
	/** Defaults to the repository canary; injectable so tests can state small fixtures. */
	canary?: Canary
	/** Paths proven semantically inert by the before/after normalizer. */
	inertPaths?: ReadonlySet<string>
}

/**
 * Classify one changed path. Inertness wins first because a file whose two revisions
 * are indistinguishable to the build and selector decides nothing differently. Gate-
 * defining files force full coverage; unknown files fail closed for the same reason.
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
		// A deleted path has no current tree entry. Only the deliberately narrow
		// non-shipping pattern may excuse it; every other deleted package source fails full.
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

	// Attribute only changes the build/selector can observe. A JSDoc-only change proven
	// inert therefore selects no product cells, while a changed bench selects its own step.
	const steps = new Set<string>()
	for (const path of changedFiles) {
		if (inertPaths.has(path))
			continue
		for (const step of attribution.stepsByFile.get(path) ?? [])
			steps.add(step)
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
	const scenarioIds = catalog
		.filter(scenario => selected.has(scenario.id))
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
