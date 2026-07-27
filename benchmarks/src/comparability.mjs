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
 *
 * This lives apart from `compare.mjs` because it is the load-bearing guard rather
 * than a formatting concern: it can be checked directly against hand-built results
 * that differ in exactly one field, which a test driving the whole comparison
 * script cannot do as precisely.
 */

export const supportedSchemaVersion = 4

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
	if (!Array.isArray(raw.shards) || raw.shards.length === 0)
		throw new Error(`${label} is missing its shard record`)
	const shardCount = raw.shards[0].count
	if (!Number.isInteger(shardCount) || shardCount < 1)
		throw new Error(`${label} records an invalid shard count: ${String(shardCount)}`)
	if (raw.shards.length !== shardCount)
		throw new Error(`${label} carries ${raw.shards.length} of its ${shardCount} shards, so it is not a complete run`)

	return {
		mode: raw.mode,
		profile: Object.entries(raw.profile)
			.sort(([left], [right]) => left.localeCompare(right)),
		isolation: raw.isolation,
		shardCount,
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
	shardCount: 'scenarios measured on different machines cannot be pooled with scenarios measured on one',
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
