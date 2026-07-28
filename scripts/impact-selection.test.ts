import type { Canary, CatalogEntry } from './impact-selection'
import type { SourceTree } from './source-tree'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildAttribution, classifyChange, defaultCanary, gateDefiningPaths, isNonShippingSourcePath, selectImpactScenarios } from './impact-selection'
import { objectTree } from './source-tree'

/**
 * What these protect is the one direction that costs something: a scenario the gate
 * should have measured and did not. Over-selection wastes runner minutes; under-selection
 * lets a regression through a green gate, so the shared-file case has a positive control
 * beside it — the same tree with the shared import removed, asserting that the scenarios
 * really do disappear when the attribution breaks.
 *
 * Every expectation is written out from the synthetic repository below, never computed
 * with the function under test.
 */

function step(name: string, extraImport?: string): string {
	return [
		`import { execute } from '../../core'`,
		extraImport == null ? null : `import { grammar } from '${extraImport}'`,
		'',
		'const Meta = {',
		`\tName: '${name}',`,
		'} as const',
		'',
		`export const ${name} = execute(Meta${extraImport == null ? '' : ', grammar'})`,
		'',
	].filter(line => line != null)
		.join('\n')
}

/**
 * A four-step repository with the two shapes that decide the mapping: a grammar file
 * shared by two steps that lives in only one of their directories, and a shipped module
 * (`registry.ts`) that no step reaches.
 */
const repository: Record<string, string> = {
	'packages/valchecker/package.json': '{ "name": "valchecker" }',
	'packages/valchecker/src/index.ts': `export * from '@valchecker/internal'\n`,
	'packages/internal/package.json': '{ "name": "@valchecker/internal" }',
	'packages/internal/src/index.ts': `export * from './core'\nexport * from './steps'\nexport * from './registry'\n`,
	'packages/internal/src/core/index.ts': `export * from './core'\n`,
	'packages/internal/src/core/core.ts': 'export function execute() {}\n',
	'packages/internal/src/registry.ts': `import { execute } from './core/core'\n\nexport const registry = [execute]\n`,
	'packages/internal/src/steps/index.ts': `export * from './alpha'\nexport * from './beta'\nexport * from './gamma'\nexport * from './delta'\n`,
	'packages/internal/src/steps/alpha/index.ts': `export * from './alpha'\n`,
	'packages/internal/src/steps/alpha/alpha.ts': step('alpha', './grammar'),
	'packages/internal/src/steps/alpha/alpha.test.ts': `import { alpha } from './alpha'\n`,
	'packages/internal/src/steps/alpha/alpha.bench.ts': `import { alpha } from './alpha'\n`,
	// The shared grammar. It sits inside `alpha/` and `beta` imports it from there, which
	// is the case a directory rule gets wrong.
	'packages/internal/src/steps/alpha/grammar.ts': `export const grammar = /^[a-z]+$/\n`,
	'packages/internal/src/steps/beta/index.ts': `export * from './beta'\n`,
	'packages/internal/src/steps/beta/beta.ts': step('beta', '../alpha/grammar'),
	'packages/internal/src/steps/gamma/index.ts': `export * from './gamma'\n`,
	'packages/internal/src/steps/gamma/gamma.ts': step('gamma'),
	'packages/internal/src/steps/delta/index.ts': `export * from './delta'\n`,
	'packages/internal/src/steps/delta/delta.ts': step('delta'),
	'packages/internal/src/test-utils/fixtures.ts': 'export const fixture = 1\n',
}

const catalog: CatalogEntry[] = [
	{ id: 'construct/alpha', group: 'construction', steps: ['alpha'] },
	{ id: 'construct/beta', group: 'construction', steps: ['beta'] },
	{ id: 'warm/alpha', group: 'warm/success', steps: ['alpha'] },
	{ id: 'warm/beta', group: 'warm/success', steps: ['beta'] },
	{ id: 'warm/gamma', group: 'warm/success', steps: ['gamma'] },
	{ id: 'warm/gamma-two', group: 'warm/success', steps: ['gamma'] },
	{ id: 'warm/delta', group: 'warm/success', steps: ['delta'] },
	{ id: 'fail/alpha', group: 'warm/failure', steps: ['alpha'] },
	{ id: 'fail/beta', group: 'warm/failure', steps: ['beta'] },
	{ id: 'fail/gamma', group: 'warm/failure', steps: ['gamma'] },
	{ id: 'fail/delta', group: 'warm/failure', steps: ['delta'] },
]

/** All of `construction`, plus two scenarios in each other group. */
const canary: Canary = {
	groups: ['construction'],
	scenarios: ['warm/gamma', 'warm/gamma-two', 'fail/alpha', 'fail/gamma'],
}

const canaryIds = ['construct/alpha', 'construct/beta', 'warm/gamma', 'warm/gamma-two', 'fail/alpha', 'fail/gamma']

function select(changedFiles: string[], tree = repository, useCanary = canary, inertPaths?: ReadonlySet<string>) {
	return selectImpactScenarios({
		changedFiles,
		attribution: buildAttribution(objectTree(tree)),
		catalog,
		canary: useCanary,
		inertPaths,
	})
}

describe('attribution over the import graph', () => {
	it('reaches every step and nothing that is not published', () => {
		const attribution = buildAttribution(objectTree(repository))
		expect(attribution.problems)
			.toEqual([])
		expect([...attribution.stepNames].sort())
			.toEqual(['alpha', 'beta', 'delta', 'gamma'])
		expect(attribution.shipped.has('packages/internal/src/steps/alpha/alpha.test.ts'))
			.toBe(false)
		expect(attribution.shipped.has('packages/internal/src/steps/alpha/alpha.bench.ts'))
			.toBe(false)
		expect(attribution.shipped.has('packages/internal/src/test-utils/fixtures.ts'))
			.toBe(false)
	})

	it('attributes a file to the steps that import it, not to the directory holding it', () => {
		const attribution = buildAttribution(objectTree(repository))
		expect([...attribution.stepsByFile.get('packages/internal/src/steps/alpha/grammar.ts')!].sort())
			.toEqual(['alpha', 'beta'])
		expect([...attribution.stepsByFile.get('packages/internal/src/steps/gamma/gamma.ts')!])
			.toEqual(['gamma'])
		expect([...attribution.stepsByFile.get('packages/internal/src/core/core.ts')!].sort())
			.toEqual(['alpha', 'beta', 'delta', 'gamma'])
	})

	it('gives a step its own barrel, which re-exports it rather than importing it', () => {
		const attribution = buildAttribution(objectTree(repository))
		expect([...attribution.stepsByFile.get('packages/internal/src/steps/beta/index.ts')!])
			.toEqual(['beta'])
	})

	it('records a specifier it cannot resolve rather than dropping the edge', () => {
		const attribution = buildAttribution(objectTree({
			...repository,
			'packages/internal/src/steps/gamma/gamma.ts': `import { missing } from './not-there'\n\nconst Meta = {\n\tName: 'gamma',\n} as const\n\nexport const gamma = missing(Meta)\n`,
		}))
		expect(attribution.problems)
			.toEqual([`packages/internal/src/steps/gamma/gamma.ts: cannot resolve './not-there'`])
	})

	it('records a dynamic import whose specifier is not a literal', () => {
		const attribution = buildAttribution(objectTree({
			...repository,
			'packages/internal/src/registry.ts': `export const load = (name: string) => import(name)\n`,
		}))
		expect(attribution.problems)
			.toEqual(['packages/internal/src/registry.ts: a dynamic import whose specifier this scan cannot resolve'])
	})

	it('records a static import whose specifier is not a literal', () => {
		const attribution = buildAttribution(objectTree({
			...repository,
			'packages/internal/src/registry.ts': 'import { grammar } from `./steps/alpha/grammar`\n\nexport const registry = [grammar]\n',
		}))
		expect(attribution.problems)
			.toEqual(['packages/internal/src/registry.ts: an import declaration whose specifier is not a string literal'])
	})

	it('records `import =`, which it does not resolve', () => {
		const attribution = buildAttribution(objectTree({
			...repository,
			'packages/internal/src/registry.ts': `import grammar = require('./steps/alpha/grammar')\n\nexport const registry = [grammar]\n`,
		}))
		expect(attribution.problems)
			.toEqual(['packages/internal/src/registry.ts: `import =` is not resolved by this scan'])
	})

	/**
	 * The three guards above and this one are the same guard in four spellings: an edge
	 * the scan cannot read is a step whose scenarios go unmeasured, so it is reported
	 * rather than skipped. They are exercised here because unexercised defensive code is
	 * indistinguishable from deleted defensive code.
	 */
	it('follows a `require` call, which would otherwise be an invisible edge', () => {
		const attribution = buildAttribution(objectTree({
			...repository,
			'packages/internal/src/steps/gamma/gamma.ts': [
				`import { execute } from '../../core'`,
				`const { grammar } = require('../alpha/grammar')`,
				'',
				'const Meta = {',
				`\tName: 'gamma',`,
				'} as const',
				'',
				'export const gamma = execute(Meta, grammar)',
				'',
			].join('\n'),
		}))
		expect(attribution.problems)
			.toEqual([])
		expect([...attribution.stepsByFile.get('packages/internal/src/steps/alpha/grammar.ts')!].sort())
			.toEqual(['alpha', 'beta', 'gamma'])
	})

	it('resolves a `.js` specifier to the TypeScript file beside it', () => {
		const attribution = buildAttribution(objectTree({
			...repository,
			'packages/internal/src/steps/beta/beta.ts': step('beta', '../alpha/grammar.js'),
		}))
		expect(attribution.problems)
			.toEqual([])
		expect([...attribution.stepsByFile.get('packages/internal/src/steps/alpha/grammar.ts')!].sort())
			.toEqual(['alpha', 'beta'])
	})

	it('records a module the build entry reaches but cannot read', () => {
		const attribution = buildAttribution(objectTree({
			...repository,
			'packages/ghost/package.json': '{ "name": "@valchecker/ghost" }',
			'packages/internal/src/index.ts': `export * from './core'\nexport * from './steps'\nexport * from './registry'\nexport * from '@valchecker/ghost'\n`,
		}))
		expect(attribution.problems)
			.toEqual(['packages/ghost/src/index.ts: reachable from the build entry but unreadable'])
	})

	it('records a step directory whose main module declares no name', () => {
		const attribution = buildAttribution(objectTree({
			...repository,
			'packages/internal/src/steps/delta/delta.ts': `import { execute } from '../../core'\n\nexport const delta = execute()\n`,
		}))
		expect(attribution.problems)
			.toEqual(['packages/internal/src/steps/delta/delta.ts: no `Meta.Name`, so the scenarios of this step cannot be found'])
		expect([...attribution.stepNames].sort())
			.toEqual(['alpha', 'beta', 'gamma'])
	})

	/**
	 * Removing a step from the barrel is how a step stops shipping, and it changes every
	 * bundle. The graph cannot attribute the step any more — it is not in either build —
	 * so the honest answer is that the attribution is incomplete, not that the step's
	 * scenarios are safe to skip.
	 */
	it('records a step the build entry no longer reaches', () => {
		const attribution = buildAttribution(objectTree({
			...repository,
			'packages/internal/src/steps/index.ts': `export * from './alpha'\nexport * from './beta'\nexport * from './gamma'\n`,
		}))
		expect(attribution.problems)
			.toEqual([`packages/internal/src/steps/delta/delta.ts: the 'delta' step is not reachable from the build entry`])
	})

	/**
	 * The self-consistency check the whole test and benchmark exclusion rests on. The
	 * pattern is only ever consulted for a deleted path, and it is only safe while no
	 * file it excuses is actually in the bundle.
	 */
	it('refuses itself when the build entry reaches a file the non-shipping pattern excuses', () => {
		const attribution = buildAttribution(objectTree({
			...repository,
			'packages/internal/src/index.ts': `export * from './core'\nexport * from './steps'\nexport * from './registry'\nexport * from './test-utils/fixtures'\n`,
		}))
		expect(attribution.problems)
			.toEqual(['packages/internal/src/test-utils/fixtures.ts: treated as not shipping, but the build entry reaches it'])
		expect(isNonShippingSourcePath('packages/internal/src/test-utils/fixtures.ts'))
			.toBe(true)
	})
})

describe('scenario selection', () => {
	it('a change to one step measures that step plus the canary', () => {
		const selection = select(['packages/internal/src/steps/delta/delta.ts'])
		expect(selection.full)
			.toBe(false)
		expect(selection.steps)
			.toEqual(['delta'])
		expect(selection.attributedIds)
			.toEqual(['warm/delta', 'fail/delta'])
		expect(selection.scenarioIds)
			.toEqual([
				'construct/alpha',
				'construct/beta',
				'warm/gamma',
				'warm/gamma-two',
				'warm/delta',
				'fail/alpha',
				'fail/gamma',
				'fail/delta',
			])
	})

	it('a change to a file two steps share measures both of them', () => {
		const selection = select(['packages/internal/src/steps/alpha/grammar.ts'])
		expect(selection.steps)
			.toEqual(['alpha', 'beta'])
		expect(selection.scenarioIds)
			.toEqual([
				'construct/alpha',
				'construct/beta',
				'warm/alpha',
				'warm/beta',
				'warm/gamma',
				'warm/gamma-two',
				'fail/alpha',
				'fail/beta',
				'fail/gamma',
			])
	})

	/**
	 * The positive control for the case above. With `beta` no longer importing the shared
	 * grammar, the attribution is wrong in exactly the way a directory rule would be, and
	 * the two scenarios that would go unmeasured are named here so the test above is a
	 * detector rather than a description.
	 */
	it('loses the second step\'s scenarios when the shared import is broken', () => {
		const broken = { ...repository, 'packages/internal/src/steps/beta/beta.ts': step('beta') }
		const selection = select(['packages/internal/src/steps/alpha/grammar.ts'], broken)
		expect(selection.steps)
			.toEqual(['alpha'])
		expect(selection.scenarioIds).not.toContain('warm/beta')
		expect(selection.scenarioIds).not.toContain('fail/beta')
		expect(selection.scenarioIds)
			.toEqual([
				'construct/alpha',
				'construct/beta',
				'warm/alpha',
				'warm/gamma',
				'warm/gamma-two',
				'fail/alpha',
				'fail/gamma',
			])
	})

	it('a change every step imports measures everything', () => {
		const selection = select(['packages/internal/src/core/core.ts'])
		expect(selection.full)
			.toBe(true)
		expect(selection.scenarioIds)
			.toEqual(catalog.map(scenario => scenario.id))
	})

	it('a test, benchmark, or fixture change measures only the canary', () => {
		for (const path of [
			'packages/internal/src/steps/alpha/alpha.test.ts',
			'packages/internal/src/steps/alpha/alpha.bench.ts',
			'packages/internal/src/test-utils/fixtures.ts',
		]) {
			const selection = select([path])
			expect(selection.full, path)
				.toBe(false)
			expect(selection.steps, path)
				.toEqual([])
			expect(selection.scenarioIds, path)
				.toEqual(canaryIds)
		}
	})

	it('a deleted test file is still recognised without a tree entry', () => {
		const selection = select(['packages/internal/src/steps/alpha/deleted.test.ts'])
		expect(selection.scenarioIds)
			.toEqual(canaryIds)
	})

	it('a deleted source file measures everything, because nothing can place it', () => {
		const selection = select(['packages/internal/src/steps/alpha/deleted.ts'])
		expect(selection.full)
			.toBe(true)
	})

	it('a path this gate cannot place measures everything', () => {
		for (const path of ['pnpm-lock.yaml', 'packages/internal/tsdown.config.ts', 'packages/internal/package.json', 'tsconfig.json', 'Makefile']) {
			const selection = select([path])
			expect(selection.full, path)
				.toBe(true)
			expect(selection.classifications[0]!.effect, path)
				.toBe('full')
		}
	})

	/**
	 * The rule this gate's own safety argument rests on: a pull request that edits what
	 * decides the scope pays one complete comparison. `scripts/**` and `.github/**` are
	 * otherwise ignored, which is exactly why this needs asserting — and why
	 * `check-impact-triggers.ts` asserts the workflow's `paths` filters re-include these
	 * five files, since a rule the workflow never starts for cannot fire.
	 */
	it('a change to what decides the scope measures everything', () => {
		for (const path of [
			'scripts/impact-selection.ts',
			'scripts/inert-change.ts',
			'scripts/select-impact-scenarios.ts',
			'.github/workflows/performance-impact.yml',
			'.github/actions/setup/action.yml',
		]) {
			const selection = select([path])
			expect(selection.full, path)
				.toBe(true)
			expect(selection.classifications[0]!.reason, path)
				.toBe('it decides how this gate runs')
		}
	})

	it('leaves every other script and workflow ignored, so the rule above is the gate list and not a directory', () => {
		for (const path of ['scripts/check-issue-codes.ts', '.github/workflows/ci.yml']) {
			const selection = select([path])
			expect(selection.full, path)
				.toBe(false)
			expect(selection.scenarioIds, path)
				.toEqual(canaryIds)
		}
	})

	it('a shipped module no step reaches measures everything', () => {
		const selection = select(['packages/internal/src/registry.ts'])
		expect(selection.full)
			.toBe(true)
		expect(selection.classifications[0]!.reason)
			.toContain('reached by no step')
	})

	it('a re-export barrel measures only the canary', () => {
		for (const path of [
			'packages/internal/src/steps/index.ts',
			'packages/internal/src/index.ts',
			'packages/valchecker/src/index.ts',
		]) {
			const selection = select([path])
			expect(selection.full, path)
				.toBe(false)
			expect(selection.scenarioIds, path)
				.toEqual(canaryIds)
		}
	})

	it('an incomplete import graph measures everything even when the diff looks harmless', () => {
		const broken = { ...repository, 'packages/internal/src/steps/gamma/gamma.ts': `import { missing } from './not-there'\n\nconst Meta = {\n\tName: 'gamma',\n} as const\n\nexport const gamma = missing(Meta)\n` }
		const selection = select(['README.md'], broken)
		expect(selection.full)
			.toBe(true)
		expect(selection.problems)
			.toHaveLength(1)
	})

	it('tops a group up to two scenarios so its severe-group trigger stays possible', () => {
		// A canary naming one `warm/failure` scenario leaves that group with a single
		// measured scenario, which `compare.mjs` cannot call a severe group regression.
		const thin: Canary = { groups: ['construction'], scenarios: ['warm/gamma'] }
		const selection = select(['packages/internal/src/steps/delta/delta.ts'], repository, thin)
		expect(selection.topUpIds)
			.toEqual(['fail/alpha'])
		expect(selection.groups)
			.toEqual([
				{ group: 'construction', selected: 2, total: 2, triggerPossible: true },
				{ group: 'warm/success', selected: 2, total: 5, triggerPossible: true },
				{ group: 'warm/failure', selected: 2, total: 4, triggerPossible: true },
			])
	})

	/**
	 * The other half of the same rule, and the reason it is expressed as a set of paths
	 * rather than as a rule about paths: whether a change means anything is a question about
	 * two revisions, which `inert-change.ts` answers and this module is only told.
	 *
	 * Each case names the answer it would have given without that, because the point is not
	 * that an inert path is ignored — it is that the *same* path is a full run or a
	 * selection when it changed for real.
	 */
	it('ignores a change proved to mean nothing, wherever the rule would otherwise have applied', () => {
		for (const path of [
			'scripts/impact-selection.ts',
			'.github/workflows/performance-impact.yml',
			'packages/internal/src/registry.ts',
			'pnpm-lock.yaml',
		]) {
			expect(select([path]).full, `${path}: without inertness`)
				.toBe(true)
			const selection = select([path], repository, canary, new Set([path]))
			expect(selection.full, path)
				.toBe(false)
			expect(selection.scenarioIds, path)
				.toEqual(canaryIds)
			expect(selection.classifications[0]!.effect, path)
				.toBe('ignored')
			expect(selection.classifications[0]!.reason, path)
				.toContain('once comments and formatting are removed')
		}
	})

	it('attributes nothing from a step source that means nothing different', () => {
		const path = 'packages/internal/src/steps/delta/delta.ts'
		expect(select([path]).steps, 'without inertness')
			.toEqual(['delta'])
		const selection = select([path], repository, canary, new Set([path]))
		expect(selection.steps)
			.toEqual([])
		expect(selection.attributedIds)
			.toEqual([])
		expect(selection.scenarioIds)
			.toEqual(canaryIds)
	})

	it('still selects when one file of the diff is inert and another is not', () => {
		const selection = select(
			['packages/internal/src/steps/alpha/grammar.ts', 'packages/internal/src/steps/delta/delta.ts'],
			repository,
			canary,
			new Set(['packages/internal/src/steps/delta/delta.ts']),
		)
		expect(selection.steps)
			.toEqual(['alpha', 'beta'])
		expect(selection.scenarioIds).not.toContain('warm/delta')
	})

	it('measures everything for a real change to a gate-defining file even when another one is inert', () => {
		const selection = select(
			['scripts/impact-selection.ts', 'scripts/select-impact-scenarios.ts'],
			repository,
			canary,
			new Set(['scripts/select-impact-scenarios.ts']),
		)
		expect(selection.full)
			.toBe(true)
	})

	it('refuses a canary naming a scenario the catalog does not have', () => {
		expect(() => select(['README.md'], repository, { groups: [], scenarios: ['warm/nope'] }))
			.toThrow(/Canary scenarios missing from the catalog: warm\/nope/)
	})
})

describe('the repository this gate runs in', () => {
	const tree: SourceTree = {
		read: (path) => {
			try {
				return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
			}
			catch {
				return null
			}
		},
		list: (path) => {
			try {
				return readdirSync(new URL(`../${path}`, import.meta.url))
			}
			catch {
				return null
			}
		},
		isDirectory: (path) => {
			try {
				return statSync(new URL(`../${path}`, import.meta.url))
					.isDirectory()
			}
			catch {
				return false
			}
		},
	}

	const attribution = buildAttribution(tree)

	it('resolves the whole published graph without an unplaceable specifier', () => {
		expect(attribution.problems)
			.toEqual([])
	})

	/**
	 * The two real shared-grammar files. Neither step owns the directory the other's
	 * grammar sits in, so a directory rule would drop `isIsoDateTime` and `isJwt`.
	 */
	it('attributes the shared grammar files to every step that imports them', () => {
		expect([...attribution.stepsByFile.get('packages/internal/src/steps/isIsoDate/iso-calendar-date.ts')!].sort())
			.toEqual(['isIsoDate', 'isIsoDateTime'])
		expect([...attribution.stepsByFile.get('packages/internal/src/steps/isIsoTime/iso-time-source.ts')!].sort())
			.toEqual(['isIsoDateTime', 'isIsoTime'])
		expect([...attribution.stepsByFile.get('packages/internal/src/steps/isBase64Url/base64url.ts')!].sort())
			.toEqual(['isBase64Url', 'isJwt'])
	})

	it('classifies every published source file as a test, a benchmark, or shipped', () => {
		for (const path of attribution.shipped) {
			expect(isNonShippingSourcePath(path), path)
				.toBe(false)
		}
	})

	it('excuses a deleted test only inside a package source tree', () => {
		// The pattern answers "was this deleted file in the bundle", so it is about the
		// published packages and nothing else. A `.test.ts` anywhere else is a different
		// question with a different answer, and the two are only kept apart by the prefix.
		expect(isNonShippingSourcePath('packages/internal/src/steps/isEmail/isEmail.test.ts'))
			.toBe(true)
		expect(isNonShippingSourcePath('docs/example.test.ts'))
			.toBe(false)
		expect(isNonShippingSourcePath('benchmarks/src/measure.test.ts'))
			.toBe(false)
	})

	it('has a canary that exists and keeps every benchmark group triggerable', async () => {
		// Imported through a computed URL for the reason `check-benchmark-coverage.ts`
		// does the same: a static specifier would pull the whole benchmark module graph
		// into this project's TypeScript program, and those `.mjs` files are not
		// type-checked under it.
		const { getScenarioCatalog } = await import(new URL('../benchmarks/src/scenarios/index.mjs', import.meta.url).href) as {
			getScenarioCatalog: (mode: string) => CatalogEntry[]
		}
		const standard = getScenarioCatalog('standard')
		const selection = selectImpactScenarios({ changedFiles: [], attribution, catalog: standard })
		expect(selection.full)
			.toBe(false)
		expect(selection.attributedIds)
			.toEqual([])
		for (const coverage of selection.groups) {
			expect(coverage.triggerPossible, coverage.group)
				.toBe(true)
		}
		expect(defaultCanary.scenarios.every(id => standard.some(scenario => scenario.id === id)))
			.toBe(true)
	})
})

describe('the gate-defining set', () => {
	// Derived rather than listed. `source-tree.ts` was missing from the set for a
	// while: `buildAttribution` reads the tree through it, so changing how files
	// are read or resolved can change which steps a diff reaches — with no rule
	// above it changing at all. Listing the members again here would have missed
	// that the same way the set did, so this asks the question the set answers:
	// does the selector depend on a module that can be edited without forcing a
	// complete comparison?
	const selectorRoot = fileURLToPath(new URL('.', import.meta.url))

	function localImports(file: string): string[] {
		const text = readFileSync(join(selectorRoot, file), 'utf8')
		const specifiers = [...text.matchAll(/from\s+'(\.\/[^']+)'/g)]
			.map(match => basename(match[1]!))
		return specifiers.map((specifier) => {
			const stem = specifier
				.replace(/\.(?:js|ts)$/, '')
			return `scripts/${stem}.ts`
		})
	}

	it('contains every module the selector reads its answer from', () => {
		const reached = new Set<string>()
		const pending = ['impact-selection.ts', 'select-impact-scenarios.ts']
		while (pending.length > 0) {
			const current = pending.pop()!
			for (const dependency of localImports(current)) {
				if (reached.has(dependency))
					continue
				reached.add(dependency)
				pending.push(basename(dependency))
			}
		}
		const missing = [...reached].filter(path => !gateDefiningPaths.has(path))
		expect(missing)
			.toEqual([])
	})

	it('forces a complete comparison for every member', () => {
		const attribution = buildAttribution(objectTree({}))
		for (const path of gateDefiningPaths) {
			// `false` because the question is what the rule does for a real edit; a
			// truthy value here would assert nothing but the inert short-circuit.
			const classification = classifyChange(path, attribution, false)
			expect(classification.effect)
				.toBe('full')
		}
	})
})
