/** A policy threshold for review/blocking, not a noise estimate: bundle bytes are deterministic. */
export const meaningfulBundleRegression = 0.05

export function compareBundleImpact(baseResults, candidateResults, threshold = meaningfulBundleRegression, acceptedBytes = new Map()) {
	if (!(Number.isFinite(threshold) && threshold >= 0))
		throw new TypeError(`Bundle impact threshold must be a non-negative finite number; received ${String(threshold)}`)

	const candidateById = new Map(candidateResults.map(result => [result.id, result]))
	const rows = baseResults.map((base) => {
		const candidate = candidateById.get(base.id)
		if (candidate == null)
			throw new Error(`Candidate bundle results are missing base scenario ${base.id}`)
		if (!(base.brotliBytes > 0) || !(candidate.brotliBytes > 0))
			throw new Error(`Bundle impact requires positive Brotli sizes for ${base.id}`)
		const ratio = candidate.brotliBytes / base.brotliBytes
		const delta = ratio - 1
		const deltaBytes = candidate.brotliBytes - base.brotliBytes
		const acceptedLimit = acceptedBytes.get(base.id)
		return {
			id: base.id,
			baseBrotliBytes: base.brotliBytes,
			candidateBrotliBytes: candidate.brotliBytes,
			deltaBytes,
			ratio,
			delta,
			classification: delta > threshold
				? acceptedLimit != null && deltaBytes <= acceptedLimit ? 'accepted-regression' : 'regression'
				: delta < -threshold ? 'improvement' : 'within-threshold',
		}
	})
	const regressions = rows.filter(row => row.classification === 'regression')
	const acceptedRegressions = rows.filter(row => row.classification === 'accepted-regression')
	const improvements = rows.filter(row => row.classification === 'improvement')
	return {
		threshold,
		verdict: regressions.length > 0 ? 'regression' : acceptedRegressions.length > 0 ? 'accepted' : improvements.length > 0 ? 'improvement' : 'neutral',
		rows,
		regressions: regressions.map(row => row.id),
		acceptedRegressions: acceptedRegressions.map(row => row.id),
		improvements: improvements.map(row => row.id),
	}
}
