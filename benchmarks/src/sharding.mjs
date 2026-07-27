/**
 * How one benchmark run is split across machines, and how the pieces are joined
 * back into a single result.
 *
 * The split is **by scenario, never by adapter**. Ranking the adapters within one
 * scenario is the only comparison the report makes, so every adapter of a scenario
 * has to be measured on one machine; sharding by adapter would put each library on
 * a different GitHub runner and destroy exactly that comparison. Sharding by
 * scenario costs the cross-scenario reading instead, which the suite already
 * declares invalid for aggregates.
 *
 * The assignment is positional round-robin: the scenario at position `p` in the
 * selected list belongs to shard `p % count`. Two properties follow, and both are
 * why it is this rule rather than a hash.
 *
 * - It is deterministic from `(scenario selection, count)` alone — no seed, no
 *   file order, no measurement — so rerunning shard 2 of a failed run measures the
 *   same scenarios as the first attempt.
 * - It is exactly invertible: original position `p` sits at row `⌊p / count⌋` of
 *   shard `p % count`, so `interleaveShards` reconstructs the full-run order from
 *   the shard pieces without needing the scenario registry. The merge tool is then
 *   a pure function over the shard files.
 *
 * Round-robin also balances by construction. Scenario families are contiguous in
 * the registry, so consecutive positions are the expensive large-collection cases
 * of one family; interleaving spreads each family across every shard instead of
 * handing one shard all of `array/1000-*`.
 */

/** One process per (adapter, scenario) cell, or one process per adapter. */
export const isolations = ['cell', 'adapter']

export function assertShardSelector(index, count) {
	if (!Number.isInteger(count) || count < 1)
		throw new Error(`Shard count must be a positive integer, received ${String(count)}`)
	if (!Number.isInteger(index) || index < 0 || index >= count)
		throw new Error(`Shard index must be an integer in [0, ${count}), received ${String(index)}`)
}

/** The scenarios belonging to one shard, in their original relative order. */
export function selectShardScenarios(scenarios, index, count) {
	assertShardSelector(index, count)
	return scenarios.filter((_, position) => position % count === index)
}

/**
 * The inverse of `selectShardScenarios`: given one list per shard in shard-index
 * order, the original order. Reads across the shards row by row, which is what
 * positional round-robin means read backwards.
 */
export function interleaveShards(lists) {
	const longest = Math.max(0, ...lists.map(list => list.length))
	const merged = []
	for (let row = 0; row < longest; row++) {
		for (const list of lists) {
			if (row < list.length)
				merged.push(list[row])
		}
	}
	return merged
}

function assertSameAcrossShards(raws, read, field) {
	const first = JSON.stringify(read(raws[0]) ?? null)
	for (const [index, raw] of raws.entries()) {
		if (JSON.stringify(read(raw) ?? null) !== first)
			throw new Error(`Shard ${raw.shards?.[0]?.index ?? index} was produced with a different ${field}, so its numbers are not part of the same run`)
	}
}

function shardEntryOf(raw, position) {
	if (!Array.isArray(raw.shards) || raw.shards.length !== 1)
		throw new Error(`Shard input ${position} must record exactly one shard; received ${Array.isArray(raw.shards) ? raw.shards.length : 'none'}. Merge unmerged shard results only.`)
	return raw.shards[0]
}

/**
 * Joins the shard results of one run into a single result of the same shape a
 * one-shard run writes, so `report`, `summary`, and `compare` read a merged run
 * with no knowledge that it was sharded beyond the `shards` record itself.
 *
 * Everything that decides what a number means has to agree across the shards —
 * mode, profile, isolation, scenario selection, adapter order, adapter versions —
 * because the merged file presents them all as one run. What is allowed to differ
 * is the machine, which is why each shard keeps its own environment rather than
 * being folded into the top-level one.
 */
export function mergeShardResults(raws) {
	if (!Array.isArray(raws) || raws.length === 0)
		throw new Error('Merging requires at least one shard result')

	for (const [position, raw] of raws.entries()) {
		if (!raw || typeof raw !== 'object')
			throw new TypeError(`Shard input ${position} is not a benchmark result`)
	}

	for (const field of ['schemaVersion', 'mode', 'seed', 'scenarioFilter', 'isolation', 'profile', 'order'])
		assertSameAcrossShards(raws, raw => raw[field], field)

	const entries = raws.map((raw, position) => shardEntryOf(raw, position))
	const count = entries[0].count
	if (!Number.isInteger(count) || count < 1)
		throw new Error(`Shard count must be a positive integer, received ${String(count)}`)
	for (const entry of entries) {
		if (entry.count !== count)
			throw new Error(`Shard ${entry.index} reports a count of ${entry.count}, but shard ${entries[0].index} reports ${count}`)
		assertShardSelector(entry.index, count)
	}
	const indices = entries.map(entry => entry.index)
	if (new Set(indices).size !== indices.length)
		throw new Error(`Shard indices must be distinct, received ${indices.join(',')}`)
	// A merged run must be complete. A missing shard would silently publish a
	// partial scenario set as a whole run, and the report has no way to notice.
	if (entries.length !== count) {
		const missing = Array.from({ length: count }, (_, index) => index)
			.filter(index => !indices.includes(index))
		throw new Error(`Merging ${count} shards requires all of them; shard ${missing.join(',')} is missing`)
	}

	const ordered = [...raws]
		.map((raw, position) => ({ raw, entry: entries[position] }))
		.sort((left, right) => left.entry.index - right.entry.index)
	const scenarioCatalog = interleaveShards(ordered.map(({ raw }) => raw.scenarioCatalog))
	const catalogPosition = new Map(scenarioCatalog.map((scenario, position) => [scenario.id, position]))
	if (catalogPosition.size !== scenarioCatalog.length)
		throw new Error('Shards must measure disjoint scenario sets; a scenario appears in more than one shard')

	const adapters = ordered[0].raw.libraries.map(library => library.adapter)
	const libraries = adapters.map((adapter) => {
		const parts = ordered.map(({ raw, entry }) => {
			const library = raw.libraries.find(item => item.adapter === adapter)
			if (!library)
				throw new Error(`Shard ${entry.index} did not measure ${adapter}`)
			return library
		})
		for (const field of ['name', 'version', 'capabilities'])
			assertSameAcrossShards(raws, raw => raw.libraries.find(item => item.adapter === adapter)?.[field], `${adapter} ${field}`)
		const byCatalog = (left, right) => catalogPosition.get(left.scenario) - catalogPosition.get(right.scenario)
		return {
			adapter,
			name: parts[0].name,
			version: parts[0].version,
			capabilities: parts[0].capabilities,
			verifiedScenarios: parts.reduce((total, part) => total + part.verifiedScenarios, 0),
			totalScenarios: parts.reduce((total, part) => total + part.totalScenarios, 0),
			skippedScenarios: parts.flatMap(part => part.skippedScenarios)
				.sort(byCatalog),
			results: parts.flatMap(part => part.results)
				.sort(byCatalog),
		}
	})

	const first = ordered[0].raw
	const startedAt = ordered.map(({ raw }) => raw.startedAt)
		.sort()[0]
	const completedAt = ordered.map(({ raw }) => raw.completedAt)
		.sort()
		.at(-1)
	return {
		schemaVersion: first.schemaVersion,
		mode: first.mode,
		seed: first.seed,
		scenarioFilter: first.scenarioFilter,
		isolation: first.isolation,
		startedAt,
		completedAt,
		profile: first.profile,
		// Shard 0's machine. When the shards ran on different runners this is one of
		// several, which is why `shards` carries every environment and the report
		// prints the fields that differ as varying rather than as this one value.
		environment: ordered[0].raw.environment,
		shards: ordered.map(({ entry }) => entry),
		order: first.order,
		scenarioCatalog,
		libraries,
	}
}
