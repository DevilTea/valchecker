import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { catalogIdDiff, cellsOfSource, staticCatalog } from './bench-catalog-ids'

/**
 * The static catalog reader, whose whole reason for existing is the one thing the executable
 * catalog cannot do: see a cell the candidate tree deleted. The candidate ref owns the
 * apparatus, so a deleted cell is never collected, never measured, and can never appear in a
 * baseline result — the runtime presence difference reports `removed 0` for exactly the
 * deletion it is supposed to surface.
 */

function bench(step: string, cells: { name: string, group?: string }[]): string {
	return [
		`import { string } from '../..'`,
		`import { stepBench } from '../../test-utils/step-bench'`,
		'',
		`const schema = string()`,
		'',
		`stepBench('${step}', [`,
		...cells.map(cell => `\t{ name: '${cell.name}', group: '${cell.group ?? 'warm/success'}', expect: { success: true }, batch: 100, run: () => schema.execute('a') },`),
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
				{ id: 'isEmail/valid', group: 'warm/success' },
				{ id: 'isEmail/invalid', group: 'warm/failure/library-default' },
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
			`\t{ name: \`x-\${suffix}\`, group: 'warm/success', run: () => 1 },`,
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

	it('says nothing moved when nothing moved', () => {
		const diff = catalogIdDiff(base, base)
		expect([diff.added, diff.removed, diff.problems])
			.toEqual([[], [], []])
	})

	it('carries each side\'s unreadable cells into the diff, labelled by side', () => {
		const unreadable = staticCatalog([{ path: 'a.bench.ts', text: 'export const nothing = 1\n' }])
		const diff = catalogIdDiff(unreadable, base)
		expect(diff.problems[0])
			.toContain('base: a.bench.ts')
		expect(diff.problems)
			.toHaveLength(1)
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
