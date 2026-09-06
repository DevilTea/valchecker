/**
 * Bundle growth accepted only against a specific historical base. Pinning the
 * base commit prevents an acknowledgement from weakening the policy for future
 * pull requests after the accepted change becomes part of main.
 */
export const acceptedBundleRegressions = [
	{
		baseCommit: '384d81389516ba174eaaf830970b141306f67a01',
		maxIncreaseBytes: 1024,
		scenarios: [
			'valchecker-default-string',
			'valchecker-default-object',
			'valchecker-full',
		],
		because: 'Issue #140 intentionally adds the toStrictJSONString built-in and the defensive issue/message ownership contract to the default all-steps artifact. Packed selective scenarios remain below the ordinary 5% policy threshold and all structural tree-shaking guards remain healthy; only bundles that intentionally retain the complete built-in set cross 5%. The hosted 7ca2375 comparison measured +969 B, +918 B, and +913 B respectively. This acknowledgement caps that one-time feature/correctness growth at 1 KiB and applies only while comparing against the exact pre-#140 main commit, so it cannot become a permanent larger budget for later pull requests.',
	},
]

export function acceptedBundleBytesForBase(baseCommit) {
	const accepted = new Map()
	for (const entry of acceptedBundleRegressions) {
		if (entry.baseCommit !== baseCommit)
			continue
		for (const scenario of entry.scenarios)
			accepted.set(scenario, entry.maxIncreaseBytes)
	}
	return accepted
}
