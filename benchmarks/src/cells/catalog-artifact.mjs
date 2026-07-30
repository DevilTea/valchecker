/**
 * The cell catalog as **data**: the immutable measurement metadata of every gate cell,
 * plus a hash of the whole set.
 *
 * Collecting cells means importing every `<name>.bench.ts`, which means resolving the
 * `'../..'` each of them writes to a built `packages/valchecker/dist/index.mjs`. That is
 * right for measurement and wrong for everything after it: the first sharded CI run
 * measured all 245 cells across four shards and then failed in `compare`, because
 * building the coverage denominators re-entered that loader and it had no
 * `VALCHECKER_DIST_URL`. Setting the variable in the compare job would have made the run
 * pass while leaving the reporting stage coupled to the code under test, so the catalog
 * is persisted during measurement instead and compare reads the file.
 *
 * Nothing here imports `collect.mjs`, which registers those resolution hooks at import
 * time. That is the property this module exists to keep, so it is worth stating: a
 * consumer of the catalog pays for a JSON parse, not for a loader.
 *
 * The hash is what makes the artifact trustworthy rather than merely present. Every shard
 * records the hash of the catalog it measured against; `merge` refuses shards that
 * disagree, `comparability.mjs` carries it in the measurement identity, and `compare`
 * refuses a catalog file that is not the one the runs were measured against. Without it a
 * stale artifact from a previous attempt would silently supply the denominators of a run
 * that measured a different cell set.
 */

import { createHash } from 'node:crypto'

export const cellCatalogSchemaVersion = 1

/**
 * What a catalog entry is, and therefore what the hash covers: the cell's identity, the
 * group it aggregates into, the step a diff reaches it through, and the two facts that
 * decide what one measured unit is. Everything else about a cell — its input, its
 * expectation, the function itself — belongs to the measurement and cannot be read from a
 * file.
 */
const catalogFields = ['id', 'group', 'steps', 'batch', 'async']

function entryOf(cell) {
	return {
		id: cell.id,
		group: cell.group,
		steps: [...cell.steps],
		batch: cell.batch ?? null,
		async: cell.async ?? false,
	}
}

/**
 * The identity of a cell set: content-defined, order-sensitive, and short enough to read
 * in a log line.
 *
 * Order is part of it because the catalog order is the run order — positional round-robin
 * assigns shard `p % count` from it — so two catalogs holding the same cells in a
 * different order do not produce the same shards.
 */
export function cellCatalogHash(cells) {
	const canonical = cells.map(cell => catalogFields.map(field => entryOf(cell)[field]))
	return createHash('sha256')
		.update(JSON.stringify(canonical))
		.digest('hex')
		.slice(0, 16)
}

export function buildCellCatalog(cells) {
	return {
		schemaVersion: cellCatalogSchemaVersion,
		catalogHash: cellCatalogHash(cells),
		cells: cells.map(entryOf),
	}
}

/**
 * A persisted catalog, refused rather than trusted.
 *
 * The hash is recomputed from the entries instead of being read, so a hand-edited or
 * truncated artifact fails here rather than supplying a denominator nobody can trace to a
 * measurement.
 */
export function parseCellCatalog(value, label) {
	if (value == null || typeof value !== 'object' || Array.isArray(value))
		throw new TypeError(`${label} is not a cell catalog`)
	if (value.schemaVersion !== cellCatalogSchemaVersion)
		throw new Error(`${label} has cell-catalog schema version ${String(value.schemaVersion)}, expected ${cellCatalogSchemaVersion}`)
	if (!Array.isArray(value.cells) || value.cells.length === 0)
		throw new Error(`${label} carries no cells`)
	for (const [position, cell] of value.cells.entries()) {
		if (typeof cell?.id !== 'string' || cell.id.length === 0)
			throw new Error(`${label} cell ${position} has no id`)
		if (typeof cell.group !== 'string' || cell.group.length === 0)
			throw new Error(`${label} cell '${cell.id}' has no group`)
		if (!Array.isArray(cell.steps) || cell.steps.length === 0)
			throw new Error(`${label} cell '${cell.id}' names no step`)
	}
	const ids = new Set(value.cells.map(cell => cell.id))
	if (ids.size !== value.cells.length)
		throw new Error(`${label} lists a cell twice, so its denominators would count it twice`)
	const recomputed = cellCatalogHash(value.cells)
	if (value.catalogHash !== recomputed) {
		throw new Error(
			`${label} records the catalog hash ${String(value.catalogHash)} but its ${value.cells.length} cells hash to ${recomputed}. `
			+ 'The artifact was edited or truncated after it was written, and the cell set it describes is not the one it was measured from.',
		)
	}
	return { catalogHash: value.catalogHash, cells: value.cells }
}
