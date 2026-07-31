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
// - **A test exists and contains module-scope Vitest case-registration syntax.** Whether the call
//   executes or the case asserts anything about this step is not decidable here: arbitrary control
//   flow is not interpreted, and `it('works', () => expect(1).toBe(1))` satisfies the rule. The
//   scan follows top-level syntax and callbacks passed directly to imported `describe`/`suite`
//   calls, while skipping dormant function and class bodies.
// - **An issue code appears in a string in the directory's tests.** Not "is asserted": the rule
//   reads string literals out of the parsed test files, which is enough to reject a code that
//   survives only in a comment, and not enough to know the string reached an assertion.
// - **The step's `<name>.doc.md` opens with a `### ` heading writing it in call form, carries a
//   description and a `ts` example, and names every issue code it owns in a code span.** Not "the
//   entry is right": the rule is a match over inline code spans and a non-empty region of prose, so
//   an entry saying ``never use `toTrimmedStart()` `` satisfies the heading rule the same way the
//   page rule it replaced did.
//
//   That rule is nonetheless strictly stronger than the two it replaced. The old pair asked that
//   *some* code span *somewhere* under `docs/api` wrote the name in call form, on the catalog page
//   and on one further page, and that the issue code appeared *somewhere* on any of those pages —
//   satisfiable by a page describing a different step, and satisfied for a step whose own section
//   had been deleted as long as another entry mentioned it in passing. Now the entry has to exist,
//   in the step's own directory, holding its own name, its own description, its own example, and
//   its own codes. `docs/api` is generated from these files by `scripts/docs-api.ts`, so it can no
//   longer be a second hand-maintained copy for a rule to be satisfied by.
//
// - **A helper module is one the step reaches.** Reached, not used: `import './x'` in `<name>.ts`
//   satisfies it. That is a deliberate floor rather than an accident — the first version required
//   only that the file exist, and a one-line `lazy-output.ts` containing `export {}` then
//   re-admitted the 231-line suite this standard was written to fold in.
// - **Only erased syntax may precede `PluginDef`.** Which section a *type* belongs to is not
//   decidable here: a contract type above `Meta` and an implementation type below `PluginDef` are
//   the same syntax. A file can satisfy every rule with `interface FlatProperties` in the wrong
//   section, and a test pins that it is accepted either way.
//
// Both of those, and the steps-root rule, were weaker than they read until an adversarial review
// walked past them — through a fake helper pair, a non-`declare` namespace holding a `const`, a
// second `implStepPlugin` call, and `map.async.test.ts` moved one directory up. Each hole is now
// closed and has a test named after it, which is why the wording above claims a floor rather than
// a guarantee.
//
// The matching rules read only what a reader of the rendered entry or the running test would
// see. HTML comments and fenced code blocks are removed from Markdown before matching, and
// comments are excluded from TypeScript by taking string literals from the AST — because a
// requirement satisfiable by writing `<!-- TODO -->` or `// FIXME` is not a requirement. Fenced
// blocks come out too: a ```` ```ts ```` block is example code, not the reference entry, and a
// span inside one is a span the earlier version accepted. Stripping HTML comments is also what
// keeps the `<!-- step-doc -->` declaration block from satisfying anything: a `summary:` line
// holding a code span is a declaration, not documentation.
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

export const apiSurfacePath = 'api-surface.json'
export const surfacePackages = ['@valchecker/internal', 'valchecker'] as const

/** Vitest's test-registering calls. `describe` is not one: a `describe` with nothing in it runs nothing. */
const testCalls = ['it', 'test'] as const
/**
 * What a bench file calls to declare its cells. Not `bench` itself: a cell carries the
 * group it aggregates into, what executing it must produce, and how many iterations make
 * one measured unit, none of which fits `bench(name, fn)`. `stepBench()` registers the
 * declaration with vitest for `pnpm bench` and with the registry the impact gate reads, so
 * one call is what makes a step's cells reachable by both drivers.
 */
const cellDeclarationCalls = ['stepBench'] as const
/** What makes a `*.types.test.ts` a type-level suite rather than a runtime one under that name. */
const typeAssertionCalls = ['expectTypeOf', 'assertType'] as const

function parse(source: string): ts.SourceFile {
	return ts.createSourceFile('input.ts', source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS)
}

/** One in-memory file with enough binding information to distinguish imports from shadows. */
function checkedSource(source: string): { sourceFile: ts.SourceFile, checker: ts.TypeChecker } {
	const sourceFile = parse(source)
	const host: ts.CompilerHost = {
		fileExists: fileName => fileName === sourceFile.fileName,
		getCanonicalFileName: fileName => fileName,
		getCurrentDirectory: () => '',
		getDefaultLibFileName: () => 'lib.d.ts',
		getNewLine: () => '\n',
		getSourceFile: fileName => fileName === sourceFile.fileName ? sourceFile : undefined,
		readFile: fileName => fileName === sourceFile.fileName ? source : undefined,
		useCaseSensitiveFileNames: () => true,
		writeFile: () => {},
	}
	const program = ts.createProgram({
		rootNames: [sourceFile.fileName],
		options: { noLib: true },
		host,
	})
	return { sourceFile, checker: program.getTypeChecker() }
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

/** The identifier node a call's callee ultimately starts from. */
function rootIdentifierNode(node: ts.Node): ts.Identifier | null {
	let current = node
	for (;;) {
		if (ts.isIdentifier(current))
			return current
		if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current) || ts.isParenthesizedExpression(current) || ts.isNonNullExpression(current) || ts.isCallExpression(current))
			current = current.expression
		else if (ts.isTaggedTemplateExpression(current))
			current = current.tag
		else
			return null
	}
}

/** The identifier a call's callee ultimately starts from, so `it.each([…])('…')` reports `it`. */
function rootIdentifier(node: ts.Node): string | null {
	return rootIdentifierNode(node)?.text ?? null
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

/** Local names imported from `moduleName` for one of `names`, including aliased imports. */
function importedNames(sourceFile: ts.SourceFile, moduleName: string, names: readonly string[]): Set<string> {
	const wanted = new Set(names)
	const imported = new Set<string>()
	for (const statement of sourceFile.statements) {
		if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)
			|| statement.moduleSpecifier.text !== moduleName) {
			continue
		}
		const bindings = statement.importClause?.namedBindings
		if (bindings == null || !ts.isNamedImports(bindings))
			continue
		for (const element of bindings.elements) {
			if (wanted.has(element.propertyName?.text ?? element.name.text))
				imported.add(element.name.text)
		}
	}
	return imported
}

/** Symbols imported from `moduleName`, so a nested binding with the same spelling does not count. */
function importedSymbols(
	sourceFile: ts.SourceFile,
	checker: ts.TypeChecker,
	moduleName: string,
	names: readonly string[],
): Set<ts.Symbol> {
	const wanted = new Set(names)
	const imported = new Set<ts.Symbol>()
	for (const statement of sourceFile.statements) {
		if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)
			|| statement.moduleSpecifier.text !== moduleName) {
			continue
		}
		const bindings = statement.importClause?.namedBindings
		if (bindings == null || !ts.isNamedImports(bindings))
			continue
		for (const element of bindings.elements) {
			if (statement.importClause?.isTypeOnly === true || element.isTypeOnly)
				continue
			if (!wanted.has(element.propertyName?.text ?? element.name.text))
				continue
			const symbol = checker.getSymbolAtLocation(element.name)
			if (symbol != null)
				imported.add(symbol)
		}
	}
	return imported
}

/** Whether `identifier` resolves to one of the selected import bindings. */
function isImportedBinding(
	identifier: ts.Identifier | null,
	checker: ts.TypeChecker,
	imports: ReadonlySet<ts.Symbol>,
): boolean {
	const symbol = identifier == null ? null : checker.getSymbolAtLocation(identifier)
	return symbol != null && imports.has(symbol)
}

/**
 * Whether module-scope syntax holds a registration-shaped call imported from `moduleName`.
 *
 * Function and class bodies are not module evaluation. The exception is a callback passed directly
 * to an imported `describe` or `suite`: Vitest executes that callback to register the cases inside
 * it, including nested suites. This is intentionally a syntactic floor, not a JavaScript
 * interpreter; arbitrary conditional control flow remains one of the limits the success message
 * names.
 */
function hasModuleScopeImportedCall(
	source: string,
	moduleName: string,
	names: readonly string[],
	registrars: readonly string[] = [],
): boolean {
	const { sourceFile, checker } = checkedSource(source)
	const targets = importedSymbols(sourceFile, checker, moduleName, names)
	if (targets.size === 0)
		return false
	const suites = importedSymbols(sourceFile, checker, moduleName, registrars)
	let found = false

	const visit = (node: ts.Node): void => {
		if (found)
			return
		if (ts.isFunctionLike(node) || ts.isClassLike(node))
			return
		if (ts.isCallExpression(node) || ts.isTaggedTemplateExpression(node)) {
			const root = rootIdentifierNode(ts.isCallExpression(node) ? node.expression : node.tag)
			if (isImportedBinding(root, checker, targets)) {
				found = true
				return
			}
			if (ts.isCallExpression(node) && isImportedBinding(root, checker, suites)) {
				for (const argument of node.arguments) {
					if (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument))
						visit(argument.body)
				}
			}
		}
		ts.forEachChild(node, visit)
	}
	for (const statement of sourceFile.statements)
		visit(statement)
	return found
}

/** Whether a call imported from `moduleName` appears anywhere, including in type-test helpers. */
function callsImportedAnyOf(source: string, moduleName: string, names: readonly string[]): boolean {
	const { sourceFile, checker } = checkedSource(source)
	const imports = importedSymbols(sourceFile, checker, moduleName, names)
	if (imports.size === 0)
		return false
	let found = false
	const visit = (node: ts.Node): void => {
		if (found)
			return
		if (ts.isCallExpression(node) || ts.isTaggedTemplateExpression(node)) {
			const root = rootIdentifierNode(ts.isCallExpression(node) ? node.expression : node.tag)
			if (isImportedBinding(root, checker, imports)) {
				found = true
				return
			}
		}
		ts.forEachChild(node, visit)
	}
	ts.forEachChild(sourceFile, visit)
	return found
}

/** `kebab-case`: the shape a helper module's file name takes. */
export function isKebabCase(stem: string): boolean {
	return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(stem)
}

const fileSetRule = 'A step unit holds `<name>.ts`, `<name>.test.ts`, `<name>.bench.ts`, `<name>.doc.md`, `index.ts`, optionally `<name>.types.test.ts`, and kebab-case helper modules the step imports, each with an optional test — nothing else.'

/** Every `./x` a module imports or re-exports, so a helper can be told from a file nothing reaches. */
export function localSpecifiers(source: string): string[] {
	const names: string[] = []
	for (const statement of parse(source).statements) {
		const specifier = (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement))
			? statement.moduleSpecifier
			: undefined
		if (specifier != null && ts.isStringLiteral(specifier) && specifier.text.startsWith('./'))
			names.push(specifier.text.slice('./'.length))
	}
	return names
}

/**
 * Every entry in a step directory the step-unit standard does not name.
 *
 * A helper module is recognised first, so its own `<helper>.test.ts` is allowed and a `.test.ts`
 * with no module of that name is not. What makes that a real distinction rather than a spelling
 * one is the reachability requirement: a helper is a module the step's own source reaches, directly
 * or through another helper. Without it the rule cost one line to defeat — `lazy-output.ts`
 * containing `export {}` re-admitted the 231-line `lazy-output.test.ts` this standard exists to
 * fold in, and an adversarial review demonstrated exactly that.
 *
 * The limit that remains: a helper is reached, not *used*. Adding `import './lazy-output'` to
 * `<name>.ts` would satisfy this, at the cost of an import a reviewer reads in the implementation.
 */
export function unexpectedEntries(tree: SourceTree, directory: string): string[] {
	const entries = [...tree.list(`${stepsRoot}/${directory}`) ?? []]
	const required = [`${directory}.ts`, `${directory}.test.ts`, `${directory}.bench.ts`, `${directory}.doc.md`, 'index.ts']
	const known = new Set([...required, `${directory}.types.test.ts`])

	const candidates = entries
		.filter(entry => entry.endsWith('.ts') && !entry.endsWith('.test.ts') && !known.has(entry))
		.map(entry => entry.slice(0, -'.ts'.length))
		.filter(isKebabCase)

	// Reachability from the step's own source, following helper-to-helper imports. Start at the
	// step, rather than flattening every helper's imports into one set: two otherwise-unreachable
	// helpers importing each other are still not reached by the step.
	const reached = new Set<string>()
	const candidateSet = new Set(candidates)
	const pending = [...localSpecifiers(tree.read(`${stepsRoot}/${directory}/${directory}.ts`) ?? '')]
	while (pending.length > 0) {
		const stem = pending.shift()!
		if (!candidateSet.has(stem) || reached.has(stem))
			continue
		reached.add(stem)
		pending.push(...localSpecifiers(tree.read(`${stepsRoot}/${directory}/${stem}.ts`) ?? ''))
	}

	const problems: string[] = []
	for (const entry of [...entries].sort()) {
		if (known.has(entry))
			continue

		if (entry.endsWith('.test.ts')) {
			const stem = entry.slice(0, -'.test.ts'.length)
			const helperStem = stem.endsWith('.types') ? stem.slice(0, -'.types'.length) : stem
			if (reached.has(helperStem))
				continue
			problems.push(isKebabCase(helperStem)
				? `\`${entry}\` reads as the suite for \`${helperStem}.ts\`, which this directory does not hold, or holds without the step reaching it. A test file is named after the module it tests: fold it into \`${directory}.test.ts\` as another \`describe\`, or move it to \`${stepsRoot}/<family>.<aspect>.test.ts\` if it is a contract spanning several steps.`
				: `\`${entry}\` is a slice of one step's suite filed under a name of its own. Fold it into \`${directory}.test.ts\` as another \`describe\`; the only auxiliary test the standard names is \`${directory}.types.test.ts\`, whose assertions \`pnpm typecheck\` decides rather than the vitest run. A contract spanning several steps goes to \`${stepsRoot}/<family>.<aspect>.test.ts\` instead.`)
			continue
		}

		if (entry.endsWith('.bench.ts')) {
			problems.push(`\`${entry}\` is a second benchmark file. A step has one, \`${directory}.bench.ts\`.`)
			continue
		}

		if (entry.endsWith('.ts')) {
			const stem = entry.slice(0, -'.ts'.length)
			if (reached.has(stem))
				continue
			problems.push(isKebabCase(stem)
				? `\`${entry}\` is a module nothing in this step reaches. A helper module is imported by \`${directory}.ts\` or by another helper beside it; a file only its own test imports is a suite filed under a module's name.`
				: `\`${entry}\` is a helper module whose name is not kebab-case. Name it after the concept it owns, the way \`base64url.ts\` and \`iso-calendar-date.ts\` do.`)
			continue
		}

		problems.push(`\`${entry}\` is not part of a step unit. ${fileSetRule}`)
	}

	// `<name>.ts` is `step-inventory`'s discovery key and never reaches here missing; the test and
	// bench files have their own rules with their own reasons. That leaves the barrel.
	if (!entries.includes('index.ts'))
		problems.push(`no \`index.ts\`. It is what \`${stepsBarrel}\` imports, and it holds exactly \`export * from './${directory}'\`.`)

	return problems
}

/**
 * Where the steps root itself departs from the standard.
 *
 * The root holds the barrel, the modules shared across step directories, and the cross-step tests
 * — a contract spanning a family of steps, belonging to no one of them. Those are named
 * `<family>.<aspect>.test.ts` so that a test of a single step cannot sit among them looking like
 * one.
 *
 * `<family>` must therefore not be a step. Checking only the two-part shape left the rule
 * satisfied by `map.async.test.ts` — one of the files this standard was written to eliminate,
 * moved up one directory — because every all-lowercase step directory name is also a valid
 * `kebab-case` family. Step directories themselves are skipped: they have their own rules.
 */
export function stepsRootProblems(tree: SourceTree, stepDirectories: ReadonlySet<string>): string[] {
	const problems: string[] = []

	for (const entry of [...tree.list(stepsRoot) ?? []].sort()) {
		if (entry === 'index.ts' || tree.isDirectory(`${stepsRoot}/${entry}`))
			continue

		if (entry.endsWith('.test.ts')) {
			const parts = entry.slice(0, -'.test.ts'.length)
				.split('.')
			if (parts.length === 2 && parts.every(isKebabCase)) {
				if (!stepDirectories.has(parts[0]!))
					continue
				problems.push(`${stepsRoot}/${entry}: \`${parts[0]}\` is a step, so this is one step's test sitting where the cross-step contracts live. Fold it into \`${stepsRoot}/${parts[0]}/${parts[0]}.test.ts\`; a file here spans a family of steps and belongs to no single one of them.`)
				continue
			}
			problems.push(`${stepsRoot}/${entry}: a cross-step test is named \`<family>.<aspect>.test.ts\` with both parts kebab-case, the way \`structural.sync-fast-path.test.ts\` and \`failure-payload.types.test.ts\` are, and \`<family>\` is not a step.`)
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

function pluginConstructions(statement: ts.Statement, constructorNames: ReadonlySet<string>): ts.VariableDeclaration[] {
	if (!ts.isVariableStatement(statement))
		return []
	return [...statement.declarationList.declarations].filter((declaration) => {
		const initializer = declaration.initializer
		return initializer != null
			&& ts.isCallExpression(initializer)
			&& constructorNames.has(rootIdentifier(initializer.expression) ?? '')
	})
}

/** Whether the statement is erased by the compiler and so cannot run above `PluginDef`. */
function isTypeOnly(statement: ts.Statement): boolean {
	if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement))
		return true
	// `declare namespace Internal { … }` is erased; `namespace Internal { … }` emits an IIFE, and
	// a `const` inside it is exactly the forward reference the order rule exists to prevent. An
	// adversarial review got a runtime value above `Meta` through that gap.
	if (ts.isModuleDeclaration(statement)) {
		return ts.getModifiers(statement)
			?.some(modifier => modifier.kind === ts.SyntaxKind.DeclareKeyword) ?? false
	}
	return false
}

/** How to name the statement in a failure message. */
function describeStatement(statement: ts.Statement): string {
	if (ts.isVariableStatement(statement)) {
		const name = statement.declarationList.declarations[0]?.name
		return name != null && ts.isIdentifier(name) ? `\`${name.text}\`` : 'a destructured binding'
	}
	if (ts.isFunctionDeclaration(statement))
		return statement.name == null ? 'an anonymous function' : `\`${statement.name.text}\``
	if (ts.isClassDeclaration(statement))
		return statement.name == null ? 'an anonymous class' : `\`${statement.name.text}\``
	if (ts.isEnumDeclaration(statement))
		return `\`${statement.name.text}\``
	if (ts.isModuleDeclaration(statement))
		return `the value-emitting \`namespace ${ts.isIdentifier(statement.name) ? statement.name.text : statement.name.text}\``
	if (ts.isExpressionStatement(statement))
		return 'a top-level expression statement'
	if (ts.isImportEqualsDeclaration(statement))
		return `\`import ${statement.name.text} = …\``
	return `a top-level \`${ts.SyntaxKind[statement.kind]}\``
}

function isExported(statement: ts.Statement): boolean {
	if (ts.isExportDeclaration(statement) || ts.isExportAssignment(statement))
		return true
	return ts.canHaveModifiers(statement)
		&& (ts.getModifiers(statement)
			?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false)
}

/**
 * Where `<name>.ts` departs from the canonical section order and the fixed declaration names.
 *
 * The rule is stated as an allow-list rather than a list of value kinds, because the first version
 * enumerated `const`/`function`/`class`/`enum` and an adversarial review then walked four ways past
 * it: a non-`declare` namespace holding a `const`, a bare expression statement, a top-level
 * `await`, and `import x = require(…)`. Between the imports and `PluginDef` only erased syntax is
 * admitted, so anything that can run has one place to be — below `PluginDef`, above the single
 * statement that reads it.
 *
 * What stays undecidable: a local *type* is the same syntax whether it belongs to the contract
 * above `Meta` or to the implementation below `PluginDef`, so which section a type belongs to is
 * review guidance. `step-unit.md` says so in the same words.
 */
export function declarationProblems(source: string, directory: string): string[] {
	const sourceFile = parse(source)
	const statements = sourceFile.statements
	const problems: string[] = []
	const metaUtilities = importedNames(sourceFile, '../../core', ['DefineStepMethodMeta'])
	const pluginDefBases = importedNames(sourceFile, '../../core', ['TStepPluginDef'])
	const pluginConstructors = new Set([
		...importedNames(sourceFile, '../../core', ['implStepPlugin']),
		...importedNames(sourceFile, '../../core/core', ['implStepPlugin']),
	])

	const meta = statements.findIndex(statement => ts.isTypeAliasDeclaration(statement) && statement.name.text === 'Meta')
	const pluginDef = statements.findIndex(statement => ts.isInterfaceDeclaration(statement) && statement.name.text === 'PluginDef')
	const metaDeclaration = meta === -1 ? null : statements[meta] as ts.TypeAliasDeclaration
	const pluginDefDeclaration = pluginDef === -1 ? null : statements[pluginDef] as ts.InterfaceDeclaration
	let firstRunnable = -1
	let firstRunnableName = ''
	const plugins: number[] = []

	statements.forEach((statement, index) => {
		if (ts.isImportDeclaration(statement))
			return

		if (ts.isModuleDeclaration(statement) && ts.isIdentifier(statement.name) && statement.name.text !== 'Internal')
			problems.push(`the local namespace is \`${statement.name.text}\`, not \`Internal\`. A step's only namespace is the erased \`declare namespace Internal\` holding the issue types it owns; no other module can see it, so a different name only costs a reader comparing two steps.`)

		const constructions = pluginConstructions(statement, pluginConstructors)
		if (constructions.length > 0) {
			plugins.push(...constructions.map(() => index))
			if (ts.isVariableStatement(statement) && statement.declarationList.declarations.length !== 1) {
				const count = statement.declarationList.declarations.length
				problems.push(isExported(statement)
					? `the plugin variable statement exports ${count} bindings. The plugin is the file's only export and occupies a declaration of its own.`
					: `the plugin variable statement declares ${count} bindings. A step unit constructs one plugin in a declaration of its own.`)
			}
			return
		}

		if (isExported(statement))
			problems.push(`${describeStatement(statement)} is exported. The plugin is the file's only export: a helper another step needs lives in its own kebab-case module, reached by direct relative path.`)

		if (firstRunnable === -1 && !isTypeOnly(statement)) {
			firstRunnable = index
			firstRunnableName = describeStatement(statement)
		}
	})

	if (meta === -1) {
		problems.push('no `type Meta` declaration. A step declares its name, expected state, and owned issues as `type Meta`, whatever type parameters it takes.')
	}
	else if (metaDeclaration != null
		&& (!ts.isTypeReferenceNode(metaDeclaration.type)
			|| !ts.isIdentifier(metaDeclaration.type.typeName)
			|| !metaUtilities.has(metaDeclaration.type.typeName.text))) {
		if (ts.isTypeReferenceNode(metaDeclaration.type)
			&& ts.isIdentifier(metaDeclaration.type.typeName)
			&& metaDeclaration.type.typeName.text === 'DefineStepMethodMeta') {
			problems.push('`type Meta` is not defined through the `DefineStepMethodMeta` imported from `../../core`. A local type with the same spelling does not declare the public step contract.')
		}
		else {
			problems.push('`type Meta` is not a `DefineStepMethodMeta<…>`. That utility declares the public name, expected state, and owned issues under the fixed local name.')
		}
	}
	if (pluginDef === -1) {
		problems.push('no `interface PluginDef extends TStepPluginDef` declaration. A generic step still names it `PluginDef`.')
	}
	else if (pluginDefDeclaration != null && !(pluginDefDeclaration.heritageClauses ?? [])
		.flatMap(clause => [...clause.types])
		.some(type => ts.isIdentifier(type.expression) && pluginDefBases.has(type.expression.text))) {
		if ((pluginDefDeclaration.heritageClauses ?? [])
			.flatMap(clause => [...clause.types])
			.some(type => ts.isIdentifier(type.expression) && type.expression.text === 'TStepPluginDef')) {
			problems.push('`interface PluginDef` does not extend the `TStepPluginDef` imported from `../../core`. A local interface with the same spelling is not the core state-aware step definition.')
		}
		else {
			problems.push('`interface PluginDef` does not extend `TStepPluginDef`. That base is what makes the fixed interface a state-aware step definition.')
		}
	}

	if (meta !== -1 && pluginDef !== -1 && meta > pluginDef)
		problems.push('`PluginDef` is declared before `Meta`. `Meta` comes first: it is what `PluginDef` is written against.')

	if (pluginDef !== -1 && firstRunnable !== -1 && firstRunnable < pluginDef)
		problems.push(`${firstRunnableName} is above \`PluginDef\`, and it is not erased syntax. Only types may sit between the imports and \`PluginDef\`; anything that runs goes below it, so opening the file shows what the step does before how — and nothing forward-references, because the only statement that reads it is the last one.`)

	if (plugins.length === 0) {
		problems.push('no `implStepPlugin` construction imported from the core module, so this file publishes no step. (That it is `export`ed under the step\'s identifier is `step-inventory`\'s rule, not this one.)')
	}
	else if (plugins.length > 1) {
		// Counted rather than overwritten: taking the last match let an earlier construction sit
		// above `PluginDef` unexamined, which is also a value the order rule then never saw.
		problems.push(`\`implStepPlugin\` is called ${plugins.length} times. A step unit constructs one plugin, as its last statement.`)
	}
	else if (plugins[0] !== statements.length - 1) {
		problems.push('the `implStepPlugin` construction is not the last statement in the file. It is the unit\'s product, and `/* @__NO_SIDE_EFFECTS__ */` has to stay immediately above it.')
	}

	return problems.map(problem => `${directory}.ts: ${problem}`)
}

/** A CommonMark fence opener or closer: up to three spaces, then three or more backticks or tildes. */
const fenceDelimiter = /^ {0,3}(`{3,}|~{3,})/

/** CommonMark closing fences carry only optional whitespace after the delimiter. */
function closesFence(line: string, delimiter: string | null | undefined, fence: string): boolean {
	return delimiter != null
		&& delimiter[0] === fence[0]
		&& delimiter.length >= fence.length
		&& line.slice(line.indexOf(delimiter) + delimiter.length)
			.trim() === ''
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
		const delimiter = fenceDelimiter.exec(line)?.[1]
		if (fence == null) {
			if (delimiter == null)
				kept.push(line)
			else
				fence = delimiter
			continue
		}
		if (closesFence(line, delimiter, fence))
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
 * The reference writes API names in code spans — headings, bullets, and table cells alike — so a
 * step is looked for there rather than in prose. Pass the text through `visibleMarkdown` first:
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

/**
 * Whether the entry holds a TypeScript example — a fence opening ```` ```ts ```` or ```` ```tsx ````.
 *
 * The spelling `check-docs-examples` uses, so what counts here is what that gate will compile once
 * the entry reaches its page. A tilde fence is deliberately not accepted: it is not a fence that
 * gate reads, so an example inside one would never be compiled.
 */
export function hasTypeScriptExample(markdown: string): boolean {
	const lines = stripHtmlComments(markdown)
		.split(/\r?\n/)
	let fence: string | null = null
	let typeScript = false

	for (const line of lines) {
		const delimiter = fenceDelimiter.exec(line)?.[1] ?? null
		if (fence == null) {
			if (delimiter == null)
				continue
			fence = delimiter
			const info = line.slice(line.indexOf(delimiter) + delimiter.length)
				.trim()
			typeScript = delimiter[0] === '`' && /^(?:ts|tsx)(?:\s|$)/.test(info)
			continue
		}
		if (closesFence(line, delimiter, fence)) {
			fence = null
			typeScript = false
			continue
		}
		if (typeScript && line.trim() !== '') {
			return true
		}
	}
	return false
}

/** The opening visible content when it is a `### ` heading. */
function entryHeading(markdown: string): { text: string, line: number } | null {
	const lines = stripHtmlComments(markdown)
		.split(/\r?\n/)
	for (const [index, line] of lines.entries()) {
		if (line.trim() === '')
			continue
		if (line.startsWith('### '))
			return { text: line, line: index }
		return null
	}
	return null
}

/** The visible inline-code spans in the entry's opening `### ` heading. */
function entryHeadingSpans(markdown: string): string[] {
	const heading = entryHeading(markdown)
	return heading == null ? [] : codeSpans(heading.text)
}

/** Whether `token` occurs as a complete issue-code token rather than as another code's prefix. */
function containsToken(text: string, token: string): boolean {
	const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	return new RegExp(`(?<![\\w:$])${escaped}(?![\\w:$])`)
		.test(text)
}

/**
 * The prose between the entry's `### ` heading and its first example or subheading, or `null` when
 * the entry has no `### ` heading at all.
 *
 * Fenced blocks are not stripped first, they are the terminator: after `outsideFencedBlocks` an
 * entry that goes straight from its heading into an example reads as though the text after that
 * example were its description, which would let an entry with no description satisfy the rule.
 */
export function entryDescription(markdown: string): string | null {
	const lines = stripHtmlComments(markdown)
		.split(/\r?\n/)
	const heading = entryHeading(markdown)
	if (heading == null)
		return null

	const prose: string[] = []
	for (const line of lines.slice(heading.line + 1)) {
		if (line.startsWith('#') || fenceDelimiter.test(line))
			break
		prose.push(line)
	}
	return prose.join('\n')
		.trim()
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
	exports: Record<string, Set<string>>
}): string[] {
	const missing: string[] = []
	const directory = `${stepsRoot}/${step.directory}`

	missing.push(...unexpectedEntries(tree, step.directory))
	missing.push(...barrelProblems(tree.read(`${directory}/index.ts`), step.directory))
	missing.push(...declarationProblems(step.source, step.directory))

	// The one auxiliary test the standard names is justified by its assertions being decided by a
	// different tool. A file called `<name>.types.test.ts` holding runtime cases is that exception
	// used as a way around the fold — so the name has to be earned.
	const types = tree.read(`${directory}/${step.directory}.types.test.ts`)
	if (types != null && !callsImportedAnyOf(types, 'vitest', typeAssertionCalls))
		missing.push(`\`${step.directory}.types.test.ts\` calls no \`expectTypeOf\` or \`assertType\`, so nothing in it is decided by \`pnpm typecheck\` — which is the only reason a step may hold a second test file. Fold it into \`${step.directory}.test.ts\`.`)

	const test = tree.read(`${directory}/${step.directory}.test.ts`)
	if (test == null)
		missing.push(`no colocated \`${step.directory}.test.ts\`. Coverage does not stand in for it: other steps' tests execute this one, so removing a step's own test file leaves the per-file floor intact about half the time.`)
	else if (!hasModuleScopeImportedCall(test, 'vitest', testCalls, ['describe', 'suite']))
		missing.push(`\`${step.directory}.test.ts\` calls no \`it\` or \`test\`, so it registers no case at all. This rule only checks that a case exists — it cannot tell an assertion about this step from \`expect(1).toBe(1)\`.`)

	const bench = tree.read(`${directory}/${step.directory}.bench.ts`)
	if (bench == null)
		missing.push(`no focused \`${step.directory}.bench.ts\`. Copy the closest step's and replace its inputs with ones that exercise this step; it is the only benchmark file a step unit holds.`)
	else if (!hasModuleScopeImportedCall(bench, '../../test-utils/step-bench', cellDeclarationCalls))
		missing.push(`\`${step.directory}.bench.ts\` calls no \`stepBench\`, so it declares no cell: \`vitest bench\` measures nothing for this step and the Performance Impact gate has nothing of it to select. This rule only checks that a declaration exists — \`pnpm bench:cells\` is what executes the cells and decides whether they measure this step.`)

	for (const [packageName, identifiers] of Object.entries(context.exports)) {
		if (!identifiers.has(step.exportIdentifier))
			missing.push(`\`${step.exportIdentifier}\` is not a runtime export of '${packageName}' in ${apiSurfacePath}. Add the step to \`${stepsRoot}/index.ts\` if it is missing there, then run \`pnpm api:surface:update\`.`)
	}

	// The step's own entry in the API reference. `docs/api` is generated from these files, so this
	// asks whether the step documents itself — not whether some page under `docs/api` happens to
	// spell its name, which is what the rule this replaced could reach.
	const doc = tree.read(`${directory}/${step.directory}.doc.md`)
	const docSpans = doc == null ? [] : codeSpans(visibleMarkdown(doc))
	const headingSpans = doc == null ? [] : entryHeadingSpans(doc)
	if (doc == null) {
		missing.push(`no \`${step.directory}.doc.md\`. It is the step's entry in the API reference, which \`scripts/docs-api.ts\` composes \`docs/api/*\` from: without one the step appears nowhere on the documentation site. \`pnpm docs:api\` reports this from the other side, and reports the \`category\` and \`section\` it must declare.`)
	}
	else {
		if (!documents(headingSpans, step.name))
			missing.push(`\`${step.directory}.doc.md\` writes no code span containing \`${step.name}(\` in its opening \`### \` heading, so its entry does not name the step it documents. The heading is written in call form in a code span — \`### \\\`${step.name}()\\\`\` — and the rule matches that outside fenced blocks and HTML comments; it does not read the sentence around it.`)

		const description = entryDescription(doc)
		if (description == null)
			missing.push(`\`${step.directory}.doc.md\` holds no \`### \` heading, so it composes into no entry. The file opens with the \`<!-- step-doc -->\` declaration block and then one \`### \` heading.`)
		else if (description === '')
			missing.push(`\`${step.directory}.doc.md\` goes straight from its heading into an example or a subheading, so the entry describes nothing. What this cannot decide is whether the description is true.`)

		if (!hasTypeScriptExample(doc))
			missing.push(`\`${step.directory}.doc.md\` holds no \`ts\` fenced example. One is what \`check-docs-examples\` compiles against the built declarations once the entry reaches its page, so an entry without one is the only kind whose code nothing checks.`)
	}

	if (step.codes.length > 0) {
		const literals = testFileNames(tree, step.directory)
			.flatMap(entry => stringLiteralTexts(tree.read(`${directory}/${entry}`) ?? ''))
		for (const code of step.codes) {
			if (doc != null && !docSpans.some(span => containsToken(span, code)))
				missing.push(`the owned issue code \`${code}\` appears in no code span of \`${step.directory}.doc.md\`, outside fenced blocks and HTML comments, so a consumer handling this failure has nothing to read. This checks that the code is listed, not that what is written beside it is what the step does.`)
			if (!literals.some(literal => containsToken(literal, code)))
				missing.push(`the owned issue code \`${code}\` appears in no string of any \`*.test.ts\` in this directory, so a change to it would break consumers with every test still green. A mention in a comment does not count; the rule reads string literals, not whether one reached an assertion.`)
		}
	}

	return missing
}

export function checkStepCompleteness(tree: SourceTree): CompletenessReport {
	const { steps, problems } = discoverSteps(tree)
	const errors = [...problems]

	const { exports, problems: surfaceProblems } = readPublicExports(tree)
	errors.push(...surfaceProblems)

	// A problem above means the inputs are incomplete, so a per-step verdict would be a verdict
	// about a tree this gate could not read. Report the problem and stop.
	if (errors.length > 0)
		return { errors, complete: 0, total: steps.length }

	const context = { exports }

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

	errors.push(...stepsRootProblems(tree, new Set(steps.map(step => step.directory))))

	return { errors, complete, total: steps.length }
}

/** What a passing run prints. Kept beside the rules so it cannot describe a stronger gate than they are. */
export function successMessage(report: CompletenessReport): string {
	return [
		`Built-in steps are complete: ${report.complete} steps each hold only the files a step unit names,`,
		'a one-line `index.ts`, a `<name>.ts` whose only export is a single `implStepPlugin` construction last in the file,',
		'with `Meta` then `PluginDef` above every statement that is not erased syntax,',
		'a `<name>.test.ts` syntactically registering at least one case through a module-scope Vitest call,',
		'a `<name>.bench.ts` declaring cells with `stepBench`, a runtime export in api-surface.json,',
		'a `<name>.doc.md` whose `### ` entry writes their name in call form in a code span, describes them, and holds a `ts` example,',
		'and every owned issue code both listed in a code span of that entry and present in a string in their own tests.',
		'The steps root holds only the barrel, kebab-case shared modules, and cross-step tests whose family is not a step.',
		'None of it finds meaning: these rules cannot tell a real assertion from a tautology or interpret arbitrary registration control flow,',
		'a description that is true from one that is stale, a helper the step uses from one it merely imports, or a type in the right section from one in the wrong one.',
	].join(' ')
}
