import type { Canary, CatalogEntry, SourceTree } from './impact-selection'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildAttribution, defaultCanary, isNonShippingSourcePath, selectImpactScenarios } from './impact-selection'

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

function syntheticTree(files: Record<string, string>): SourceTree {
	const paths = Object.keys(files)
	const directories = new Set<string>()
	for (const path of paths) {
		const parts = path.split('/')
		for (let index = 1; index < parts.length; index++) {
			directories.add(parts.slice(0, index)
				.join('/'))
		}
	}
	return {
		read: path => files[path] ?? null,
		list: (directory) => {
			if (!directories.has(directory))
				return null
			const prefix = `${directory}/`
			const names = new Set<string>()
			for (const path of paths) {
				if (path.startsWith(prefix)) {
					names.add(path.slice(prefix.length)
						.split('/')[0]!)
				}
			}
			return [...names]
		},
		isDirectory: path => directories.has(path),
	}
}

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

function select(changedFiles: string[], tree = repository, useCanary = canary) {
	return selectImpactScenarios({
		changedFiles,
		attribution: buildAttribution(syntheticTree(tree)),
		catalog,
		canary: useCanary,
	})
}

describe('attribution over the import graph', () => {
	it('reaches every step and nothing that is not published', () => {
		const attribution = buildAttribution(syntheticTree(repository))
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
		const attribution = buildAttribution(syntheticTree(repository))
		expect([...attribution.stepsByFile.get('packages/internal/src/steps/alpha/grammar.ts')!].sort())
			.toEqual(['alpha', 'beta'])
		expect([...attribution.stepsByFile.get('packages/internal/src/steps/gamma/gamma.ts')!])
			.toEqual(['gamma'])
		expect([...attribution.stepsByFile.get('packages/internal/src/core/core.ts')!].sort())
			.toEqual(['alpha', 'beta', 'delta', 'gamma'])
	})

	it('gives a step its own barrel, which re-exports it rather than importing it', () => {
		const attribution = buildAttribution(syntheticTree(repository))
		expect([...attribution.stepsByFile.get('packages/internal/src/steps/beta/index.ts')!])
			.toEqual(['beta'])
	})

	it('records a specifier it cannot resolve rather than dropping the edge', () => {
		const attribution = buildAttribution(syntheticTree({
			...repository,
			'packages/internal/src/steps/gamma/gamma.ts': `import { missing } from './not-there'\n\nconst Meta = {\n\tName: 'gamma',\n} as const\n\nexport const gamma = missing(Meta)\n`,
		}))
		expect(attribution.problems)
			.toEqual([`packages/internal/src/steps/gamma/gamma.ts: cannot resolve './not-there'`])
	})

	it('records a dynamic import whose specifier is not a literal', () => {
		const attribution = buildAttribution(syntheticTree({
			...repository,
			'packages/internal/src/registry.ts': `export const load = (name: string) => import(name)\n`,
		}))
		expect(attribution.problems)
			.toEqual(['packages/internal/src/registry.ts: a dynamic import whose specifier this scan cannot resolve'])
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
