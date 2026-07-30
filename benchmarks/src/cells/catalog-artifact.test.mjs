import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildCellCatalog, cellCatalogHash, parseCellCatalog } from './catalog-artifact.mjs'

/**
 * The catalog as an artifact: what it must refuse, and what it must not confuse.
 *
 * Every case here is about a catalog file that could reach `compare` while describing a
 * cell set other than the one measured — the failure the hash exists to make impossible.
 * Nothing here imports `collect.mjs`, which is the property the module is for: this file
 * runs with no build and no `VALCHECKER_DIST_URL`.
 */

const cells = [
	{ id: 'number/valid', group: 'warm/success', steps: ['number'], batch: 100, async: false },
	{ id: 'object/collect-all', group: 'warm/failure/all', steps: ['object'], batch: 20, async: false },
]

test('a built catalog carries its cells and a hash of them', () => {
	const artifact = buildCellCatalog(cells)
	assert.equal(artifact.schemaVersion, 1)
	assert.equal(artifact.catalogHash, cellCatalogHash(cells))
	assert.deepEqual(parseCellCatalog(artifact, 'catalog').cells.map(cell => cell.id), ['number/valid', 'object/collect-all'])
})

test('the hash covers every field a measurement depends on, and the order of the cells', () => {
	// Order first, because the catalog order *is* the run order: `p % count` assigns the
	// shards from it, so the same cells in another order do not produce the same shards.
	assert.notEqual(cellCatalogHash([...cells].reverse()), cellCatalogHash(cells))
	for (const change of [
		cell => cell.id = 'number/other',
		cell => cell.group = 'cold',
		cell => cell.steps = ['string'],
		cell => cell.batch = 200,
		cell => cell.async = true,
	]) {
		const changed = structuredClone(cells)
		change(changed[0])
		assert.notEqual(cellCatalogHash(changed), cellCatalogHash(cells), 'a changed field left the hash unchanged')
	}
})

test('a catalog whose hash does not describe its cells is refused', () => {
	// The case this guard is for: a stale artifact from an earlier attempt, or one
	// truncated in transit, supplying denominators for a run measured over other cells.
	const artifact = buildCellCatalog(cells)
	artifact.cells.pop()
	assert.throws(() => parseCellCatalog(artifact, 'cell-catalog.json'), /cell-catalog\.json records the catalog hash .* but its 1 cells hash to/)
})

test('a catalog that is not one is refused rather than half-read', () => {
	assert.throws(() => parseCellCatalog(null, 'catalog'), /is not a cell catalog/)
	assert.throws(() => parseCellCatalog([], 'catalog'), /is not a cell catalog/)
	assert.throws(() => parseCellCatalog({ schemaVersion: 2, cells, catalogHash: cellCatalogHash(cells) }, 'catalog'), /schema version 2, expected 1/)
	assert.throws(() => parseCellCatalog({ ...buildCellCatalog(cells), cells: [] }, 'catalog'), /carries no cells/)
	assert.throws(() => parseCellCatalog(buildCellCatalog([{ ...cells[0], id: '' }]), 'catalog'), /cell 0 has no id/)
	assert.throws(() => parseCellCatalog(buildCellCatalog([{ ...cells[0], group: '' }]), 'catalog'), /has no group/)
	assert.throws(() => parseCellCatalog(buildCellCatalog([{ ...cells[0], steps: [] }]), 'catalog'), /names no step/)
	assert.throws(() => parseCellCatalog(buildCellCatalog([cells[0], cells[0]]), 'catalog'), /lists a cell twice/)
})
