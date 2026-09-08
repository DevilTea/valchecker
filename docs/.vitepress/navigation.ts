import type { DocumentationSectionId, NarrativePage } from '../_meta/pages'
import {
	documentationSections,
	narrativePages,
	narrativeRoute,
} from '../_meta/pages'

export interface DocsNavigationItem {
	text: string
	link: string
}

export interface DocsSidebarGroup {
	text: string
	items: DocsNavigationItem[]
}

function pagesFor(section: DocumentationSectionId) {
	return narrativePages
		.filter(page => page.section === section)
		.toSorted((left, right) => left.order - right.order)
}

function itemFor(page: NarrativePage): DocsNavigationItem {
	return {
		text: page.navLabel ?? page.title,
		link: narrativeRoute(page),
	}
}

export const docsNav: DocsNavigationItem[] = documentationSections.map((section) => {
	const first = pagesFor(section.id)[0]
	if (first == null)
		throw new Error(`Documentation section \`${section.id}\` has no registered narrative page.`)
	return { text: section.label, link: narrativeRoute(first) }
})

/**
 * Build the complete sidebar while keeping generated API entries outside narrative ownership.
 * `config.ts` passes the marker-owned API items into the Reference section through this seam.
 */
export function createDocsSidebar(apiReferenceItems: readonly DocsNavigationItem[]): DocsSidebarGroup[] {
	return documentationSections.map((section) => {
		const narrativeItems = pagesFor(section.id)
			.map(itemFor)
		return {
			text: section.label,
			items: section.id === 'reference'
				? [...narrativeItems, ...apiReferenceItems]
				: narrativeItems,
		}
	})
}
