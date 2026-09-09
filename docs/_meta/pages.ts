export const documentationSections = [
	{ id: 'getting-started', label: 'Getting Started' },
	{ id: 'core-concepts', label: 'Core Concepts' },
	{ id: 'guides-recipes', label: 'Guides & Recipes' },
	{ id: 'extending', label: 'Extending Valchecker' },
	{ id: 'reference', label: 'Reference' },
	{ id: 'troubleshooting-migration', label: 'Troubleshooting & Migration' },
] as const

export type DocumentationSectionId = typeof documentationSections[number]['id']

export type NarrativePageArchetype
	= 'tutorial'
		| 'concept'
		| 'recipe'
		| 'extension'
		| 'reference'
		| 'migration'

export type NarrativeVisualRequirement = 'dot' | 'table' | 'any'

export interface NarrativePage {
	/** Stable machine identity; display text and routes may change independently later. */
	id: string
	/** Repository-relative Markdown path. The reader-facing route is derived from this path. */
	path: `docs/${string}.md`
	section: DocumentationSectionId
	order: number
	/** Canonical H1. */
	title: string
	/** Optional shorter label for navigation. */
	navLabel?: string
	/**
	 * Keep a registered compatibility route out of generated navigation while migration is in
	 * progress. Hidden routes remain structurally audited and may only be removed by the route
	 * compatibility work in #154.
	 */
	navHidden?: true
	archetype: NarrativePageArchetype
	/** Exact heading text that deterministic structure checks can require. */
	requiredHeadings?: readonly string[]
	/** Visual presence is required only when a concrete page contract says so. */
	visualRequirement?: NarrativeVisualRequirement
	/**
	 * Temporary inventory bridge while #151–#154 move the legacy docs tree.
	 * Transitional pages must still exist and keep their canonical H1, but page-local source
	 * metadata becomes mandatory when the page is rewritten into its final owner.
	 */
	transitional?: true
}

/** Canonical identity/order for hand-authored reader-facing narrative pages. */
export const narrativePages: readonly NarrativePage[] = [
	{
		id: 'quick-start',
		path: 'docs/getting-started/quick-start.md',
		section: 'getting-started',
		order: 10,
		title: 'Quick Start',
		archetype: 'tutorial',
		requiredHeadings: ['Install Valchecker', 'Build a schema', 'Execute the schema', 'Read the result', 'Where to go next'],
	},
	{
		id: 'legacy-quick-start',
		path: 'docs/guide/quick-start.md',
		section: 'getting-started',
		order: 900,
		title: 'Quick Start',
		navHidden: true,
		archetype: 'tutorial',
		transitional: true,
	},
	{
		id: 'pipeline-and-chaining',
		path: 'docs/core-concepts/pipeline-and-chaining.md',
		section: 'core-concepts',
		order: 10,
		title: 'Pipeline and Chaining',
		archetype: 'concept',
		visualRequirement: 'dot',
	},
	{
		id: 'validation-and-transformation',
		path: 'docs/core-concepts/validation-and-transformation.md',
		section: 'core-concepts',
		order: 20,
		title: 'Validation and Transformation',
		archetype: 'concept',
		visualRequirement: 'table',
	},
	{
		id: 'sync-and-async',
		path: 'docs/core-concepts/sync-and-async.md',
		section: 'core-concepts',
		order: 30,
		title: 'Synchronous and Asynchronous Execution',
		navLabel: 'Sync and Async',
		archetype: 'concept',
		visualRequirement: 'dot',
	},
	{
		id: 'issues-and-paths',
		path: 'docs/core-concepts/issues-and-paths.md',
		section: 'core-concepts',
		order: 40,
		title: 'Issues and Paths',
		archetype: 'concept',
		visualRequirement: 'dot',
	},
	{
		id: 'types-and-runtime',
		path: 'docs/core-concepts/types-and-runtime.md',
		section: 'core-concepts',
		order: 50,
		title: 'Types and Runtime Behavior',
		archetype: 'concept',
		visualRequirement: 'table',
	},
	{
		id: 'legacy-core-philosophy',
		path: 'docs/guide/core-philosophy.md',
		section: 'core-concepts',
		order: 900,
		title: 'Core Philosophy',
		navHidden: true,
		archetype: 'concept',
		transitional: true,
	},
	{
		id: 'legacy-issue-paths',
		path: 'docs/examples/issue-paths.md',
		section: 'core-concepts',
		order: 910,
		title: 'Issue Paths',
		navHidden: true,
		archetype: 'concept',
		transitional: true,
	},
	{
		id: 'structured-data',
		path: 'docs/guides-recipes/structured-data.md',
		section: 'guides-recipes',
		order: 10,
		title: 'Structured Data',
		archetype: 'recipe',
		visualRequirement: 'table',
	},
	{
		id: 'async-validation-guide',
		path: 'docs/guides-recipes/async-validation.md',
		section: 'guides-recipes',
		order: 20,
		title: 'Async Validation',
		archetype: 'recipe',
	},
	{
		id: 'custom-messages-and-errors',
		path: 'docs/guides-recipes/custom-messages-and-errors.md',
		section: 'guides-recipes',
		order: 30,
		title: 'Custom Messages and Error Responses',
		navLabel: 'Custom Messages and Errors',
		archetype: 'recipe',
		visualRequirement: 'table',
	},
	{
		id: 'fallback-and-recovery',
		path: 'docs/guides-recipes/fallback-and-recovery.md',
		section: 'guides-recipes',
		order: 40,
		title: 'Fallback and Recovery',
		archetype: 'recipe',
		visualRequirement: 'dot',
	},
	{
		id: 'legacy-basic-validation',
		path: 'docs/examples/basic-validation.md',
		section: 'guides-recipes',
		order: 900,
		title: 'Basic Validation',
		navHidden: true,
		archetype: 'recipe',
		transitional: true,
	},
	{
		id: 'legacy-async-validation',
		path: 'docs/examples/async-validation.md',
		section: 'guides-recipes',
		order: 910,
		title: 'Async Validation',
		navHidden: true,
		archetype: 'recipe',
		transitional: true,
	},
	{
		id: 'custom-messages',
		path: 'docs/examples/custom-messages.md',
		section: 'guides-recipes',
		order: 920,
		title: 'Custom Messages',
		navHidden: true,
		archetype: 'recipe',
		transitional: true,
	},
	{
		id: 'fallback-chains',
		path: 'docs/examples/fallback-chains.md',
		section: 'guides-recipes',
		order: 930,
		title: 'Fallback Chains',
		navHidden: true,
		archetype: 'recipe',
		transitional: true,
	},
	{
		id: 'custom-step-plugins',
		path: 'docs/extending/custom-step-plugins.md',
		section: 'extending',
		order: 10,
		title: 'Custom Step Plugins',
		archetype: 'extension',
		visualRequirement: 'dot',
	},
	{
		id: 'plugin-composition-and-distribution',
		path: 'docs/extending/plugin-composition-and-distribution.md',
		section: 'extending',
		order: 20,
		title: 'Plugin Composition and Distribution',
		archetype: 'extension',
		visualRequirement: 'dot',
	},
	{
		id: 'custom-steps',
		path: 'docs/guide/custom-steps.md',
		section: 'extending',
		order: 900,
		title: 'Custom Steps',
		navHidden: true,
		archetype: 'extension',
		transitional: true,
	},
	{
		id: 'v1-contract',
		path: 'docs/guide/v1-contract.md',
		section: 'reference',
		order: 10,
		title: 'Valchecker 1.0 Contract',
		navLabel: '1.0 Contract',
		archetype: 'reference',
		transitional: true,
	},
	{
		id: 'migration-to-1',
		path: 'docs/guide/migration-to-1.md',
		section: 'troubleshooting-migration',
		order: 10,
		title: 'Migrating to Valchecker 1.0',
		navLabel: 'Migrating to 1.0',
		archetype: 'migration',
		transitional: true,
	},
]

export function narrativeRoute(page: Pick<NarrativePage, 'path'>): string {
	return `/${page.path.slice('docs/'.length)
		.replace(/\.md$/, '')}`
}
