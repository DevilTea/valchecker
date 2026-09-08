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
	/**
	 * Temporary inventory bridge while #151–#154 move the legacy docs tree.
	 * Transitional pages must still exist and keep their canonical H1, but page-local source
	 * metadata becomes mandatory when the page is rewritten into its final owner.
	 */
	transitional?: true
}

/**
 * Canonical identity/order for hand-authored reader-facing narrative pages.
 *
 * The current paths are intentionally transitional. #151–#154 will replace this inventory with
 * reader-need-driven destinations under the accepted six-section information architecture.
 */
export const narrativePages: readonly NarrativePage[] = [
	{
		id: 'quick-start',
		path: 'docs/guide/quick-start.md',
		section: 'getting-started',
		order: 10,
		title: 'Quick Start',
		archetype: 'tutorial',
		transitional: true,
	},
	{
		id: 'core-philosophy',
		path: 'docs/guide/core-philosophy.md',
		section: 'core-concepts',
		order: 10,
		title: 'Core Philosophy',
		archetype: 'concept',
		transitional: true,
	},
	{
		id: 'issue-paths',
		path: 'docs/examples/issue-paths.md',
		section: 'core-concepts',
		order: 20,
		title: 'Issue Paths',
		archetype: 'concept',
		transitional: true,
	},
	{
		id: 'basic-validation',
		path: 'docs/examples/basic-validation.md',
		section: 'guides-recipes',
		order: 10,
		title: 'Basic Validation',
		archetype: 'recipe',
		transitional: true,
	},
	{
		id: 'async-validation',
		path: 'docs/examples/async-validation.md',
		section: 'guides-recipes',
		order: 20,
		title: 'Async Validation',
		archetype: 'recipe',
		transitional: true,
	},
	{
		id: 'custom-messages',
		path: 'docs/examples/custom-messages.md',
		section: 'guides-recipes',
		order: 30,
		title: 'Custom Messages',
		archetype: 'recipe',
		transitional: true,
	},
	{
		id: 'fallback-chains',
		path: 'docs/examples/fallback-chains.md',
		section: 'guides-recipes',
		order: 40,
		title: 'Fallback Chains',
		archetype: 'recipe',
		transitional: true,
	},
	{
		id: 'custom-steps',
		path: 'docs/guide/custom-steps.md',
		section: 'extending',
		order: 10,
		title: 'Custom Steps',
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
