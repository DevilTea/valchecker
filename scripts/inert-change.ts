import ts from 'typescript'
import { YAML } from 'zx'

/**
 * Whether the two revisions of a changed file differ in anything either measured build
 * or this gate's own scoping can read.
 *
 * `impact-selection.ts` answers "what can this path put into the measured bundle", and
 * it was asking that of a *path*: any byte moving in a gate-defining file forced a
 * complete comparison, and any byte moving in a step's source selected that step's
 * scenarios. The pull request that added this module paid the 55-minute full run for
 * three comment lines — syncing a scenario count in prose touched the workflow and both
 * selection scripts, and those files force a full run because a change to what decides
 * the scope has to be visible in one complete comparison.
 *
 * That rule is right. Keying it on bytes is not, so the question asked here is the
 * narrower one: did anything that can change behaviour change? The result is *stricter*
 * in the sense that matters rather than relaxed — it now answers about meaning, so it
 * also absorbs a whitespace-only reformat, and it still fires for every edit that can
 * reach either build. Nothing is judged inert without a canonical form to prove it with.
 *
 * Two canonical forms, one per language, and nothing else is answered:
 *
 * - **YAML** is parsed and deep-compared. Comments and formatting are not part of a
 *   parsed document at all, so equal documents are read identically by Actions and by
 *   `pnpm install`. Mapping key order is not compared, because a YAML mapping is
 *   unordered; sequence order is, because `paths:` is a sequence whose order decides
 *   which files match. Parsing is the `yaml` package that `zx` re-exports, for the
 *   reason `check-impact-triggers.ts` gives: the hand-written reader it replaced failed
 *   on a CRLF checkout, and a check whose job is to prove two files agree must not be
 *   the thing that disagrees with the platform.
 * - **TypeScript** is parsed, its insignificant comments blanked out, re-parsed, and
 *   printed by the compiler's own printer. Printing normalizes indentation, line
 *   endings, and blank lines, while emitting a template literal from its original text,
 *   so the comparison is formatting-independent without a hand-written tokenizer — and
 *   this repository's grammar files are exactly the dense regular expressions such a
 *   tokenizer mis-reads.
 *
 * Everything else — JSON, a package manifest, Markdown, anything unrecognised — has no
 * canonical form here and is never inert, which leaves it classified exactly as before.
 *
 * An added or deleted file has no counterpart to compare and is never inert either, so
 * every rule about one still holds: a deleted non-test source file remains a full run
 * because its reachability can no longer be read, and a new file is classified from the
 * graph as it always was.
 */

/** The two revisions a selection is between, as text. */
export interface Revisions {
	/** The path's text in the base revision, or `null` when the base does not have it. */
	base: (path: string) => string | null
	/** The path's text in the head revision, or `null` when the head does not have it. */
	head: (path: string) => string | null
}

/**
 * Comments that are not comments, because a bundler reads them.
 *
 * The `@__NO_SIDE_EFFECTS__` and `@__PURE__` annotations decide whether the bundler may
 * drop a call or a module's initialisation, so adding, removing, or moving one changes
 * which code the bundle holds and what runs when it is imported.
 * `check-step-parameter-style.ts` requires the first around every tree-shakable plugin
 * construction and `benchmarks/src/treeshake.mjs` gates the result; a "comment-only"
 * change that touched one and was called inert would be a silent under-selection, which
 * is the single failure mode this gate is built to avoid. The pattern is written for the
 * whole `__ANNOTATION__` family — `KEY`, `INLINE`, `NO_INLINE` — and for the two
 * `-ignore` spellings a rolldown-based build also reads beside a dynamic import, rather
 * than for the two names this repository uses today.
 *
 * Deliberately **not** significant, each because it cannot move a runtime measurement:
 *
 * - `@ts-expect-error` and `@ts-ignore` suppress a type error and change no emitted
 *   JavaScript. Removing one that was load-bearing — or leaving one that no longer
 *   suppresses anything — fails `pnpm typecheck`, and the gate builds both revisions
 *   before it measures either, so this can only ever be loud.
 * - `eslint-disable` comments are read by the linter the preflight job runs and by
 *   nothing that compiles.
 * - `v8 ignore`, `c8 ignore`, and `istanbul ignore` change a coverage report, which is
 *   a different gate with its own thresholds.
 * - A legal comment — a `@license` or `@preserve` tag, or the bang opener — does survive
 *   into the emitted bundle, so it changes its bytes. Bytes are the bundle-size gate's
 *   subject; a comment in the output is not executed and cannot move a timing.
 * - A triple-slash reference adds a file to a TypeScript program and nothing to its
 *   output.
 *
 * All five change what some tool sees, and all five fail loudly in the gate that reads
 * them. None of them changes the JavaScript in either bundle. And an inert change is
 * still measured by the canary, which runs whatever the diff says.
 */
const toolDirectedComment = /[@#]__[A-Z][A-Z_]*__|@vite-ignore|webpackIgnore/

/**
 * Every comment in the file, from the parse tree rather than from a text scan.
 *
 * Comments live in trivia and the tokens partition the file, so walking the leaves and
 * taking each one's comment ranges reaches all of them — a comment after the last
 * statement included, because it is the end-of-file token's leading trivia.
 *
 * Both directions are asked for, and that is not redundancy. `getLeadingCommentRanges`
 * only starts collecting after a line break, so `pattern = /^a$/ // the accepted set` is
 * invisible to it: the comment is on the same line as the code before it, which makes it
 * the previous token's *trailing* comment and nothing else's. Asking only for leading
 * ranges left every end-of-line comment in the file unblanked, so an edit to one counted
 * as a change — the fixture pair in `inert-change.test.ts` is what caught it. The dedupe
 * is for the ranges the two directions legitimately agree on.
 */
function commentRangesOf(source: ts.SourceFile, text: string): ts.CommentRange[] {
	const ranges: ts.CommentRange[] = []
	const starts = new Set<number>()

	const collect = (found: readonly ts.CommentRange[] | undefined): void => {
		for (const range of found ?? []) {
			if (!starts.has(range.pos)) {
				starts.add(range.pos)
				ranges.push(range)
			}
		}
	}

	const visit = (node: ts.Node): void => {
		const children = node.getChildren(source)
		if (children.length > 0) {
			for (const child of children)
				visit(child)
			return
		}
		collect(ts.getLeadingCommentRanges(text, node.pos))
		collect(ts.getTrailingCommentRanges(text, node.end))
	}

	visit(source)
	return ranges.sort((left, right) => left.pos - right.pos)
}

/**
 * The same text with every comment a tool does not read replaced by spaces of its own
 * length, newlines kept.
 *
 * Same length and same line breaks means every other position in the file is unchanged,
 * so the re-parse is guaranteed to produce the same code — nothing here can move a
 * statement across a line boundary and change where semicolons are inserted.
 */
function blankInsignificantComments(text: string, ranges: ts.CommentRange[]): string {
	let result = ''
	let cursor = 0
	for (const range of ranges) {
		if (toolDirectedComment.test(text.slice(range.pos, range.end)))
			continue
		result += text.slice(cursor, range.pos)
		result += text.slice(range.pos, range.end)
			.replace(/[^\n\r]/g, ' ')
		cursor = range.end
	}
	return result + text.slice(cursor)
}

const printer = ts.createPrinter({ removeComments: false, newLine: ts.NewLineKind.LineFeed })

/**
 * The parser recovers from a syntax error instead of refusing the file, and it recovers
 * by inserting the token it expected — so a revision missing a closing brace can print
 * identically to one that has it. A file that does not parse cleanly therefore gets no
 * canonical form: `parseDiagnostics` is where the parser records that, and reading it is
 * worth the cast to a field the compiler does not declare publicly.
 */
function parse(path: string, text: string): ts.SourceFile | null {
	const source = ts.createSourceFile(path, text, ts.ScriptTarget.ESNext, true, /\.[cm]?tsx$/.test(path) ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
	const diagnostics = (source as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics
	if (diagnostics == null)
		throw new Error('this TypeScript version does not report parse diagnostics on a source file, so a recovered parse cannot be told from a clean one')
	return diagnostics.length > 0 ? null : source
}

/**
 * The file as the compiler would re-emit it, carrying only the comments a tool reads.
 *
 * Insignificant comments are removed from the *text* rather than by the printer's
 * `removeComments`, because the annotations that must survive have to survive in place:
 * the printer emits a kept comment against the node it leads, so an annotation that
 * moved to another call prints in another place and the two revisions differ.
 */
function canonicalTypeScript(path: string, text: string): string {
	const source = parse(path, text)
	if (source == null)
		throw new Error(`${path}: this revision does not parse, so it has no canonical form`)
	const blanked = blankInsignificantComments(text, commentRangesOf(source, text))
	if (blanked === text)
		return printer.printFile(source)
	const reparsed = parse(path, blanked)
	if (reparsed == null)
		throw new Error(`${path}: blanking the comments of this revision changed whether it parses, which it must not`)
	return printer.printFile(reparsed)
}

/**
 * A parsed YAML document as one string, with mapping keys sorted and sequences left in
 * order.
 *
 * Written out rather than passed to `JSON.stringify`, so that the tag a value came from
 * is part of the comparison: the number `1` and the string `'1'` are different documents,
 * and so are `.nan` and `null`, which `JSON.stringify` would both render as `null`. The
 * depth bound is for the cyclic structure a self-referencing anchor can produce, which
 * would otherwise recurse until the stack ends.
 */
function canonicalDocument(value: unknown, depth: number): string {
	if (depth > 64)
		throw new Error('the parsed document nests deeper than this comparison follows')
	if (value === null || value === undefined)
		return 'null'
	if (Array.isArray(value)) {
		return `[${value.map(entry => canonicalDocument(entry, depth + 1))
			.join(',')}]`
	}
	if (typeof value === 'object') {
		const record = value as Record<string, unknown>
		return `{${Object.keys(record)
			.sort()
			.map(key => `${JSON.stringify(key)}:${canonicalDocument(record[key], depth + 1)}`)
			.join(',')}}`
	}
	return `${typeof value}:${JSON.stringify(String(value))}`
}

function canonicalYaml(_path: string, text: string): string {
	return canonicalDocument(YAML.parse(text), 0)
}

/** The canonical form for this path's language, or `null` when there is none. */
function canonicalizerFor(path: string): ((path: string, text: string) => string) | null {
	if (/\.[cm]?tsx?$/.test(path))
		return canonicalTypeScript
	if (/\.ya?ml$/.test(path))
		return canonicalYaml
	return null
}

/**
 * Whether the change to this path is one no build and no selection rule can see.
 *
 * A canonical form that cannot be produced — a revision the parser rejects, a document
 * the comparison will not follow — is not an argument that the change is harmless, so it
 * answers `false` and the path is classified as it was before.
 */
export function isInertChange(path: string, base: string | null, head: string | null): boolean {
	if (base == null || head == null)
		return false
	if (base === head)
		return true
	const canonical = canonicalizerFor(path)
	if (canonical == null)
		return false
	try {
		return canonical(path, base) === canonical(path, head)
	}
	catch {
		return false
	}
}

/**
 * The changed paths whose two revisions mean the same thing.
 *
 * Only a path with a canonical form is read at all, which is what keeps this from
 * fetching two revisions of every Markdown file in a documentation pull request.
 */
export function inertChangedPaths(changedFiles: readonly string[], revisions: Revisions): Set<string> {
	const inert = new Set<string>()
	for (const path of new Set(changedFiles)) {
		if (canonicalizerFor(path) == null)
			continue
		if (isInertChange(path, revisions.base(path), revisions.head(path)))
			inert.add(path)
	}
	return inert
}
