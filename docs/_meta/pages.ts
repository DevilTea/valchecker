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
	archetype: NarrativePageArchetype
	/** Exact heading text that deterministic structure checks can require. */
	requiredHeadings?: readonly string[]
	/** Visual presence is required only when a concrete page contract says so. */
	visualRequirement?: NarrativeVisualRequirement
}

/** Canonical identity/order for hand-authored reader-facing narrative pages. */
export const narrativePages = [
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
		id: 'v1-contract',
		path: 'docs/reference/v1-contract.md',
		section: 'reference',
		order: 10,
		title: 'Valchecker 1.0 Contract',
		navLabel: '1.0 Contract',
		archetype: 'reference',
		visualRequirement: 'table',
	},
	{
		id: 'migration-to-1',
		path: 'docs/troubleshooting-migration/migration-to-1.md',
		section: 'troubleshooting-migration',
		order: 10,
		title: 'Migrating to Valchecker 1.0',
		navLabel: 'Migrating to 1.0',
		archetype: 'migration',
		visualRequirement: 'table',
	},
] as const satisfies readonly NarrativePage[]

export type NarrativePageId = typeof narrativePages[number]['id']

export function narrativeRoute(page: Pick<NarrativePage, 'path'>): string {
	return `/${page.path.slice('docs/'.length)
		.replace(/\.md$/, '')}`
}
