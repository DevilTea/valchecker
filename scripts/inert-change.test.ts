import { readdirSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { inertChangedPaths, isInertChange } from './inert-change'

/**
 * What these protect is the direction that costs something. Calling a real change inert
 * is a scenario the gate should have measured and did not, so every rule below has the
 * pair beside it: the comment edit that must be inert, and the smallest edit through the
 * same file that must not be. The annotation rule is the one that was actually wrong
 * during development — `[@#]__[A-Z]+__` does not match `@__NO_SIDE_EFFECTS__`, because
 * the name contains underscores — and the pair is what caught it.
 *
 * Every expectation is written out by hand from the text in the test.
 */

const step = [
	`import { implStepPlugin } from '../../core'`,
	'',
	'const pattern = /^[a-z]+$/',
	'',
	'/**',
	' * ### Description:',
	' * Checks that the string is lowercase letters.',
	' */',
	'/* @__NO_SIDE_EFFECTS__ */',
	'export const isLower = implStepPlugin({',
	`\tisLower: value => pattern.test(value),`,
	'})',
	'',
	'export const helper = /* @__PURE__ */ build(pattern)',
	'',
].join('\n')

const path = 'packages/internal/src/steps/isLower/isLower.ts'

function edited(from: string, to: string): string {
	if (!step.includes(from))
		throw new Error(`the test's own fixture does not contain ${JSON.stringify(from)}`)
	return step.replace(from, to)
}

describe('a TypeScript change', () => {
	it('is inert when only a comment changed', () => {
		for (const revision of [
			edited(' * Checks that the string is lowercase letters.', ' * Checks that the string is one or more lowercase letters.'),
			edited('/**\n * ### Description:\n * Checks that the string is lowercase letters.\n */\n', ''),
			`${step}// a note appended after the last statement\n`,
			edited(`const pattern = /^[a-z]+$/`, `const pattern = /^[a-z]+$/ // the accepted set`),
			edited(`import { implStepPlugin } from '../../core'`, `// Imported from the core barrel.\nimport { implStepPlugin } from '../../core'`),
		]) {
			expect(isInertChange(path, step, revision), revision)
				.toBe(true)
		}
	})

	it('is inert when only formatting changed', () => {
		for (const revision of [
			step.replaceAll('\n', '\r\n'),
			step.replaceAll('\t', '    '),
			step.replace('export const helper', '\nexport const helper'),
			edited('export const isLower = implStepPlugin({', 'export const isLower = implStepPlugin(\n\t{'),
		]) {
			expect(isInertChange(path, step, revision), JSON.stringify(revision))
				.toBe(true)
		}
	})

	/** The pair for both rules above: one token through the same file, and it is not inert. */
	it('is not inert when one token of code changed', () => {
		for (const revision of [
			edited('/^[a-z]+$/', '/^[a-z]*$/'),
			edited('pattern.test(value)', '!pattern.test(value)'),
			edited('const pattern', 'let pattern'),
			edited('export const helper', 'const helper'),
		]) {
			expect(isInertChange(path, step, revision), revision)
				.toBe(false)
		}
	})

	/**
	 * The trap the whole design has to survive. These are not comments: the bundler reads
	 * them, `check-step-parameter-style.ts` requires the first around every tree-shakable
	 * plugin construction, and `benchmarks/src/treeshake.mjs` gates the result — so adding,
	 * removing, or moving one changes which code the bundle holds and what runs when it is
	 * imported. Placement is included because the printer emits a kept comment against the
	 * node it leads, which is what makes a moved annotation visible.
	 */
	it('is not inert when a bundler annotation is added, removed, or moved', () => {
		for (const revision of [
			edited('/* @__NO_SIDE_EFFECTS__ */\n', ''),
			edited('/* @__PURE__ */ build(pattern)', 'build(pattern)'),
			edited('export const helper = /* @__PURE__ */ build(pattern)', 'export const helper = build(/* @__PURE__ */ pattern)'),
			edited('const pattern = /^[a-z]+$/', '/* @__NO_SIDE_EFFECTS__ */\nconst pattern = /^[a-z]+$/'),
			edited('/* @__NO_SIDE_EFFECTS__ */', '/*#__NO_SIDE_EFFECTS__*/'),
		]) {
			expect(isInertChange(path, step, revision), revision)
				.toBe(false)
		}
	})

	/**
	 * The comments that are read by a tool which is not a compiler. Each changes what some
	 * gate sees and none changes the JavaScript in either bundle, so none can move a
	 * runtime measurement: a suppression that stops suppressing fails `pnpm typecheck` and
	 * the gate's own build of both revisions, a lint directive fails `pnpm lint` in the
	 * preflight job, and a coverage directive moves a threshold in a different gate.
	 */
	it('is inert when only a type, lint, or gate directive changed', () => {
		for (const revision of [
			edited('\tisLower: value => pattern.test(value),', '\t// @ts-expect-error the plugin shape is checked elsewhere\n\tisLower: value => pattern.test(value),'),
			edited(`import { implStepPlugin } from '../../core'`, `/* eslint-disable ts/no-unsafe-call */\nimport { implStepPlugin } from '../../core'`),
			edited('export const helper', '/* v8 ignore next */\nexport const helper'),
		]) {
			expect(isInertChange(path, step, revision), revision)
				.toBe(true)
		}
	})

	/**
	 * A comment is a comment because the parser says so, not because the text looks like
	 * one. This is why the canonical form comes from the compiler: the repository's grammar
	 * files are dense with regular expressions holding slashes and quotes, which is exactly
	 * what a hand-written stripper mis-tokenizes.
	 */
	it('is not inert when comment-shaped text inside a literal changed', () => {
		const literals = [
			`const label = '// not a comment'`,
			`const block = \`/* @__PURE__ */\``,
			'const escaped = /\\/\\*/',
		].join('\n')
		expect(isInertChange(path, literals, literals.replace('// not a comment', '// also not a comment')))
			.toBe(false)
		expect(isInertChange(path, literals, literals.replace('/* @__PURE__ */', '/* @__NO_SIDE_EFFECTS__ */')))
			.toBe(false)
		expect(isInertChange(path, literals, literals.replace('/\\/\\*/', '/\\/\\*\\*/')))
			.toBe(false)
	})

	it('is not inert when a revision cannot be parsed into the same shape', () => {
		expect(isInertChange(path, step, edited('})', '}')))
			.toBe(false)
	})
})

describe('a YAML change', () => {
	const workflow = [
		'# The gate that measures a pull request.',
		'on:',
		'  pull_request:',
		'    paths:',
		'      - \'**\'',
		'      - \'!docs/**\'',
		'jobs:',
		'  compare:',
		'    timeout-minutes: 90',
		'    steps:',
		'      - run: pnpm bench',
		'',
	].join('\n')
	const workflowPath = '.github/workflows/performance-impact.yml'

	it('is inert when only comments, formatting, or mapping order changed', () => {
		for (const revision of [
			workflow.replace('# The gate that measures a pull request.', '# The gate that measures a pull request, scoped to its diff.'),
			workflow.replace('# The gate that measures a pull request.\n', ''),
			`${workflow}# a trailing note\n`,
			workflow.replaceAll('\n', '\r\n'),
			workflow.replace('      - \'**\'', '      - "**"'),
			// The same job with `steps` before `timeout-minutes`. A YAML mapping is
			// unordered, so this is the same document; the `paths` sequence below is not.
			[
				'on:',
				'  pull_request:',
				'    paths:',
				'      - \'**\'',
				'      - \'!docs/**\'',
				'jobs:',
				'  compare:',
				'    steps:',
				'      - run: pnpm bench',
				'    timeout-minutes: 90',
				'',
			].join('\n'),
		]) {
			expect(isInertChange(workflowPath, workflow, revision), revision)
				.toBe(true)
		}
	})

	it('is not inert when a value or a sequence changed', () => {
		for (const revision of [
			workflow.replace('      - \'!docs/**\'', '      - \'!docs/*\''),
			workflow.replace('      - \'**\'\n      - \'!docs/**\'', '      - \'!docs/**\'\n      - \'**\''),
			workflow.replace('timeout-minutes: 90', 'timeout-minutes: 60'),
			workflow.replace('timeout-minutes: 90', `timeout-minutes: '90'`),
			workflow.replace('      - \'!docs/**\'\n', ''),
		]) {
			expect(isInertChange(workflowPath, workflow, revision), revision)
				.toBe(false)
		}
	})

	it('is not inert when a revision is not a document this comparison can read', () => {
		expect(isInertChange(workflowPath, workflow, workflow.replace('on:', 'on:\n  - broken')))
			.toBe(false)
	})
})

describe('what has no canonical form', () => {
	it('is never inert, whatever changed', () => {
		for (const other of ['README.md', 'package.json', 'pnpm-workspace.yaml.txt', 'Makefile']) {
			expect(isInertChange(other, 'a\n', 'b\n'), other)
				.toBe(false)
		}
	})

	it('is inert only when the two revisions are byte-identical', () => {
		expect(isInertChange('README.md', 'same\n', 'same\n'))
			.toBe(true)
	})
})

describe('an added or deleted file', () => {
	/**
	 * There is no counterpart to compare, so no argument that the change is harmless. This
	 * is what leaves every rule about one where it was: a deleted non-test source file is
	 * still a full run because its reachability can no longer be read, and a new file is
	 * still classified from the import graph.
	 */
	it('is never inert', () => {
		expect(isInertChange(path, null, step))
			.toBe(false)
		expect(isInertChange(path, step, null))
			.toBe(false)
		expect(isInertChange(path, null, null))
			.toBe(false)
	})
})

describe('collecting the inert paths of one diff', () => {
	it('reads only the paths a canonical form exists for', () => {
		const read: string[] = []
		const revisions = {
			base: (filePath: string) => {
				read.push(filePath)
				return filePath.endsWith('.ts') ? step : null
			},
			head: (filePath: string) => (filePath.endsWith('.ts') ? `${step}// a note\n` : null),
		}
		const inert = inertChangedPaths([path, 'README.md', 'docs/guide/index.md', path], revisions)
		expect([...inert])
			.toEqual([path])
		expect(read)
			.toEqual([path])
	})
})

describe('the repository this gate runs in', () => {
	const root = new URL('..', import.meta.url)

	function walk(directory: string, out: string[] = []): string[] {
		for (const entry of readdirSync(new URL(directory, root))) {
			if (entry === 'node_modules' || entry === 'dist')
				continue
			const child = `${directory}/${entry}`
			if (statSync(new URL(child, root))
				.isDirectory()) {
				walk(child, out)
			}
			else if (/\.tsx?$/.test(entry)) {
				out.push(child)
			}
		}
		return out
	}

	const files = [...walk('packages'), ...walk('scripts')]

	/**
	 * The pair, over every real file rather than over a fixture: appending a comment to any
	 * of them is inert, and removing an annotation from any of them is not. The first half
	 * is what proves the comment discovery reaches the whole file — it walks the parse tree,
	 * so a file whose comments it missed would keep them in both canonical forms and pass a
	 * fixture test while failing here.
	 *
	 * The budget is stated because this canonicalizes every TypeScript file in the
	 * repository twice, which costs about five seconds under the coverage run's
	 * instrumentation of the compiler and does not fit the default five-second unit-test
	 * timeout. Sampling the files instead would leave whichever one has the syntax this
	 * walk mishandles unexamined, which is the only thing the sweep is for.
	 */
	it('finds every comment and every annotation in its own source', () => {
		expect(files.length)
			.toBeGreaterThan(400)
		let annotated = 0
		for (const file of files) {
			const text = readFileSync(new URL(file, root), 'utf8')
			expect(isInertChange(file, text, `${text}// a note appended at the end of the file\n`), file)
				.toBe(true)
			const annotations = text.match(/\/\*\s*[@#]__[A-Z][A-Z_]*__\s*\*\//g) ?? []
			if (annotations.length === 0)
				continue
			annotated++
			expect(isInertChange(file, text, text.replace(annotations[0]!, '')), `${file}: removing ${annotations[0]}`)
				.toBe(false)
		}
		expect(annotated)
			.toBeGreaterThan(100)
	}, 60_000)
})
