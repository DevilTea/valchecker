import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { catalogIdDiff, cellsOfSource, isLegacyBaselineOnly, staticCatalog } from './bench-catalog-ids'

/**
 * The static catalog reader, whose whole reason for existing is the one thing the executable
 * catalog cannot do: see a cell the candidate tree deleted. The candidate ref owns the
 * apparatus, so a deleted cell is never collected, never measured, and can never appear in a
 * baseline result — the runtime presence difference reports `removed 0` for exactly the
 * deletion it is supposed to surface.
 */

function bench(step: string, cells: { name: string, group?: string, batch?: number, async?: boolean }[]): string {
	return [
		`import { string } from '../..'`,
		`import { stepBench } from '../../test-utils/step-bench'`,
		'',
		`const schema = string()`,
		'',
		`stepBench('${step}', [`,
		...cells.map(cell => `\t{ name: '${cell.name}', group: '${cell.group ?? 'warm/success'}', expect: { success: true }, batch: ${cell.batch ?? 100},${cell.async == null ? '' : ` async: ${String(cell.async)},`} run: () => schema.execute('a') },`),
		'])',
		'',
	].join('\n')
}

describe('reading a cell catalog from source', () => {
	it('reads every cell id a bench file declares', () => {
		const { cells, problems } = cellsOfSource('x/x.bench.ts', bench('isEmail', [{ name: 'valid' }, { name: 'invalid', group: 'warm/failure/library-default' }]))
		expect(problems)
			.toEqual([])
		expect(cells)
			.toEqual([
				{ id: 'isEmail/valid', group: 'warm/success', batch: 100, async: false },
				{ id: 'isEmail/invalid', group: 'warm/failure/library-default', batch: 100, async: false },
			])
	})

	it('excludes a baseline cell, exactly as the runtime catalog does', () => {
		const catalog = staticCatalog([{ path: 'a.bench.ts', text: bench('string', [{ name: 'valid' }, { name: 'native', group: 'baseline' }]) }])
		expect(catalog.ids)
			.toEqual(['string/valid'])
	})

	it('reports a cell it cannot read rather than treating it as absent', () => {
		// A computed name would otherwise look like a deletion on one side of the diff, which is
		// the one mistake this reader must never make.
		const computed = [
			`import { stepBench } from '../../test-utils/step-bench'`,
			`const suffix = 'valid'`,
			`stepBench('string', [`,
			`\t{ name: \`x-\${suffix}\`, group: 'warm/success', batch: 100, run: () => 1 },`,
			'])',
		].join('\n')
		const { cells, problems } = cellsOfSource('string/string.bench.ts', computed)
		expect(cells)
			.toEqual([])
		expect(problems[0])
			.toContain('declares a name that is not a string literal')
	})

	it('reports a file that declares no cells at all', () => {
		// This is what every bench file on `main` looks like: the pre-cell format called `bench()`
		// directly. A revision the reader cannot read must not come out as an empty catalog whose
		// diff reads "everything was added" with nothing to say why.
		const { problems } = cellsOfSource('a/a.bench.ts', 'import { bench } from \'vitest\'\nbench(\'x\', () => 1)\n')
		expect(problems[0])
			.toContain('declares no `stepBench()` call')
	})

	it('reports the same id declared twice, which a diff cannot attribute', () => {
		const catalog = staticCatalog([
			{ path: 'a.bench.ts', text: bench('string', [{ name: 'valid' }]) },
			{ path: 'b.bench.ts', text: bench('string', [{ name: 'valid' }]) },
		])
		expect(catalog.problems.some(problem => problem.includes('declared twice')))
			.toBe(true)
	})

	it('reports a duplicate id even when one or both declarations are baseline cells', () => {
		const mixed = staticCatalog([
			{ path: 'a.bench.ts', text: bench('string', [{ name: 'native', group: 'baseline' }]) },
			{ path: 'b.bench.ts', text: bench('string', [{ name: 'native' }]) },
		])
		expect(mixed.problems.some(problem => problem.includes('declared twice')))
			.toBe(true)

		const baselineOnly = staticCatalog([
			{ path: 'a.bench.ts', text: bench('string', [{ name: 'native', group: 'baseline' }]) },
			{ path: 'b.bench.ts', text: bench('string', [{ name: 'native', group: 'baseline' }]) },
		])
		expect(baselineOnly.problems.some(problem => problem.includes('declared twice')))
			.toBe(true)
	})
})

describe('diffing two revisions', () => {
	const base = staticCatalog([{ path: 'a.bench.ts', text: bench('map', [{ name: 'valid' }, { name: 'collect-all', group: 'warm/failure/all' }]) }])

	it('sees a cell the head deleted, which the runtime never can', () => {
		const head = staticCatalog([{ path: 'a.bench.ts', text: bench('map', [{ name: 'valid' }]) }])
		const diff = catalogIdDiff(base, head)
		expect(diff.removed)
			.toEqual(['map/collect-all'])
		expect(diff.added)
			.toEqual([])
		expect([diff.baseCells, diff.headCells])
			.toEqual([2, 1])
	})

	it('sees a rename as one removal and one addition', () => {
		const head = staticCatalog([{ path: 'a.bench.ts', text: bench('map', [{ name: 'valid' }, { name: 'collect-every', group: 'warm/failure/all' }]) }])
		const diff = catalogIdDiff(base, head)
		expect([diff.added, diff.removed])
			.toEqual([['map/collect-every'], ['map/collect-all']])
	})

	it('sees a cell moved to another group under an unchanged id', () => {
		// The audit `group` needs for the same structural reason deletions needed one: the apparatus
		// comes from the candidate ref and supplies the group to *both* measured sides, so they agree
		// on the new group by construction and no runtime comparison can recover the history. Moving
		// `map/collect-all` out of `warm/failure/all` changes which aggregate it is judged in and
		// that aggregate's denominator, while ids alone report nothing at all.
		const head = staticCatalog([{ path: 'a.bench.ts', text: bench('map', [{ name: 'valid' }, { name: 'collect-all', group: 'warm/success' }]) }])
		const diff = catalogIdDiff(base, head)
		expect([diff.added, diff.removed])
			.toEqual([[], []])
		expect(diff.changed)
			.toEqual([{
				id: 'map/collect-all',
				fields: ['group'],
				base: { group: 'warm/failure/all', batch: 100, async: false },
				head: { group: 'warm/success', batch: 100, async: false },
				gateEffect: null,
			}])
	})

	it('sees a batch change under an unchanged id', () => {
		const head = staticCatalog([{ path: 'a.bench.ts', text: bench('map', [
			{ name: 'valid', batch: 200 },
			{ name: 'collect-all', group: 'warm/failure/all' },
		]) }])
		const diff = catalogIdDiff(base, head)
		expect([diff.added, diff.removed])
			.toEqual([[], []])
		expect(diff.changed)
			.toEqual([{
				id: 'map/valid',
				fields: ['batch'],
				base: { group: 'warm/success', batch: 100, async: false },
				head: { group: 'warm/success', batch: 200, async: false },
				gateEffect: null,
			}])
	})

	it('sees an async-mode change under an unchanged id', () => {
		const head = staticCatalog([{ path: 'a.bench.ts', text: bench('map', [
			{ name: 'valid', async: true },
			{ name: 'collect-all', group: 'warm/failure/all' },
		]) }])
		const diff = catalogIdDiff(base, head)
		expect(diff.changed)
			.toEqual([{
				id: 'map/valid',
				fields: ['async'],
				base: { group: 'warm/success', batch: 100, async: false },
				head: { group: 'warm/success', batch: 100, async: true },
				gateEffect: null,
			}])
	})

	it('fails closed when batch or async cannot be read statically', () => {
		const dynamic = [
			`import { stepBench } from '../../test-utils/step-bench'`,
			`const batch = 100`,
			`const isAsync = false`,
			`stepBench('string', [`,
			`\t{ name: 'batch', group: 'warm/success', batch, run: () => 1 },`,
			`\t{ name: 'async', group: 'warm/success', batch: 100, async: isAsync, run: () => 1 },`,
			'])',
		].join('\n')
		const { cells, problems } = cellsOfSource('string/string.bench.ts', dynamic)
		expect(cells)
			.toEqual([])
		expect(problems)
			.toEqual(expect.arrayContaining([
				expect.stringContaining('batch that is not a positive integer literal'),
				expect.stringContaining('async mode that is not a boolean literal'),
			]))
	})

	it('names a baseline transition as the gate change it is', () => {
		// A move into `baseline` takes the cell out of the gate and a move out puts it in, so each
		// also shows in `removed`/`added`; naming the transition is what stops that reading as a cell
		// appearing from nowhere.
		const intoBaseline = staticCatalog([{ path: 'a.bench.ts', text: bench('map', [{ name: 'valid' }, { name: 'collect-all', group: 'baseline' }]) }])
		const left = catalogIdDiff(base, intoBaseline)
		expect(left.removed)
			.toEqual(['map/collect-all'])
		expect(left.changed[0])
			.toEqual({
				id: 'map/collect-all',
				fields: ['group'],
				base: { group: 'warm/failure/all', batch: 100, async: false },
				head: { group: 'baseline', batch: 100, async: false },
				gateEffect: 'left',
			})

		const entered = catalogIdDiff(intoBaseline, base)
		expect(entered.added)
			.toEqual(['map/collect-all'])
		expect(entered.changed[0]!.gateEffect)
			.toBe('entered')
	})

	it('says nothing moved when nothing moved', () => {
		const diff = catalogIdDiff(base, base)
		expect([diff.added, diff.removed, diff.changed, diff.problems])
			.toEqual([[], [], [], []])
	})

	it('carries each side\'s unreadable cells into the diff, labelled by side', () => {
		const unreadable = staticCatalog([{ path: 'a.bench.ts', text: 'export const nothing = 1\n' }])
		const diff = catalogIdDiff(unreadable, base)
		expect(diff.problems[0])
			.toContain('base: a.bench.ts')
		expect(diff.problems)
			.toHaveLength(1)
	})

	it('makes an unreadable head fatal, whatever the base looks like', () => {
		// The escape route this closes: a computed cell name passed the quality gate, made this
		// reader emit a head problem, and left the required catalog check green — so a deletion or
		// rename could reach a merge with no check on the contract at all.
		const head = staticCatalog([{ path: 'a.bench.ts', text: 'export const nothing = 1\n' }])
		const diff = catalogIdDiff(base, head, 1)
		expect(diff.fatalProblems)
			.toHaveLength(1)
		expect(diff.fatalProblems[0])
			.toContain('head: a.bench.ts')
		expect(diff.toleratedBaseline)
			.toBeNull()
	})

	it('tolerates the all-legacy base as one named migration, and nothing else', () => {
		// Every bench file on `main` predates `stepBench()`, so the base declares no cells and the
		// reader reports one problem per file. That is a real one-time migration.
		const legacyText = 'import { bench } from \'vitest\'\nbench(\'x\', () => 1)\n'
		const legacy = staticCatalog([
			{ path: 'a.bench.ts', text: legacyText },
			{ path: 'b.bench.ts', text: legacyText },
		])
		const tolerated = catalogIdDiff(legacy, base, 2)
		expect(tolerated.fatalProblems)
			.toEqual([])
		expect(tolerated.toleratedBaseline)
			.toContain('one-time cell-format migration')

		// A base that is only partly unreadable is an anomaly rather than that migration.
		const mixed = staticCatalog([
			{ path: 'a.bench.ts', text: legacyText },
			{ path: 'b.bench.ts', text: 'import { stepBench } from \'x\'\nstepBench(\'map\', [{ name: \'valid\', group: \'warm/success\', batch: 100 }])\n' },
		])
		expect(catalogIdDiff(mixed, base, 2).fatalProblems.length)
			.toBeGreaterThan(0)
	})

	it('stops tolerating the legacy base the moment the base declares any cell', () => {
		// The follow-up condition, as a test rather than a comment: once this pull request merges,
		// `main` declares cells, the shape stops matching, and base problems are fatal with no edit.
		const partlyMigrated = staticCatalog([
			{ path: 'a.bench.ts', text: 'import { bench } from \'vitest\'\nbench(\'x\', () => 1)\n' },
		])
		expect(isLegacyBaselineOnly(partlyMigrated, 1))
			.toBe(true)
		expect(isLegacyBaselineOnly({ ids: ['map/valid'], contracts: { 'map/valid': { group: 'warm/success', batch: 100, async: false } }, problems: partlyMigrated.problems }, 1))
			.toBe(false)
	})
})

describe('it cannot execute either build', () => {
	// The property the whole approach rests on, asserted rather than described. The reader is
	// reachable from a stage that has no build, so a single import of the package entry or of the
	// cell collector — which registers a loader hook resolving `'../..'` to a dist — would make
	// the static diff depend on the thing it exists to avoid.
	const forbidden = [
		'./bench-catalog-ids',
		'../packages',
		'benchmarks/src/cells',
		'valchecker',
	]

	function importsOf(file: string): string[] {
		return [...readFileSync(new URL(file, import.meta.url), 'utf8')
			.matchAll(/from '([^']+)'/g)].map(match => match[1]!)
	}

	it('imports only the TypeScript compiler', () => {
		expect(importsOf('bench-catalog-ids.ts'))
			.toEqual(['typescript'])
	})

	it('reads revisions through git and the parser, and nothing else', () => {
		const imports = importsOf('bench-catalog-diff.ts')
		expect(imports)
			.toEqual(['node:child_process', 'node:fs', 'node:path', 'node:process', 'node:url', './bench-catalog-ids'])
		for (const specifier of imports) {
			for (const banned of forbidden.slice(1)) {
				expect(specifier.includes(banned), `${specifier} must not reach ${banned}`)
					.toBe(false)
			}
		}
	})
})
