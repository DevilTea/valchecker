/**
 * Whether two benchmark results are the same kind of measurement, and therefore
 * whether the difference between them can be attributed to what changed rather
 * than to how they were measured.
 *
 * The mode name alone does not establish it: it selects a profile, and a profile
 * can change between the commits that produced two result files. Comparing a run
 * sampled to a 0.75% target against one that always took twelve samples would look
 * like a performance difference.
 *
 * Two more fields decide it for the same reason:
 *
 * - `isolation` — whether each (adapter, scenario) cell had its own process or one
 *   process ran every scenario of an adapter. Under adapter isolation a cell's
 *   number depends on what ran before it in that process, by up to 3.1× on the same
 *   schema, so an adapter-isolated number and a cell-isolated one are not two
 *   measurements of the same thing.
 * - the shard count — whether the scenarios were measured on one machine or spread
 *   over several. Cross-scenario aggregates of a sharded run mix machines, so
 *   pairing a sharded run with an unsharded one would attribute a runner difference
 *   to the change under test.
 * - the cell catalog — which set of cells existed to be selected from, as the hash a cell
 *   run records. The selection says which of them ran; the catalog says what the run order
 *   and every group denominator were computed from, and it is the apparatus rather than the
 *   build under test. Two runs measured against different catalogs can agree on every field
 *   above and still not be one measurement: the same `p % 4` position names a different
 *   cell. `null` for a cross-library scenario run, which has no cell catalog.
 * - the scenario selection — which scenarios ran at all. Cell isolation makes one
 *   scenario's number independent of the rest of the set, so the per-scenario rows of
 *   two differently scoped runs would still be comparable; the group aggregates would
 *   not, because a geometric mean is over whatever ran. The Performance Impact gate now
 *   scopes a pull-request run to its diff, so the selection varies between runs of the
 *   same profile and the identity has to carry it.
 *
 * This lives apart from `compare.mjs` because it is the load-bearing guard rather
 * than a formatting concern: it can be checked directly against hand-built results
 * that differ in exactly one field, which a test driving the whole comparison
 * script cannot do as precisely.
 */

export const supportedSchemaVersion = 5

/**
 * The fields that must agree, as a plain object so a mismatch can name the field
 * that differs instead of reporting that two opaque strings are unequal.
 */
export function measurementIdentity(raw, label) {
	if (raw?.schemaVersion !== supportedSchemaVersion)
		throw new Error(`${label} has benchmark schema version ${String(raw?.schemaVersion)}, expected ${supportedSchemaVersion}`)
	if (!raw.profile || typeof raw.profile !== 'object')
		throw new Error(`${label} is missing its measurement profile`)
	if (typeof raw.isolation !== 'string' || raw.isolation.length === 0)
		throw new Error(`${label} is missing its measurement isolation`)
	if (raw.temporalPairing !== 'none' && raw.temporalPairing !== 'adjacent-cell')
		throw new Error(`${label} records an unknown temporal pairing mode: ${String(raw.temporalPairing)}`)
	if (!Array.isArray(raw.shards) || raw.shards.length === 0)
		throw new Error(`${label} is missing its shard record`)
	const shardCount = raw.shards[0].count
	if (!Number.isInteger(shardCount) || shardCount < 1)
		throw new Error(`${label} records an invalid shard count: ${String(shardCount)}`)
	if (raw.shards.length !== shardCount)
		throw new Error(`${label} carries ${raw.shards.length} of its ${shardCount} shards, so it is not a complete run`)
	if (raw.scenarioRoles !== null && (typeof raw.scenarioRoles !== 'object' || Array.isArray(raw.scenarioRoles)))
		throw new Error(`${label} does not record valid scenario roles`)
	if (raw.scenarioFilter !== null && !Array.isArray(raw.scenarioFilter))
		throw new Error(`${label} does not record which scenarios it measured`)

	return {
		mode: raw.mode,
		profile: Object.entries(raw.profile)
			.sort(([left], [right]) => left.localeCompare(right)),
		isolation: raw.isolation,
		temporalPairing: raw.temporalPairing,
		shardCount,
		cellCatalogHash: raw.cellCatalogHash ?? null,
		// Sorted, because the same selection written in a different order is the same
		// set of scenarios; `null` is the whole tier and is deliberately not the same
		// value as a filter that happens to name every scenario in it, since only the
		// first is guaranteed to keep naming every scenario as the suite grows.
		selection: raw.scenarioFilter == null ? null : [...raw.scenarioFilter].sort(),
		scenarioRoles: raw.scenarioRoles == null
			? null
			: Object.entries(raw.scenarioRoles)
					.sort(([left], [right]) => left.localeCompare(right)),
	}
}

/** The identity fields on which two runs disagree, in a stable order. */
export function identityDifferences(left, right) {
	return Object.keys(left)
		.filter(field => JSON.stringify(left[field]) !== JSON.stringify(right[field]))
}

const reasons = {
	mode: 'a mode selects a different sampling profile',
	profile: 'the sampling profile decides how much evidence stands behind every number',
	isolation: 'a cell measured alone and a cell measured after other scenarios in the same process are not measurements of the same thing',
	temporalPairing: 'whole-side ordering and adjacent per-cell A/B pairing have different exposure to temporal drift',
	shardCount: 'scenarios measured on different machines cannot be pooled with scenarios measured on one',
	cellCatalogHash: 'the cell catalog decides the run order and every group denominator, so two runs measured against different catalogs are not one measurement even where they name the same cells',
	scenarioRoles: 'the role map decides which measured rows are allowed into the product group estimator',
	selection: 'a group aggregate is a geometric mean over the scenarios that ran, so two runs of different scenario sets have group numbers that are not measurements of the same thing',
}

/**
 * Refuses the comparison when the two runs were not measured the same way, naming
 * every field that differs and why it matters.
 */
export function assertComparable(left, right, subject) {
	const differences = identityDifferences(left, right)
	if (differences.length === 0)
		return
	const detail = differences
		.map(field => `${field} — ${reasons[field]}`)
		.join('; ')
	throw new Error(`${subject} were measured differently and cannot be compared — they differ in ${detail}`)
}
