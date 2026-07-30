import { describe, expect, it } from 'vitest'
import {
	apiPages,
	composeDocsApi,
	parseStepDoc,
	readSlots,
	renderStepEntry,
	staleOutputs,
} from './docs-api'
import { objectTree } from './source-tree'

/**
 * The reference is generated, so every way it could be generated *wrongly and silently* is a rule
 * here: a step with no documentation, a category no page claims, a section no template offers, a
 * section slot no step fills, a page nothing generates, a catalog that skips a category. Each of
 * those would otherwise take a step off the site while `pnpm docs:api` stayed green, which is the
 * failure this generator replaced.
 *
 * The synthetic repository below is small enough that every expectation is written out by hand
 * rather than computed with the function under test. It carries one step in each of the five
 * categories, since a page claiming a category has to offer a section for it, and one test adds two
 * more to one section so that ordering has something to act on.
 */

const stepsRoot = 'packages/internal/src/steps'

interface StepFixture {
	name: string
	category: string
	section: string
	summary: string
}

const fixtures: StepFixture[] = [
	{ name: 'number', category: 'primitives', section: 'initial', summary: 'every JavaScript number' },
	{ name: 'isEmail', category: 'formats', section: 'parsed', summary: 'an email address' },
	{ name: 'object', category: 'structures', section: 'objects', summary: 'declared own properties' },
	{ name: 'toTrimmed', category: 'transforms', section: 'string', summary: 'trim both ends' },
	{ name: 'check', category: 'helpers', section: 'escape-hatches', summary: 'a custom condition' },
]

function main(name: string): string {
	return [
		'type Meta = DefineStepMethodMeta<{',
		`\tName: '${name}'`,
		'}>',
		'',
		`export const ${name} = implStepPlugin<PluginDef>({}, 'sync')`,
		'',
	].join('\n')
}

function doc({ name, category, section, summary }: StepFixture): string {
	return [
		'<!-- step-doc',
		`category: ${category}`,
		`section: ${section}`,
		`summary: ${summary}`,
		'-->',
		'',
		`### \`${name}()\``,
		'',
		'Does the thing.',
		'',
		'```ts',
		`v.${name}()`,
		'```',
		'',
	].join('\n')
}

const templates: Record<string, string> = {
	'overview.md': [
		'# API Overview',
		'',
		'How to import it.',
		'',
		'## Primitives',
		'',
		'<!-- catalog: primitives -->',
		'',
		'## String formats',
		'',
		'<!-- catalog: formats -->',
		'',
		'## Structures',
		'',
		'<!-- catalog: structures -->',
		'',
		'## Transforms',
		'',
		'<!-- catalog: transforms -->',
		'',
		'## Helpers',
		'',
		'<!-- catalog: helpers -->',
		'',
	].join('\n'),
	'primitives.md': [
		'# Primitives',
		'',
		'What a primitive is.',
		'',
		'## Initial schemas',
		'',
		'<!-- steps: initial -->',
		'',
	].join('\n'),
	'formats.md': [
		'# String formats',
		'',
		'What a format is.',
		'',
		'## Parsed formats',
		'',
		'<!-- steps: parsed -->',
		'',
	].join('\n'),
	'structures.md': '# Structures\n\n## Object schemas\n\n<!-- steps: objects -->\n',
	'transforms.md': '# Transforms\n\n## String transforms\n\n<!-- steps: string -->\n',
	'helpers.md': '# Helpers\n\n## Escape hatches\n\n<!-- steps: escape-hatches -->\n',
}

const config = [
	'export default {',
	'\tsidebar: [',
	'\t\t{',
	'\t\t\titems: [',
	'\t\t\t\t// #region generated-api-sidebar',
	'\t\t\t\t{ text: \'Stale\', link: \'/api/stale\' },',
	'\t\t\t\t// #endregion generated-api-sidebar',
	'\t\t\t],',
	'\t\t},',
	'\t],',
	'}',
	'',
].join('\n')

function repository(overrides: Record<string, string | null> = {}): ReturnType<typeof objectTree> {
	const files: Record<string, string> = {
		[`${stepsRoot}/index.ts`]: `${fixtures.map(fixture => `export * from './${fixture.name}'`)
			.join('\n')}\n`,
		'docs/.vitepress/config.ts': config,
	}

	for (const fixture of fixtures) {
		files[`${stepsRoot}/${fixture.name}/${fixture.name}.ts`] = main(fixture.name)
		files[`${stepsRoot}/${fixture.name}/${fixture.name}.doc.md`] = doc(fixture)
	}
	for (const [file, text] of Object.entries(templates))
		files[`scripts/docs-api-templates/${file}`] = text
	// The committed pages themselves are only read by the CLI, which compares them; the composition
	// needs them present so that the "a page nothing generates" rule has a directory to look at.
	for (const page of apiPages)
		files[`docs/api/${page.file}`] = 'stale\n'

	for (const [path, text] of Object.entries(overrides)) {
		if (text == null)
			delete files[path]
		else
			files[path] = text
	}

	return objectTree(files)
}

/** The page with its generated banner removed, so an expectation is about the composed body. */
function body(text: string): string {
	const marker = ' -->\n\n'
	const index = text.indexOf(marker)
	expect(index)
		.toBeGreaterThan(0)
	return text.slice(index + marker.length)
}

/** The single problem the tree produces, so a test cannot pass on an unrelated one. */
function onlyProblem(overrides: Record<string, string | null>): string {
	const { outputs, problems } = composeDocsApi(repository(overrides))
	expect(problems)
		.toHaveLength(1)
	// Nothing is written when anything is wrong: a partial site over the committed one would hide
	// whichever step could not be placed.
	expect(outputs.size)
		.toBe(0)
	return problems[0]!
}

describe('a complete repository', () => {
	it('composes a category page from the template and the step entry', () => {
		const { outputs, problems } = composeDocsApi(repository())
		expect(problems)
			.toEqual([])
		expect(body(outputs.get('docs/api/primitives.md')!))
			.toBe([
				'# Primitives',
				'',
				'What a primitive is.',
				'',
				'## Initial schemas',
				'',
				'### `number()` {#number}',
				'',
				'Does the thing.',
				'',
				'```ts',
				'v.number()',
				'```',
				'',
			].join('\n'))
	})

	it('marks every generated page as generated and names the command that rewrites it', () => {
		const { outputs } = composeDocsApi(repository())
		for (const page of apiPages) {
			const text = outputs.get(`docs/api/${page.file}`)!
			expect(text.startsWith('<!-- Generated file. Do not edit it'))
				.toBe(true)
			expect(text)
				.toContain('pnpm docs:api:update')
		}
	})

	it('composes the catalog as one linked bullet per step, under its section heading', () => {
		const { outputs } = composeDocsApi(repository())
		expect(body(outputs.get('docs/api/overview.md')!))
			.toBe([
				'# API Overview',
				'',
				'How to import it.',
				'',
				'## Primitives',
				'',
				'### Initial schemas',
				'',
				'- [`number()`](/api/primitives#number) — every JavaScript number',
				'',
				'## String formats',
				'',
				'### Parsed formats',
				'',
				'- [`isEmail()`](/api/formats#isEmail) — an email address',
				'',
				'## Structures',
				'',
				'### Object schemas',
				'',
				'- [`object()`](/api/structures#object) — declared own properties',
				'',
				'## Transforms',
				'',
				'### String transforms',
				'',
				'- [`toTrimmed()`](/api/transforms#toTrimmed) — trim both ends',
				'',
				'## Helpers',
				'',
				'### Escape hatches',
				'',
				'- [`check()`](/api/helpers#check) — a custom condition',
				'',
			].join('\n'))
	})

	it('splices the sidebar between its markers and leaves the rest of the config alone', () => {
		const { outputs } = composeDocsApi(repository())
		expect(outputs.get('docs/.vitepress/config.ts'))
			.toBe([
				'export default {',
				'\tsidebar: [',
				'\t\t{',
				'\t\t\titems: [',
				'\t\t\t\t// #region generated-api-sidebar',
				'\t\t\t\t{ text: \'Overview\', link: \'/api/overview\' },',
				'\t\t\t\t{ text: \'Primitives\', link: \'/api/primitives\' },',
				'\t\t\t\t{ text: \'String Formats\', link: \'/api/formats\' },',
				'\t\t\t\t{ text: \'Structures\', link: \'/api/structures\' },',
				'\t\t\t\t{ text: \'Transforms\', link: \'/api/transforms\' },',
				'\t\t\t\t{ text: \'Helpers & Utilities\', link: \'/api/helpers\' },',
				'\t\t\t\t// #endregion generated-api-sidebar',
				'\t\t\t],',
				'\t\t},',
				'\t],',
				'}',
				'',
			].join('\n'))
	})

	it('orders entries within a section by code point, whatever order the tree lists them in', () => {
		const extra: StepFixture[] = [
			{ name: 'isEmoji', category: 'formats', section: 'parsed', summary: 'one or more emoji' },
			{ name: 'isBase64', category: 'formats', section: 'parsed', summary: 'RFC 4648 base64' },
		]
		const overrides: Record<string, string> = {
			[`${stepsRoot}/index.ts`]: [...fixtures, ...extra].map(fixture => `export * from './${fixture.name}'`)
				.reverse()
				.join('\n'),
		}
		for (const fixture of extra) {
			overrides[`${stepsRoot}/${fixture.name}/${fixture.name}.ts`] = main(fixture.name)
			overrides[`${stepsRoot}/${fixture.name}/${fixture.name}.doc.md`] = doc(fixture)
		}

		const { outputs, problems } = composeDocsApi(repository(overrides))
		expect(problems)
			.toEqual([])
		expect([...body(outputs.get('docs/api/formats.md')!)
			.matchAll(/^### `(\w+)/gm)].map(match => match[1]))
			.toEqual(['isBase64', 'isEmail', 'isEmoji'])
	})

	it('reads a CRLF checkout the same as an LF one', () => {
		const lf = composeDocsApi(repository())
		const crlfFiles: Record<string, string> = {}
		const source = repository()
		const paths = [
			`${stepsRoot}/index.ts`,
			'docs/.vitepress/config.ts',
			...fixtures.flatMap(fixture => [
				`${stepsRoot}/${fixture.name}/${fixture.name}.ts`,
				`${stepsRoot}/${fixture.name}/${fixture.name}.doc.md`,
			]),
			...apiPages.map(page => `scripts/docs-api-templates/${page.file}`),
			...apiPages.map(page => `docs/api/${page.file}`),
		]
		for (const path of paths)
			crlfFiles[path] = source.read(path)!.replaceAll('\n', '\r\n')

		expect(composeDocsApi(objectTree(crlfFiles)))
			.toEqual(lf)
	})

	// The gap the CRLF case above left open, and what `windows-latest` failed on while every other
	// platform passed: the composition was already line-ending agnostic, but the committed pages it
	// is compared against were read as bytes. On a Windows checkout that is CRLF, so all seven
	// generated files came out stale on a tree nobody had edited.
	it('accepts a committed page that differs from the composition only in line endings', () => {
		const { outputs, problems } = composeDocsApi(repository())
		expect(problems)
			.toEqual([])
		const committed: Record<string, string> = {}
		for (const [path, text] of outputs)
			committed[path] = text.replaceAll('\n', '\r\n')

		expect(staleOutputs(objectTree(committed), outputs))
			.toEqual([])
	})

	it('reports a committed page that differs in content, and one that is absent', () => {
		const { outputs } = composeDocsApi(repository())
		const committed: Record<string, string> = {}
		for (const [path, text] of outputs)
			committed[path] = text
		committed['docs/api/primitives.md'] += 'a hand-edit\n'
		delete committed['docs/api/helpers.md']

		expect(staleOutputs(objectTree(committed), outputs)
			.sort())
			.toEqual(['docs/api/helpers.md', 'docs/api/primitives.md'])
	})
})

describe('anything unplaceable fails', () => {
	it('fails a step with no `.doc.md` rather than leaving it off the site', () => {
		expect(onlyProblem({ [`${stepsRoot}/number/number.doc.md`]: null }))
			.toBe(`${stepsRoot}/number/number.doc.md is missing, so the step 'number' would not appear in the reference at all. A step unit owns its documentation: write the file, then run \`pnpm docs:api:update\`.`)
	})

	it('fails a category no page claims, rather than inventing one', () => {
		expect(onlyProblem({
			[`${stepsRoot}/number/number.doc.md`]: doc({ ...fixtures[0]!, category: 'numbers' }),
		}))
			.toContain('`category: numbers` is not a page of the reference')
	})

	it('fails a section the page does not offer, and the section it left empty', () => {
		const { problems } = composeDocsApi(repository({
			[`${stepsRoot}/number/number.doc.md`]: doc({ ...fixtures[0]!, section: 'numeric' }),
		}))
		expect(problems)
			.toEqual([
				'`number` declares `section: numeric`, which scripts/docs-api-templates/primitives.md does not offer. Add a `## ` heading and a `<!-- steps: numeric -->` line there, or move the steps to a section it has.',
				'scripts/docs-api-templates/primitives.md: `<!-- steps: initial -->` is a section no step declares, so it would render as an empty heading. Remove it, or point a step\'s `section:` at it.',
			])
	})

	it('fails a category page that offers no section at all', () => {
		expect(composeDocsApi(repository({
			'scripts/docs-api-templates/helpers.md': '# Helpers\n\nProse only.\n',
		})).problems)
			.toContain('scripts/docs-api-templates/helpers.md offers no `<!-- steps: … -->` slot, so nothing can be documented on a page that claims `category: helpers`. Every step declaring that category would fail for want of a section.')
	})

	it('fails a section slot no step fills, rather than rendering an empty heading', () => {
		expect(onlyProblem({
			'scripts/docs-api-templates/structures.md': `${templates['structures.md']!}\n## Shapes\n\n<!-- steps: shapes -->\n`,
		}))
			.toContain('`<!-- steps: shapes -->` is a section no step declares')
	})

	it('fails a section slot with no heading above it to name it', () => {
		expect(onlyProblem({
			'scripts/docs-api-templates/primitives.md': '# Primitives\n\nProse.\n\n<!-- steps: initial -->\n',
		}))
			.toContain('has no `## ` heading above it')
	})

	// Both of these are page-level id collisions, which VitePress reports as
	// `User defined \`id\` attribute is not unique` without naming either cause. `json` was a real
	// one: the step's `{#json}` anchor against a `## JSON` section heading.
	it('fails a heading whose anchor is a step\'s anchor', () => {
		expect(onlyProblem({
			'scripts/docs-api-templates/primitives.md': templates['primitives.md']!.replace('## Initial schemas', '## Number'),
		}))
			.toBe('scripts/docs-api-templates/primitives.md: the heading `Number` takes the anchor `#number`, which is the anchor of the step \'number\'. Two elements would carry one id and VitePress would fail the build. Reword the heading.')
	})

	it('fails one section title used on two pages, which the catalog would write twice', () => {
		expect(onlyProblem({
			'scripts/docs-api-templates/transforms.md': templates['transforms.md']!.replace('## String transforms', '## Object schemas'),
		}))
			.toBe('`## Object schemas` names a section on structures.md and transforms.md. The catalog writes every section title on the overview page, so two of them would carry one anchor there. Give them distinct titles.')
	})

	it('fails a catalog slot naming no category', () => {
		expect(composeDocsApi(repository({
			'scripts/docs-api-templates/overview.md': `${templates['overview.md']!}\n<!-- catalog: utilities -->\n`,
		})).problems)
			.toContain('scripts/docs-api-templates/overview.md: `<!-- catalog: utilities -->` names no category of the reference.')
	})

	it('fails the same slot written twice', () => {
		expect(onlyProblem({
			'scripts/docs-api-templates/primitives.md': `${templates['primitives.md']!}\n## Again\n\n<!-- steps: initial -->\n`,
		}))
			.toContain('appears twice, which would print every step of that section twice')
	})

	it('fails a category the catalog does not list', () => {
		expect(onlyProblem({
			'scripts/docs-api-templates/overview.md': templates['overview.md']!.replace('<!-- catalog: helpers -->', ''),
		}))
			.toContain('`<!-- catalog: helpers -->` appears 0 times')
	})

	it('fails a catalog slot on a page that is not the catalog', () => {
		expect(onlyProblem({
			'scripts/docs-api-templates/structures.md': `${templates['structures.md']!}\n<!-- catalog: structures -->\n`,
		}))
			.toContain('belongs on overview.md, the one page that catalogs the whole API')
	})

	it('fails a page under docs/api that no entry in apiPages claims', () => {
		expect(onlyProblem({ 'docs/api/legacy.md': '# Legacy\n' }))
			.toContain('docs/api/legacy.md is a page no entry in `apiPages` claims')
	})

	it('fails a missing template', () => {
		expect(onlyProblem({ 'scripts/docs-api-templates/helpers.md': null }))
			.toContain('scripts/docs-api-templates/helpers.md is missing')
	})

	it('fails a config with no sidebar region', () => {
		expect(onlyProblem({ 'docs/.vitepress/config.ts': 'export default {}\n' }))
			.toContain('no `// #region generated-api-sidebar`')
	})

	it('replaces the whole verdict with a discovery problem, since the step set cannot be trusted', () => {
		const { problems } = composeDocsApi(repository({ [`${stepsRoot}/number/number.ts`]: null }))
		expect(problems)
			.toHaveLength(2)
		expect(problems[0])
			.toContain('no `number.ts`')
	})
})

describe('parseStepDoc', () => {
	it('takes the three declared fields and the body after them', () => {
		const parsed = parseStepDoc('<!-- step-doc\ncategory: formats\nsection: parsed\nsummary: an email\n-->\n\n### `isEmail()`\n\nProse.\n')
		expect(parsed.meta)
			.toEqual({ category: 'formats', section: 'parsed', summary: 'an email' })
		expect(parsed.body)
			.toBe('### `isEmail()`\n\nProse.')
		expect(parsed.problems)
			.toEqual([])
	})

	it('fails a file that does not open with the declaration block', () => {
		expect(parseStepDoc('### `isEmail()`\n\nProse.\n').problems[0])
			.toContain('does not open with a `<!-- step-doc` declaration block')
	})

	it('fails an unclosed declaration block', () => {
		expect(parseStepDoc('<!-- step-doc\ncategory: formats\n').problems[0])
			.toContain('is never closed')
	})

	it.each([
		['a missing field', '<!-- step-doc\ncategory: formats\nsection: parsed\n-->\n', 'it declares no `summary`.'],
		['a misspelled field', '<!-- step-doc\ncatgory: formats\nsection: parsed\nsummary: x\n-->\n', '`catgory` is not a step-doc field'],
		['a repeated field', '<!-- step-doc\ncategory: formats\ncategory: primitives\nsection: parsed\nsummary: x\n-->\n', '`category` is declared twice'],
		['an empty value', '<!-- step-doc\ncategory:\nsection: parsed\nsummary: x\n-->\n', '`category` is declared with no value'],
		['a stray line', '<!-- step-doc\ncategory: formats\nsection: parsed\nsummary: x\njust prose\n-->\n', 'is not a `field: value` line'],
	])('fails %s', (_label, text, expected) => {
		const parsed = parseStepDoc(text)
		expect(parsed.meta)
			.toBeNull()
		expect(parsed.problems.some(problem => problem.includes(expected)))
			.toBe(true)
	})
})

describe('renderStepEntry', () => {
	it('appends the anchor to the heading, so the catalog link cannot disagree with it', () => {
		expect(renderStepEntry('isEmail', '### `isEmail(options?)`\n\nProse.').text)
			.toBe('### `isEmail(options?)` {#isEmail}\n\nProse.')
	})

	it('fails a body whose first content is not a `### ` heading', () => {
		expect(renderStepEntry('isEmail', 'Prose first.\n\n### `isEmail()`').problems[0])
			.toContain('its first content is not a `### ` heading')
	})
})

describe('readSlots', () => {
	it('reads each slot with the nearest `## ` heading above it', () => {
		expect(readSlots('# Page\n\n## One\n\n<!-- steps: a -->\n\n## Two\n\n<!-- catalog: b -->\n'))
			.toEqual([
				{ kind: 'steps', id: 'a', line: 4, title: 'One' },
				{ kind: 'catalog', id: 'b', line: 8, title: 'Two' },
			])
	})

	it('does not read a slot that is not a line of its own', () => {
		expect(readSlots('Prose <!-- steps: a --> more prose\n'))
			.toEqual([])
	})
})
