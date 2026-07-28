import type { SourceTree } from './source-tree'
import type { DiscoveredStep } from './step-inventory'
import { discoverSteps, stepsRoot } from './step-inventory'

// Composes `docs/api/*` and the API sidebar from the documentation each step owns, as a pure
// function of a source tree.
//
// The reference used to be a second, hand-maintained copy of the steps: 1629 lines of prose whose
// only link back to an implementation was that a name happened to be spelled on both sides.
// `check-step-completeness` could check that a page wrote `toTrimmedStart()` somewhere in a code
// span, and said outright that a page claiming the step did not exist would satisfy it. So the
// source of a step's documentation moved into the step unit — `<name>.doc.md` — and what used to be
// maintained by hand is now output.
//
// Three properties are load-bearing, because the absence of each is a silent failure:
//
// - **A step's category is declared, never inferred.** Inferring `isXxx → formats` would file
//   `isInteger` under string formats, and would invent a category for a step nobody has written
//   yet. `category` names a page; `section` names a slot in that page.
// - **Anything unplaceable fails.** A step with no `.doc.md`, an unknown category, a section no
//   page offers, a section slot no step fills, a page no template covers: each is reported. A step
//   silently missing from the site while the gate stays green is the failure this replaced.
// - **Output is deterministic.** Pages come from this list, sections from the order their slots
//   appear in the template, and steps within a section from a code-point sort of their public
//   names. `localeCompare` is deliberately not used: its result depends on the host's ICU data,
//   and check mode compares bytes.
//
// The prose that belongs to no single step — import strategies, the naming convention, how issues
// are collected across the structural steps, the execution result — lives in the page templates
// under `docsApiTemplates`. They are ordinary Markdown, so eslint's Markdown processing formats a
// fenced example in a template exactly as it formats the same text in the generated page; a
// template kept outside the linted set would drift from its own output on the next `--fix`.
//
// Examples are not compiled here. They reach `docs/api/*.md` verbatim, and `check-docs-examples`
// compiles those pages against the built declarations — including the `<!-- typecheck-… -->`
// directives, which pass through untouched. Since check mode makes the committed pages
// byte-identical to what these sources compose, a broken example in a `.doc.md` fails one gate or
// the other and cannot reach the site: either the pages were regenerated, and `docs:examples`
// compiles the broken example, or they were not, and this gate reports the difference.

export const docsApiRoot = 'docs/api'
export const docsApiTemplates = 'scripts/docs-api-templates'
export const vitepressConfig = 'docs/.vitepress/config.ts'
export const catalogPage = 'overview.md'

/** The marker pair the generated sidebar entries sit between in the VitePress config. */
export const sidebarRegionStart = '// #region generated-api-sidebar'
export const sidebarRegionEnd = '// #endregion generated-api-sidebar'

export interface ApiPage {
	/** File name under `docs/api`, and the template of the same name under `docsApiTemplates`. */
	file: string
	/** The label this page carries in the VitePress sidebar. */
	sidebar: string
	/** The category steps declare to land on this page, or `null` for a page no step belongs to. */
	category: string | null
}

/**
 * Every page of the reference, in sidebar order.
 *
 * This is the one place the page set is declared. A category no page claims is an error, and a
 * `docs/api/*.md` no page claims is an error too, so a page cannot be added on one side only.
 */
export const apiPages: readonly ApiPage[] = [
	{ file: 'overview.md', sidebar: 'Overview', category: null },
	{ file: 'primitives.md', sidebar: 'Primitives', category: 'primitives' },
	{ file: 'formats.md', sidebar: 'String Formats', category: 'formats' },
	{ file: 'structures.md', sidebar: 'Structures', category: 'structures' },
	{ file: 'transforms.md', sidebar: 'Transforms', category: 'transforms' },
	{ file: 'helpers.md', sidebar: 'Helpers & Utilities', category: 'helpers' },
]

const bannerLines = [
	'<!-- Generated file. Do not edit it: `pnpm docs:api` fails when it stops matching its sources,',
	'and `pnpm docs:api:update` rewrites it.',
	'',
	'Each step\'s entry comes from `packages/internal/src/steps/<name>/<name>.doc.md`. The prose',
	`around them, and the order the sections appear in, come from \`${docsApiTemplates}/<page>.md\`. -->`,
]

/** The header every generated page carries, so nobody hand-edits one. */
export const generatedBanner = bannerLines.join('\n')

/** The fields a `<name>.doc.md` declares, and nothing else. */
const declaredFields = ['category', 'section', 'summary'] as const

export interface StepDocMeta {
	/** The page the step is documented on, as an `ApiPage.category`. */
	category: string
	/** The slot on that page the step's entry fills. */
	section: string
	/** One line for the catalog on the overview page. */
	summary: string
}

export interface ParsedStepDoc {
	meta: StepDocMeta | null
	/** Everything after the declaration block: the step's entry, as it reaches the page. */
	body: string
	problems: string[]
}

/**
 * The declaration block and the body of a `<name>.doc.md`.
 *
 * The block is written the way this repository already writes a directive into Markdown — the
 * multi-line HTML comment `check-docs-examples` reads `<!-- typecheck-prelude` from — rather than
 * as YAML front matter, so that reading one costs a regular expression instead of a parser and a
 * dependency.
 *
 *     <!-- step-doc
 *     category: formats
 *     section: parsed
 *     summary: pragmatic WHATWG `<input type="email">` pattern
 *     -->
 *
 * Every field is required, an unknown field is an error, and a repeated field is an error: a
 * `catgory:` line silently ignored would take the step off the site.
 */
export function parseStepDoc(text: string): ParsedStepDoc {
	const lines = text.split(/\r?\n/)
	const problems: string[] = []

	const opener = lines.findIndex(line => line.trim() !== '')
	if (opener === -1 || lines[opener]!.trim() !== '<!-- step-doc') {
		return {
			meta: null,
			body: text.trim(),
			problems: ['it does not open with a `<!-- step-doc` declaration block. The first content of the file declares `category`, `section`, and `summary`, one per line, closed by `-->`.'],
		}
	}

	const closer = lines.findIndex((line, index) => index > opener && line.trim() === '-->')
	if (closer === -1) {
		return {
			meta: null,
			body: '',
			problems: ['its `<!-- step-doc` declaration block is never closed by a line holding `-->`.'],
		}
	}

	const fields = new Map<string, string>()
	for (const line of lines.slice(opener + 1, closer)) {
		if (line.trim() === '')
			continue
		const match = /^([a-z-]+):(.*)$/.exec(line.trim())
		if (match == null) {
			problems.push(`\`${line.trim()}\` is not a \`field: value\` line, and the declaration block holds nothing else.`)
			continue
		}
		const [, field, value] = match as unknown as [string, string, string]
		if (!(declaredFields as readonly string[]).includes(field)) {
			problems.push(`\`${field}\` is not a step-doc field. A step declares ${declaredFields.map(name => `\`${name}\``)
				.join(', ')} — nothing else.`)
		}
		else if (fields.has(field)) {
			problems.push(`\`${field}\` is declared twice, so one of the two values is being ignored.`)
		}
		else if (value.trim() === '') {
			problems.push(`\`${field}\` is declared with no value.`)
		}
		else {
			fields.set(field, value.trim())
		}
	}

	for (const field of declaredFields) {
		if (!fields.has(field))
			problems.push(`it declares no \`${field}\`.`)
	}

	const body = lines.slice(closer + 1)
		.join('\n')
		.trim()

	return {
		meta: problems.length > 0
			? null
			: {
					category: fields.get('category')!,
					section: fields.get('section')!,
					summary: fields.get('summary')!,
				},
		body,
		problems,
	}
}

/**
 * The step's entry as it appears on the page: its body, with the anchor appended to its heading.
 *
 * The anchor is generated rather than written, so the catalog's link and the heading it points at
 * come from the same string and cannot disagree. VitePress would otherwise slugify the heading,
 * and reproducing that slugifier here to build the link is exactly the kind of second copy this
 * file exists to remove.
 */
export function renderStepEntry(name: string, body: string): { text: string, problems: string[] } {
	const lines = body.split('\n')
	const heading = lines.findIndex(line => line.startsWith('### '))
	if (heading === -1 || lines.slice(0, heading)
		.some(line => line.trim() !== '')) {
		return {
			text: body,
			problems: [`its first content is not a \`### \` heading. A step's entry opens with one, writing the step in call form in a code span — \`### \\\`${name}()\\\`\`.`],
		}
	}

	lines[heading] = `${lines[heading]!.trimEnd()} {#${name}}`
	return { text: lines.join('\n'), problems: [] }
}

interface DocumentedStep {
	step: DiscoveredStep
	meta: StepDocMeta
	entry: string
}

/** Code-point order by public name: the same answer on every host, which check mode needs. */
function byName(left: DocumentedStep, right: DocumentedStep): number {
	return left.step.name < right.step.name ? -1 : left.step.name > right.step.name ? 1 : 0
}

/**
 * A heading's anchor, approximately as VitePress derives one.
 *
 * Deliberately an approximation, and only ever used to *reject*: a step's anchor is the step's name,
 * so a heading whose own anchor is that name would give the page two elements with one id, and
 * VitePress fails the build with `User defined \`id\` attribute is not unique`. Reproducing its
 * slugifier exactly to build links is what the generated `{#name}` anchor exists to avoid; this only
 * has to be close enough to turn that build failure into a message naming the heading and the step.
 * Anything it misses `pnpm docs:build` still catches.
 */
function approximateAnchor(heading: string): string {
	return heading.toLowerCase()
		.replace(/`|\*\*?/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
}

/** Every heading in a template, at any level. */
function headings(template: string): string[] {
	return template.split(/\r?\n/)
		.map(line => /^#{1,6} (.*)$/.exec(line.trim())?.[1]?.trim())
		.filter((heading): heading is string => heading != null)
}

/** A `<!-- steps: … -->` or `<!-- catalog: … -->` line, and the section heading above it. */
interface Slot {
	kind: 'steps' | 'catalog'
	id: string
	line: number
	/** Text of the nearest `## ` heading above the slot, which names the section in the catalog. */
	title: string | null
}

export function readSlots(template: string): Slot[] {
	const slots: Slot[] = []
	let title: string | null = null
	template.split(/\r?\n/)
		.forEach((line, index) => {
			const trimmed = line.trim()
			if (trimmed.startsWith('## ')) {
				title = trimmed.slice('## '.length)
					.trim()
			}
			const match = /^<!--\s*(steps|catalog):\s*([\w-]+)\s*-->$/.exec(trimmed)
			if (match != null)
				slots.push({ kind: match[1] as 'steps' | 'catalog', id: match[2]!, line: index, title })
		})
	return slots
}

/** One catalog bullet: the step, linked to its entry, and the summary its doc declares. */
function catalogEntry(page: ApiPage, documented: DocumentedStep): string {
	const target = `/${docsApiRoot.replace(/^docs\//, '')}/${page.file.replace(/\.md$/, '')}#${documented.step.name}`
	return `- [\`${documented.step.name}()\`](${target}) — ${documented.meta.summary}`
}

function replaceLine(lines: string[], index: number, replacement: string[]): void {
	lines.splice(index, 1, ...replacement)
}

export interface ComposedDocs {
	/** Repository-relative path to full file text, for every file this generator owns. */
	outputs: Map<string, string>
	/** Every reason the composition is not the reference the repository should ship. */
	problems: string[]
}

/**
 * The reference as the step units define it.
 *
 * A problem anywhere means the outputs describe a tree this generator could not read completely,
 * so callers must report the problems and leave the committed files alone rather than write a
 * partial site over them.
 */
export function composeDocsApi(tree: SourceTree): ComposedDocs {
	const composed = compose(tree)
	// Outputs are empty whenever anything is wrong, so a caller cannot half-write a site over the
	// committed one and leave whichever step could not be placed missing from it.
	return composed.problems.length > 0 ? { outputs: new Map(), problems: composed.problems } : composed
}

function compose(tree: SourceTree): ComposedDocs {
	const outputs = new Map<string, string>()
	const problems: string[] = []

	const { steps, problems: discovery } = discoverSteps(tree)
	if (discovery.length > 0)
		return { outputs, problems: discovery }

	const categories = new Map(apiPages
		.filter((page): page is ApiPage & { category: string } => page.category != null)
		.map(page => [page.category, page]))

	// Every step's own documentation, refused rather than guessed at when it cannot be placed.
	const documented = new Map<string, DocumentedStep[]>()
	for (const step of steps) {
		const path = `${stepsRoot}/${step.directory}/${step.directory}.doc.md`
		const text = tree.read(path)
		if (text == null) {
			problems.push(`${path} is missing, so the step '${step.name}' would not appear in the reference at all. A step unit owns its documentation: write the file, then run \`pnpm docs:api:update\`.`)
			continue
		}

		const { meta, body, problems: docProblems } = parseStepDoc(text)
		for (const problem of docProblems)
			problems.push(`${path}: ${problem}`)
		if (meta == null)
			continue

		const page = categories.get(meta.category)
		if (page == null) {
			problems.push(`${path}: \`category: ${meta.category}\` is not a page of the reference. The categories are ${[...categories.keys()].map(name => `\`${name}\``)
				.join(', ')}, declared in \`scripts/docs-api.ts\`; a new one is a new page and a new template, not a spelling.`)
			continue
		}

		const { text: entry, problems: entryProblems } = renderStepEntry(step.name, body)
		for (const problem of entryProblems)
			problems.push(`${path}: ${problem}`)
		if (entryProblems.length > 0)
			continue

		const key = `${meta.category}/${meta.section}`
		documented.set(key, [...documented.get(key) ?? [], { step, meta, entry }])
	}

	// Each page's template, its slots, and the sections it therefore offers.
	const templates = new Map<string, { text: string, slots: Slot[] }>()
	for (const page of apiPages) {
		const path = `${docsApiTemplates}/${page.file}`
		const text = tree.read(path)
		if (text == null) {
			problems.push(`${path} is missing. It holds the page's title and the prose that belongs to no single step, and its \`<!-- steps: … -->\` lines are what declare the sections ${page.category == null ? 'the page has' : `a \`category: ${page.category}\` step may fill`}.`)
			continue
		}
		templates.set(page.file, { text, slots: readSlots(text) })
	}

	for (const entry of [...tree.list(docsApiRoot) ?? []].sort()) {
		if (entry.endsWith('.md') && !apiPages.some(page => page.file === entry))
			problems.push(`${docsApiRoot}/${entry} is a page no entry in \`apiPages\` claims, so nothing generates it and nothing checks it. Declare it there with a template and a category, or delete it.`)
	}

	if (problems.length > 0)
		return { outputs, problems }

	// Which sections exist, and which page renders each.
	const sectionOwner = new Map<string, { page: ApiPage, slot: Slot }>()
	for (const page of apiPages) {
		for (const slot of templates.get(page.file)!.slots) {
			if (slot.kind !== 'steps')
				continue
			if (page.category == null) {
				problems.push(`${docsApiTemplates}/${page.file}: \`<!-- steps: ${slot.id} -->\` is on a page with no category, so no step can declare its way into it.`)
				continue
			}
			const key = `${page.category}/${slot.id}`
			if (sectionOwner.has(key))
				problems.push(`${docsApiTemplates}/${page.file}: \`<!-- steps: ${slot.id} -->\` appears twice, which would print every step of that section twice.`)
			else
				sectionOwner.set(key, { page, slot })
			if (slot.title == null)
				problems.push(`${docsApiTemplates}/${page.file}: \`<!-- steps: ${slot.id} -->\` has no \`## \` heading above it. That heading names the section, on the page and in the overview catalog.`)
		}
	}

	for (const page of apiPages) {
		if (page.category == null)
			continue
		if (!templates.get(page.file)!.slots.some(slot => slot.kind === 'steps'))
			problems.push(`${docsApiTemplates}/${page.file} offers no \`<!-- steps: … -->\` slot, so nothing can be documented on a page that claims \`category: ${page.category}\`. Every step declaring that category would fail for want of a section.`)
	}

	for (const [key, entries] of [...documented].sort()) {
		if (sectionOwner.has(key))
			continue
		const [category, section] = key.split('/') as [string, string]
		const template = `${docsApiTemplates}/${categories.get(category)!.file}`
		problems.push(`${entries.map(entry => `\`${entry.step.name}\``)
			.sort()
			.join(', ')} declare${entries.length === 1 ? 's' : ''} \`section: ${section}\`, which ${template} does not offer. Add a \`## \` heading and a \`<!-- steps: ${section} -->\` line there, or move the steps to a section it has.`)
	}

	for (const [key, { page, slot }] of [...sectionOwner].sort()) {
		if ((documented.get(key) ?? []).length === 0)
			problems.push(`${docsApiTemplates}/${page.file}: \`<!-- steps: ${slot.id} -->\` is a section no step declares, so it would render as an empty heading. Remove it, or point a step's \`section:\` at it.`)
	}

	// A heading whose anchor is a step's name would collide with that step's generated anchor, and a
	// section title used on two pages would collide with itself in the catalog. Both are page-level
	// id collisions, which VitePress reports as a build failure with no mention of either cause.
	const stepNames = new Set(steps.map(step => step.name))
	for (const page of apiPages) {
		for (const heading of headings(templates.get(page.file)!.text)) {
			const anchor = approximateAnchor(heading)
			if (stepNames.has(anchor))
				problems.push(`${docsApiTemplates}/${page.file}: the heading \`${heading}\` takes the anchor \`#${anchor}\`, which is the anchor of the step '${anchor}'. Two elements would carry one id and VitePress would fail the build. Reword the heading.`)
		}
	}

	const titles = new Map<string, string[]>()
	for (const { page, slot } of sectionOwner.values())
		titles.set(slot.title!, [...titles.get(slot.title!) ?? [], page.file])
	for (const [title, pages] of [...titles].sort()) {
		if (pages.length > 1) {
			problems.push(`\`## ${title}\` names a section on ${pages.sort()
				.join(' and ')}. The catalog writes every section title on the overview page, so two of them would carry one anchor there. Give them distinct titles.`)
		}
	}

	// The overview's catalog covers every category exactly once.
	const catalogSlots = templates.get(catalogPage)!.slots.filter(slot => slot.kind === 'catalog')
	for (const slot of catalogSlots) {
		if (!categories.has(slot.id))
			problems.push(`${docsApiTemplates}/${catalogPage}: \`<!-- catalog: ${slot.id} -->\` names no category of the reference.`)
	}
	for (const category of categories.keys()) {
		const count = catalogSlots.filter(slot => slot.id === category).length
		if (count !== 1)
			problems.push(`${docsApiTemplates}/${catalogPage}: \`<!-- catalog: ${category} -->\` appears ${count} times. The catalog lists every category exactly once; that is what makes it a catalog.`)
	}
	for (const page of apiPages) {
		for (const slot of templates.get(page.file)!.slots) {
			if (slot.kind === 'catalog' && page.file !== catalogPage)
				problems.push(`${docsApiTemplates}/${page.file}: \`<!-- catalog: ${slot.id} -->\` belongs on ${catalogPage}, the one page that catalogs the whole API.`)
		}
	}

	if (problems.length > 0)
		return { outputs, problems }

	// Every section of a category, in the order that category's template renders them.
	const sectionsOf = (category: string): Slot[] => templates.get(categories.get(category)!.file)!.slots
		.filter(slot => slot.kind === 'steps')

	for (const page of apiPages) {
		const { text, slots } = templates.get(page.file)!
		const lines = text.split(/\r?\n/)

		// Bottom-up, so replacing a slot with several lines does not move the slots above it.
		for (const slot of [...slots].reverse()) {
			if (slot.kind === 'steps') {
				const entries = documented.get(`${page.category!}/${slot.id}`)!
				replaceLine(lines, slot.line, [[...entries].sort(byName)
					.map(entry => entry.entry)
					.join('\n\n')])
				continue
			}

			const target = categories.get(slot.id)!
			const rendered: string[] = []
			for (const section of sectionsOf(slot.id)) {
				rendered.push(`### ${section.title!}`, '')
				for (const entry of [...documented.get(`${slot.id}/${section.id}`)!].sort(byName))
					rendered.push(catalogEntry(target, entry))
				rendered.push('')
			}
			replaceLine(lines, slot.line, rendered.slice(0, -1))
		}

		// Spacing is the template's, not this file's: collapsing blank lines afterwards would also
		// collapse them inside a fenced example, which is the one place they are content.
		outputs.set(`${docsApiRoot}/${page.file}`, `${[generatedBanner, '', ...lines].join('\n')
			.trimEnd()}\n`)
	}

	// The sidebar, spliced into the VitePress config between its markers rather than written to a
	// module of its own: the config is where a reader looks for the sidebar, and the entries are the
	// only part of it this generator owns.
	const config = tree.read(vitepressConfig)
	if (config == null) {
		problems.push(`${vitepressConfig} is missing, so the reference's sidebar has nowhere to go.`)
		return { outputs, problems }
	}

	const configLines = config.split(/\r?\n/)
	const start = configLines.findIndex(line => line.trim() === sidebarRegionStart)
	const end = configLines.findIndex(line => line.trim() === sidebarRegionEnd)
	if (start === -1 || end === -1 || end < start) {
		problems.push(`${vitepressConfig}: no \`${sidebarRegionStart}\` … \`${sidebarRegionEnd}\` region. The API Reference sidebar entries are generated from \`apiPages\`, and they are spliced between those two markers.`)
		return { outputs, problems }
	}

	const indent = /^\s*/.exec(configLines[start]!)![0]
	outputs.set(vitepressConfig, [
		...configLines.slice(0, start + 1),
		...apiPages.map(page => `${indent}{ text: '${page.sidebar}', link: '/api/${page.file.replace(/\.md$/, '')}' },`),
		...configLines.slice(end),
	].join('\n'))

	return { outputs, problems }
}
