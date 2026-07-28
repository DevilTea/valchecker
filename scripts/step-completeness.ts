import type { SourceTree } from './source-tree'
import type { DiscoveredStep } from './step-inventory'
import ts from 'typescript'
import { discoverSteps, stepsBarrel, stepsRoot } from './step-inventory'

// What a built-in step must ship with, as a pure function of a source tree.
//
// A step could ship with only `<dir>/<dir>.ts` and pass every check in `pnpm verify`: no
// colocated test, no focused benchmark, no export, no line in the API reference, its `Meta`
// buried under 120 lines of regular-expression construction and its runtime suite scattered over
// four files with four different naming schemes. All of that was held by discipline alone.
//
// The standard these rules enforce is written down once, in
// `.claude/skills/valchecker-dev/references/step-unit.md`: the file set, the auxiliary and helper
// naming patterns, and the in-file section order. This module decides the mechanical half of it;
// that reference states which half, and why the other half is review guidance.
//
// The pieces already guarded elsewhere are deliberately not repeated here:
//
// - `Meta.Name`, its agreement with the directory, and the issue-code grammar — `check-issue-codes`;
// - the PluginDef JSDoc template — `check-step-jsdoc`;
// - the parameter style and the `/* @__NO_SIDE_EFFECTS__ */` marker — `check-step-parameter-style`;
// - `<dir>/index.ts` existing at all — `packages/internal/src/steps/index.ts` imports the
//   directory, so a missing barrel is `TS2307: Cannot find module './<dir>'` from `pnpm typecheck`
//   and `pnpm build`. What it *contains* is checked here, since nothing else reads it;
// - the runtime `code:` literal matching the declared `ExecutionIssue<…>` union — the compiler
//   rejects a mismatch with `TS2322`, so no scan can add anything;
// - a cross-library scenario comparing the step against a competitor — `check-benchmark-coverage`;
// - that the discovered set of steps is the real one — `step-inventory`.
//
// ## What each rule can and cannot decide
//
// Three of these rules are weaker than the thing they stand for, and the failure messages say
// so rather than implying otherwise. A first version of this gate did imply otherwise, and an
// adversarial review walked through the gap: a test file can register a case that asserts
// `1 === 1`, and a reference page can mention a step in a sentence saying it does not exist.
//
// - **A test exists and registers a case.** Whether the case asserts anything about this step is
//   not decidable here; `it('works', () => expect(1).toBe(1))` satisfies the rule.
// - **An issue code appears in a string in the directory's tests.** Not "is asserted": the rule
//   reads string literals out of the parsed test files, which is enough to reject a code that
//   survives only in a comment, and not enough to know the string reached an assertion.
// - **A page writes the step's name in call form in a code span.** Not "describes it": the rule
//   is a match over inline code spans, so a page saying ``never use `toTrimmedStart()` `` also
//   satisfies it. What it does catch is the name disappearing from the reference entirely.
//
// The file-set and section-order rules are exact rather than weak, but they are narrower than the
// standard they come from, and for the same reason: a local `type` declaration is the same syntax
// whether it belongs to the contract above `Meta` or to the implementation below `PluginDef`. So
// the order rules pin the anchors — the declaration names, `Meta` before `PluginDef`, no value
// above `PluginDef`, the plugin last — and leave the placement of a type to review. A file can
// satisfy every rule here with `interface FlatProperties` in the wrong section.
//
// The three matching rules read only what a reader of the rendered page or the running test
// would see. HTML comments and fenced code blocks are removed from Markdown before matching,
// and comments are excluded from TypeScript by taking string literals from the AST — because a
// requirement satisfiable by writing `<!-- TODO -->` or `// FIXME` is not a requirement. Fenced
// blocks come out too: a ```` ```ts ```` block is example code, not the reference entry, and a
// span inside one is a span the earlier version accepted.
//
// Two derivations are reused rather than reinvented. Steps come from `step-inventory`, shared
// with `check-issue-codes` and `check-benchmark-coverage`. Public exports come from
// `api-surface.json`, which `check-api-surface` regenerates from the built runtime and
// declarations; scanning the barrel instead would only confirm that a line exists, not that the
// name reaches the published package under the identifier the step declares (`null` and
// `undefined` are exported as `null_` and `undefined_`).
//
// Nothing here reads the filesystem, `benchmarks/`, or YAML. Everything is matched against
// whole-file or per-span text, never against an exact line, so a CRLF checkout reads the same as
// an LF one.

export const docsApiRoot = 'docs/api'
export const catalogPage = 'overview.md'
export const apiSurfacePath = 'api-surface.json'
export const surfacePackages = ['@valchecker/internal', 'valchecker'] as const

/** Vitest's test-registering calls. `describe` is not one: a `describe` with nothing in it runs nothing. */
const testCalls = ['it', 'test'] as const
const benchCalls = ['bench'] as const

function parse(source: string): ts.SourceFile {
	return ts.createSourceFile('input.ts', source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS)
}

/**
 * Every issue code declared through `ExecutionIssue<'…'>`, the way `check-issue-codes` reads them.
 */
export function declaredCodes(source: string): string[] {
	return [...new Set([...source.matchAll(/ExecutionIssue<\s*'([^']+)'/g)].map(match => match[1]!))]
}

/**
 * The text of every string in the file, from the parsed AST.
 *
 * Template literals contribute their fixed parts, because an inline snapshot holds the code in
 * one. Comments are trivia and never appear, which is the point: a code mentioned only in a
 * `// FIXME` is a code no test names.
 */
export function stringLiteralTexts(source: string): string[] {
	const texts: string[] = []
	const visit = (node: ts.Node): void => {
		if (ts.isStringLiteralLike(node)) {
			texts.push(node.text)
		}
		else if (ts.isTemplateExpression(node)) {
			texts.push(node.head.text)
			for (const span of node.templateSpans)
				texts.push(span.literal.text)
		}
		ts.forEachChild(node, visit)
	}
	ts.forEachChild(parse(source), visit)
	return texts
}

/** The identifier a call's callee ultimately starts from, so `it.each([…])('…')` reports `it`. */
function rootIdentifier(node: ts.Node): string | null {
	let current = node
	for (;;) {
		if (ts.isIdentifier(current))
			return current.text
		if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current) || ts.isParenthesizedExpression(current) || ts.isNonNullExpression(current) || ts.isCallExpression(current))
			current = current.expression
		else if (ts.isTaggedTemplateExpression(current))
			current = current.tag
		else
			return null
	}
}

/** Whether the file calls any of `names`, however the call is qualified or tagged. */
export function callsAnyOf(source: string, names: readonly string[]): boolean {
	const wanted = new Set(names)
	let found = false
	const visit = (node: ts.Node): void => {
		if (found)
			return
		if (ts.isCallExpression(node) || ts.isTaggedTemplateExpression(node)) {
			const root = rootIdentifier(ts.isCallExpression(node) ? node.expression : node.tag)
			if (root != null && wanted.has(root)) {
				found = true
				return
			}
		}
		ts.forEachChild(node, visit)
	}
	ts.forEachChild(parse(source), visit)
	return found
}

/** `kebab-case`: the shape a helper module's file name takes. */
export function isKebabCase(stem: string): boolean {
	return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(stem)
}

const fileSetRule = 'A step unit holds `<name>.ts`, `<name>.test.ts`, `<name>.bench.ts`, `index.ts`, optionally `<name>.types.test.ts`, and kebab-case helper modules each with an optional test — nothing else.'

/**
 * Every entry in a step directory the step-unit standard does not name.
 *
 * A helper module is recognised first, so its own `<helper>.test.ts` is allowed and a `.test.ts`
 * with no module of that name is not. That is what separates a helper suite from a slice of the
 * step's own contract filed under a name of its own: `base64url.test.ts` beside `base64url.ts` is
 * the first, and `collectAllIssues.test.ts` or `map.async.test.ts` is the second.
 */
export function unexpectedEntries(entries: readonly string[], directory: string): string[] {
	const required = new Set([`${directory}.ts`, `${directory}.test.ts`, `${directory}.bench.ts`, 'index.ts'])
	const known = new Set([...required, `${directory}.types.test.ts`])

	const helpers = new Set(
		entries
			.filter(entry => entry.endsWith('.ts') && !entry.endsWith('.test.ts') && !known.has(entry))
			.map(entry => entry.slice(0, -'.ts'.length))
			.filter(isKebabCase),
	)

	const problems: string[] = []
	for (const entry of [...entries].sort()) {
		if (known.has(entry))
			continue

		if (entry.endsWith('.test.ts')) {
			const stem = entry.slice(0, -'.test.ts'.length)
			if (helpers.has(stem))
				continue
			problems.push(isKebabCase(stem)
				? `\`${entry}\` reads as the suite for \`${stem}.ts\`, which this directory does not hold. A test file is named after the module it tests: fold it into \`${directory}.test.ts\` as another \`describe\`, or move it to \`${stepsRoot}/<family>.<aspect>.test.ts\` if it is a contract spanning several steps.`
				: `\`${entry}\` is a slice of one step's suite filed under a name of its own. Fold it into \`${directory}.test.ts\` as another \`describe\`; the only auxiliary test the standard names is \`${directory}.types.test.ts\`, whose assertions \`pnpm typecheck\` decides rather than the vitest run. A contract spanning several steps goes to \`${stepsRoot}/<family>.<aspect>.test.ts\` instead.`)
			continue
		}

		if (entry.endsWith('.bench.ts')) {
			problems.push(`\`${entry}\` is a second benchmark file. A step has one, \`${directory}.bench.ts\`, and it is the unit the performance gate selects.`)
			continue
		}

		if (entry.endsWith('.ts')) {
			if (helpers.has(entry.slice(0, -'.ts'.length)))
				continue
			problems.push(`\`${entry}\` is a helper module whose name is not kebab-case. Name it after the concept it owns, the way \`base64url.ts\` and \`iso-calendar-date.ts\` do.`)
			continue
		}

		problems.push(`\`${entry}\` is not part of a step unit. ${fileSetRule}`)
	}

	for (const entry of [...required].sort()) {
		// `<name>.ts` is `step-inventory`'s discovery key and never reaches here missing; the test
		// and bench files have their own rules with their own reasons. That leaves the barrel.
		if (entry === 'index.ts' && !entries.includes(entry))
			problems.push(`no \`index.ts\`. It is what \`${stepsBarrel}\` imports, and it holds exactly \`export * from './${directory}'\`.`)
	}

	return problems
}

/**
 * Where the steps root itself departs from the standard.
 *
 * The root holds the barrel, the modules shared across step directories, and the cross-step tests
 * — a contract spanning a family of steps, belonging to no one of them. Those are named
 * `<family>.<aspect>.test.ts` so that a test of a single step cannot sit among them looking like
 * one. Step directories are skipped: they have their own rules.
 */
export function stepsRootProblems(tree: SourceTree): string[] {
	const problems: string[] = []

	for (const entry of [...tree.list(stepsRoot) ?? []].sort()) {
		if (entry === 'index.ts' || tree.isDirectory(`${stepsRoot}/${entry}`))
			continue

		if (entry.endsWith('.test.ts')) {
			const parts = entry.slice(0, -'.test.ts'.length)
				.split('.')
			if (parts.length === 2 && parts.every(isKebabCase))
				continue
			problems.push(`${stepsRoot}/${entry}: a cross-step test is named \`<family>.<aspect>.test.ts\` with both parts kebab-case, the way \`structural.sync-fast-path.test.ts\` and \`failure-payload.types.test.ts\` are. A test belonging to one step goes in that step's directory instead.`)
			continue
		}

		if (entry.endsWith('.ts')) {
			if (isKebabCase(entry.slice(0, -'.ts'.length)))
				continue
			problems.push(`${stepsRoot}/${entry}: a module shared across step directories is kebab-case, the same as a helper module inside one.`)
			continue
		}

		problems.push(`${stepsRoot}/${entry}: the steps root holds \`index.ts\`, kebab-case shared modules, and cross-step tests — nothing else.`)
	}

	return problems
}

/** The barrel is one line. A helper module is reached by direct relative path, never re-exported. */
export function barrelProblems(barrel: string | null, directory: string): string[] {
	if (barrel == null)
		return []
	const expected = `export * from './${directory}'`
	return barrel.trim() === expected
		? []
		: [`\`index.ts\` is not exactly \`${expected}\`. A step's barrel re-exports the step and nothing else: another step reaching a helper module imports it by direct relative path, so re-exporting one here would publish it by accident.`]
}

function isPluginConstruction(statement: ts.Statement): boolean {
	if (!ts.isVariableStatement(statement))
		return false
	const initializer = statement.declarationList.declarations[0]?.initializer
	return initializer != null
		&& ts.isCallExpression(initializer)
		&& rootIdentifier(initializer.expression) === 'implStepPlugin'
}

/** The name a value declaration introduces, or `null` when the statement declares no value. */
function declaredValueName(statement: ts.Statement): string | null {
	if (ts.isVariableStatement(statement)) {
		const name = statement.declarationList.declarations[0]?.name
		return name != null && ts.isIdentifier(name) ? name.text : 'a destructured binding'
	}
	if (ts.isFunctionDeclaration(statement))
		return statement.name?.text ?? 'an anonymous function'
	if (ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement))
		return statement.name?.text ?? 'an anonymous class'
	return null
}

/**
 * Where `<name>.ts` departs from the canonical section order and the fixed declaration names.
 *
 * Only the syntactic half of the order is decidable here. A local type declaration is the same
 * syntax whether it belongs to the contract above `Meta` or to the implementation below
 * `PluginDef`, so which of the two a type belongs to stays review guidance; `step-unit.md` says so
 * in the same words.
 */
export function declarationProblems(source: string, directory: string): string[] {
	const statements = parse(source).statements
	const problems: string[] = []

	let meta = -1
	let pluginDef = -1
	let plugin = -1
	let firstValue = -1
	let firstValueName = ''

	statements.forEach((statement, index) => {
		if (ts.isModuleDeclaration(statement) && ts.isIdentifier(statement.name) && statement.name.text !== 'Internal')
			problems.push(`the local issue namespace is \`${statement.name.text}\`, not \`Internal\`. No other module can see it, so a prefix only costs a reader comparing two steps.`)

		if (ts.isTypeAliasDeclaration(statement) && statement.name.text === 'Meta')
			meta = index
		else if (ts.isInterfaceDeclaration(statement) && statement.name.text === 'PluginDef')
			pluginDef = index

		if (isPluginConstruction(statement)) {
			plugin = index
			return
		}
		if (firstValue === -1) {
			const name = declaredValueName(statement)
			if (name != null) {
				firstValue = index
				firstValueName = name
			}
		}
	})

	if (meta === -1)
		problems.push('no `type Meta` declaration. A step declares its name, expected state, and owned issues as `type Meta`, whatever type parameters it takes.')
	if (pluginDef === -1)
		problems.push('no `interface PluginDef extends TStepPluginDef` declaration. A generic step still names it `PluginDef`.')

	if (meta !== -1 && pluginDef !== -1 && meta > pluginDef)
		problems.push('`PluginDef` is declared before `Meta`. `Meta` comes first: it is what `PluginDef` is written against.')

	if (pluginDef !== -1 && firstValue !== -1 && firstValue < pluginDef)
		problems.push(`\`${firstValueName}\` is declared above \`PluginDef\`. Constants and functions the runtime reaches go below it, so opening the file shows what the step does before how — nothing forward-references, because the only statement that reads them is the last one.`)

	if (plugin === -1)
		problems.push(`no \`export const … = implStepPlugin<PluginDef>(…)\` statement, so this file publishes no step.`)
	else if (plugin !== statements.length - 1)
		problems.push(`the \`implStepPlugin\` construction is not the last statement in the file. It is the unit's product and its only export, and \`/* @__NO_SIDE_EFFECTS__ */\` has to stay immediately above it.`)

	return problems.map(problem => `${directory}.ts: ${problem}`)
}

/** HTML comments blanked out, keeping every newline so the line structure survives. */
export function stripHtmlComments(markdown: string): string {
	return markdown.replace(/<!--[\s\S]*?-->/g, match => match.replace(/[^\n]/g, ' '))
}

/**
 * The page with every fenced code block removed, delimiters included.
 *
 * CommonMark's rule: up to three spaces of indent, three or more backticks or tildes, closed by
 * a run of the same character at least as long. An unclosed fence runs to the end of the
 * document, which is also CommonMark's rule.
 */
export function outsideFencedBlocks(markdown: string): string {
	const kept: string[] = []
	let fence: string | null = null
	for (const line of markdown.split(/\r?\n/)) {
		const delimiter = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1]
		if (fence == null) {
			if (delimiter == null)
				kept.push(line)
			else
				fence = delimiter
			continue
		}
		if (delimiter != null && delimiter[0] === fence[0] && delimiter.length >= fence.length)
			fence = null
	}
	return kept.join('\n')
}

/** What a reader of the rendered page sees: no HTML comments, no fenced examples. */
export function visibleMarkdown(markdown: string): string {
	return outsideFencedBlocks(stripHtmlComments(markdown))
}

/**
 * The contents of every inline code span on a page.
 *
 * The reference writes API names in code spans — table cells, bullets, and headings alike — so a
 * step is looked for there rather than in prose. Pass the page through `visibleMarkdown` first:
 * a span may not contain a backtick or a newline, but that does not stop one from appearing
 * inside a fenced block or an HTML comment, which is how the first version of this rule was
 * satisfied by the line `// \`toTrimmedStart()\` — removed in 2.0`.
 */
export function codeSpans(page: string): string[] {
	return [...page.matchAll(/`([^`\n]+)`/g)].map(match => match[1]!)
}

/**
 * Whether some span writes the step in call form.
 *
 * The name must be followed by `(` or `<` and must not continue an identifier, so `isEmpty`
 * cannot be satisfied by `isNotEmpty(`. A receiver is allowed, because the reference documents
 * chained steps against the schema that offers them, as in `bigint().toSafeNumber(options?)`.
 */
export function documents(spans: string[], name: string): boolean {
	const pattern = new RegExp(`(?<![\\w$])${name}\\s*[(<]`)
	return spans.some(span => pattern.test(span))
}

/** Every Markdown page under `docs/api`, keyed by its path relative to that directory. */
export function readApiReference(tree: SourceTree): Map<string, string> {
	const pages = new Map<string, string>()

	const visit = (directory: string, prefix: string): void => {
		for (const entry of [...tree.list(directory) ?? []].sort()) {
			const entryPath = `${directory}/${entry}`
			if (tree.isDirectory(entryPath)) {
				if (entry !== 'node_modules')
					visit(entryPath, `${prefix}${entry}/`)
				continue
			}
			if (entry.endsWith('.md'))
				pages.set(`${prefix}${entry}`, tree.read(entryPath) ?? '')
		}
	}

	visit(docsApiRoot, '')
	return pages
}

function readPublicExports(tree: SourceTree): { exports: Record<string, Set<string>>, problems: string[] } {
	const text = tree.read(apiSurfacePath)
	if (text == null)
		return { exports: {}, problems: [`${apiSurfacePath} is missing. Regenerate it with \`pnpm api:surface:update\`.`] }

	const surface = JSON.parse(text) as Record<string, { runtime?: unknown } | undefined>
	const exports: Record<string, Set<string>> = {}
	const problems: string[] = []

	for (const packageName of surfacePackages) {
		const runtime = surface[packageName]?.runtime
		if (!Array.isArray(runtime) || runtime.length === 0)
			problems.push(`${apiSurfacePath}: no runtime export list for '${packageName}'. Regenerate it with \`pnpm api:surface:update\`.`)
		else
			exports[packageName] = new Set(runtime as string[])
	}

	return { exports, problems }
}

export interface CompletenessReport {
	/** Everything wrong, grouped by step, plus any reason the inputs could not be trusted. */
	errors: string[]
	/** Steps with nothing missing. */
	complete: number
	/** Steps discovered at all. */
	total: number
}

function testFileNames(tree: SourceTree, directory: string): string[] {
	return [...tree.list(`${stepsRoot}/${directory}`) ?? []]
		.filter(entry => entry.endsWith('.test.ts'))
		.sort()
}

interface StepWithCodes extends DiscoveredStep {
	/** Every issue code the step declares it owns. */
	codes: string[]
}

function missingPieces(tree: SourceTree, step: StepWithCodes, context: {
	catalogSpans: string[]
	detailSpans: string[]
	referenceText: string
	exports: Record<string, Set<string>>
}): string[] {
	const missing: string[] = []
	const directory = `${stepsRoot}/${step.directory}`

	missing.push(...unexpectedEntries(tree.list(directory) ?? [], step.directory))
	missing.push(...barrelProblems(tree.read(`${directory}/index.ts`), step.directory))
	missing.push(...declarationProblems(step.source, step.directory))

	const test = tree.read(`${directory}/${step.directory}.test.ts`)
	if (test == null)
		missing.push(`no colocated \`${step.directory}.test.ts\`. Coverage does not stand in for it: other steps' tests execute this one, so removing a step's own test file leaves the per-file floor intact about half the time.`)
	else if (!callsAnyOf(test, testCalls))
		missing.push(`\`${step.directory}.test.ts\` calls no \`it\` or \`test\`, so it registers no case at all. This rule only checks that a case exists — it cannot tell an assertion about this step from \`expect(1).toBe(1)\`.`)

	const bench = tree.read(`${directory}/${step.directory}.bench.ts`)
	if (bench == null)
		missing.push(`no focused \`${step.directory}.bench.ts\`. Copy the closest step's and replace its inputs with ones that exercise this step; it is the only benchmark file a step unit holds.`)
	else if (!callsAnyOf(bench, benchCalls))
		missing.push(`\`${step.directory}.bench.ts\` calls no \`bench\`, so \`vitest bench\` measures nothing for this step.`)

	for (const [packageName, identifiers] of Object.entries(context.exports)) {
		if (!identifiers.has(step.exportIdentifier))
			missing.push(`\`${step.exportIdentifier}\` is not a runtime export of '${packageName}' in ${apiSurfacePath}. Add the step to \`${stepsRoot}/index.ts\` if it is missing there, then run \`pnpm api:surface:update\`.`)
	}

	if (!documents(context.catalogSpans, step.name))
		missing.push(`no code span in ${docsApiRoot}/${catalogPage} writes \`${step.name}(\`, so the catalog of the public API does not list it. The rule matches the name in call form inside an inline code span, outside fenced blocks and HTML comments; it does not read the sentence around it.`)

	if (!documents(context.detailSpans, step.name))
		missing.push(`no ${docsApiRoot} page other than ${catalogPage} writes \`${step.name}(\` in a code span, so the catalog points at nothing. As above, this finds a mention in call form rather than a description.`)

	if (step.codes.length > 0) {
		const literals = testFileNames(tree, step.directory)
			.flatMap(entry => stringLiteralTexts(tree.read(`${directory}/${entry}`) ?? ''))
		for (const code of step.codes) {
			if (!context.referenceText.includes(code))
				missing.push(`the owned issue code \`${code}\` appears nowhere under ${docsApiRoot} outside fenced blocks and HTML comments. A consumer handling this failure has nothing to read.`)
			if (!literals.some(literal => literal.includes(code)))
				missing.push(`the owned issue code \`${code}\` appears in no string of any \`*.test.ts\` in this directory, so a change to it would break consumers with every test still green. A mention in a comment does not count; the rule reads string literals, not whether one reached an assertion.`)
		}
	}

	return missing
}

export function checkStepCompleteness(tree: SourceTree): CompletenessReport {
	const { steps, problems } = discoverSteps(tree)
	const errors = [...problems]

	const pages = readApiReference(tree)
	const catalog = pages.get(catalogPage)
	if (catalog == null)
		errors.push(`${docsApiRoot}/${catalogPage} is missing; it is the catalog every built-in step must appear in.`)

	const { exports, problems: surfaceProblems } = readPublicExports(tree)
	errors.push(...surfaceProblems)

	// A problem above means the inputs are incomplete, so a per-step verdict would be a verdict
	// about a tree this gate could not read. Report the problem and stop.
	if (errors.length > 0)
		return { errors, complete: 0, total: steps.length }

	const visible = new Map([...pages].map(([page, text]) => [page, visibleMarkdown(text)]))
	const context = {
		catalogSpans: codeSpans(visible.get(catalogPage)!),
		detailSpans: [...visible]
			.filter(([page]) => page !== catalogPage)
			.flatMap(([, text]) => codeSpans(text)),
		referenceText: [...visible.values()].join('\n'),
		exports,
	}

	let complete = 0
	for (const step of steps.map(step => ({ ...step, codes: declaredCodes(step.source) }))) {
		const missing = missingPieces(tree, step, context)
		if (missing.length === 0) {
			complete++
			continue
		}
		errors.push(`${stepsRoot}/${step.directory}: the step '${step.name}' does not meet the step-unit standard.\n${missing.map(item => `  - ${item}`)
			.join('\n')}`)
	}

	errors.push(...stepsRootProblems(tree))

	return { errors, complete, total: steps.length }
}

/** What a passing run prints. Kept beside the rules so it cannot describe a stronger gate than they are. */
export function successMessage(report: CompletenessReport): string {
	return [
		`Built-in steps are complete: ${report.complete} steps each hold only the files a step unit names,`,
		'a one-line `index.ts`, a `<name>.ts` declaring `Meta` then `PluginDef` above every value and ending in its plugin,',
		'a `<name>.test.ts` registering at least one case,',
		'a `<name>.bench.ts` calling `bench`, a runtime export in api-surface.json,',
		`their name in call form in a code span in ${docsApiRoot}/${catalogPage} and on one further ${docsApiRoot} page,`,
		'and every owned issue code both present under docs/api and present in a string in their own tests.',
		'The three matching rules find mentions, not meaning: they cannot tell a real assertion from a tautology,',
		'or a description from a passing reference; and the order rules pin the anchors, not where a type belongs.',
	].join(' ')
}
