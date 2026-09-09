import type { NarrativePageId } from './pages'

export type LegacyPageDisposition
	= 'migrated'
		| 'split'
		| 'absorbed'
		| 'redirected'
		| 'intentionally-removed'

export interface LegacyRouteCompatibility {
	/** Previously published reader-facing route, without `.md` or trailing slash. */
	from: `/${string}`
	/** Final disposition of the original prose/page responsibility. */
	disposition: LegacyPageDisposition
	/** Canonical narrative owners that received useful content from the old page. */
	targets: readonly NarrativePageId[]
	/** Primary canonical page used when preserving the old published URL. */
	redirectTo: NarrativePageId
}

/**
 * Final disposition and route compatibility for every narrative/example page that existed before
 * the six-section migration. These entries are not narrative page identities: they only preserve
 * old URLs and record where the useful content went.
 */
export const legacyRouteCompatibility = [
	{
		from: '/guide/quick-start',
		disposition: 'absorbed',
		targets: ['quick-start'],
		redirectTo: 'quick-start',
	},
	{
		from: '/guide/core-philosophy',
		disposition: 'split',
		targets: [
			'pipeline-and-chaining',
			'validation-and-transformation',
			'sync-and-async',
			'issues-and-paths',
			'types-and-runtime',
		],
		redirectTo: 'pipeline-and-chaining',
	},
	{
		from: '/guide/custom-steps',
		disposition: 'split',
		targets: ['custom-step-plugins', 'plugin-composition-and-distribution'],
		redirectTo: 'custom-step-plugins',
	},
	{
		from: '/guide/v1-contract',
		disposition: 'migrated',
		targets: ['v1-contract'],
		redirectTo: 'v1-contract',
	},
	{
		from: '/guide/migration-to-1',
		disposition: 'migrated',
		targets: ['migration-to-1'],
		redirectTo: 'migration-to-1',
	},
	{
		from: '/examples/basic-validation',
		disposition: 'split',
		targets: [
			'quick-start',
			'validation-and-transformation',
			'types-and-runtime',
			'structured-data',
		],
		redirectTo: 'quick-start',
	},
	{
		from: '/examples/async-validation',
		disposition: 'split',
		targets: ['sync-and-async', 'async-validation-guide'],
		redirectTo: 'async-validation-guide',
	},
	{
		from: '/examples/custom-messages',
		disposition: 'split',
		targets: ['custom-messages-and-errors', 'v1-contract'],
		redirectTo: 'custom-messages-and-errors',
	},
	{
		from: '/examples/fallback-chains',
		disposition: 'migrated',
		targets: ['fallback-and-recovery'],
		redirectTo: 'fallback-and-recovery',
	},
	{
		from: '/examples/issue-paths',
		disposition: 'migrated',
		targets: ['issues-and-paths'],
		redirectTo: 'issues-and-paths',
	},
] as const satisfies readonly LegacyRouteCompatibility[]
