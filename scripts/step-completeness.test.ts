import { describe, expect, it } from 'vitest'
import { objectTree } from './source-tree'
import {
	barrelProblems,
	callsAnyOf,
	checkStepCompleteness,
	codeSpans,
	declarationProblems,
	declaredCodes,
	documents,
	entryDescription,
	hasTypeScriptExample,
	isKebabCase,
	localSpecifiers,
	outsideFencedBlocks,
	stepsRootProblems,
	stringLiteralTexts,
	stripHtmlComments,
	successMessage,
	unexpectedEntries,
	visibleMarkdown,
} from './step-completeness'

/**
 * The gate's first version had seven rules, each demonstrated failing once by hand in a pull
 * request description. Four of them then turned out to pass on a tree where the requirement was
 * not met, and nothing in the repository noticed, because a demonstration recorded in prose
 * cannot fail later.
 *
 * So each rule here has a *bypass* test beside its plain one: the tree that satisfied the old
 * rule while the requirement was unmet, asserted to fail now, and the same tree restored,
 * asserted to pass. A rule loosened back to a substring match fails the bypass test.
 *
 * The step-unit rules added later earned their own four, the same way: an adversarial review got a
 * runtime suite past the file set as a fake `lazy-output.ts` + `lazy-output.test.ts` pair and again
 * as a `<name>.types.test.ts` with no type assertion in it, got a `const` above `PluginDef` inside a
 * `namespace` without `declare`, got a second `implStepPlugin` call in unexamined above `PluginDef`,
 * and got `map.async.test.ts` accepted at the steps root because every all-lowercase step name is
 * also a valid kebab-case family. Each of those trees is a test below.
 *
 * The rules that remain weaker than what they stand for — a test case that asserts nothing, a
 * mention that is not a description, a helper reached rather than used, a type in either section —
 * have tests pinning that too, so the gate's wording and its behaviour cannot drift apart silently.
 *
 * Every expectation is written out from the synthetic repository below, never computed with the
 * function under test.
 */

const stepsRoot = 'packages/internal/src/steps'

interface StepFixture {
	name: string
	/** The issue code the step owns, if any. */
	code?: string
	exportIdentifier?: string
}

/**
 * A conforming `<name>.ts`: the canonical sections in the canonical order, spelled out because the
 * order rules read the declarations rather than the text around them.
 */
function main({ name, code }: StepFixture): string {
	return [
		`import type { TStepPluginDef } from '../../core'`,
		`import { implStepPlugin } from '../../core'`,
		'',
		...(code == null
			? []
			: [
					'declare namespace Internal {',
					`\texport type SelfIssue = ExecutionIssue<'${code}', { value: string }>`,
					'}',
					'',
				]),
		'type Meta = DefineStepMethodMeta<{',
		`\tName: '${name}'`,
		code == null ? null : '\tSelfIssue: Internal.SelfIssue',
		'}>',
		'',
		'interface PluginDef extends TStepPluginDef {',
		`\t${name}: DefineStepMethod<Meta, () => Next<undefined, this['CurrentValchecker']>>`,
		'}',
		'',
		'/* @__NO_SIDE_EFFECTS__ */',
		`export const ${name} = implStepPlugin<PluginDef>({}, 'sync')`,
		'',
	].filter(line => line != null)
		.join('\n')
}

function test_({ name, code }: StepFixture): string {
	return [
		`import { expect, it } from 'vitest'`,
		'',
		`it('${name} rejects a bad value', () => {`,
		code == null ? `\texpect(run()).toEqual({ value: 'ok' })` : `\texpect(run().issues[0].code).toBe('${code}')`,
		'})',
		'',
	].join('\n')
}

function bench({ name }: StepFixture): string {
	return [
		`import { stepBench } from '../../test-utils/step-bench'`,
		'',
		`stepBench('${name}', [`,
		`\t{ name: 'valid', group: 'warm/success', expect: { success: true }, batch: 100, run: () => schema.execute('x') },`,
		'])',
		'',
	].join('\n')
}

/** A conforming `<name>.doc.md`: the declaration block, one `###` entry, a description, an example. */
function doc({ name, code }: StepFixture): string {
	return [
		'<!-- step-doc',
		'category: primitives',
		'section: initial',
		'summary: does the thing',
		'-->',
		'',
		`### \`${name}()\``,
		'',
		'Does the thing, and nothing the name does not say.',
		'',
		'```ts',
		`v.${name}()`,
		'```',
		'',
		code == null ? 'This step emits no issue.' : `**Issue code:** \`${code}\` — the value is not one.`,
		'',
	].join('\n')
}

const fixtures: StepFixture[] = [
	{ name: 'isEmail', code: 'isEmail:expected_email' },
	{ name: 'toTrimmed' },
]

/**
 * A two-step repository with nothing missing. One step owns an issue code and one owns none, so
 * every rule has something to act on and the code rules have a step they must stay silent about.
 */
function repository(overrides: Record<string, string | null> = {}): ReturnType<typeof objectTree> {
	const files: Record<string, string> = {
		'api-surface.json': JSON.stringify({
			'@valchecker/internal': { runtime: fixtures.map(fixture => fixture.exportIdentifier ?? fixture.name) },
			'valchecker': { runtime: fixtures.map(fixture => fixture.exportIdentifier ?? fixture.name) },
		}),
		[`${stepsRoot}/index.ts`]: `${fixtures.map(fixture => `export * from './${fixture.name}'`)
			.join('\n')}\n`,
	}

	for (const fixture of fixtures) {
		files[`${stepsRoot}/${fixture.name}/index.ts`] = `export * from './${fixture.name}'\n`
		files[`${stepsRoot}/${fixture.name}/${fixture.name}.ts`] = main(fixture)
		files[`${stepsRoot}/${fixture.name}/${fixture.name}.test.ts`] = test_(fixture)
		files[`${stepsRoot}/${fixture.name}/${fixture.name}.bench.ts`] = bench(fixture)
		files[`${stepsRoot}/${fixture.name}/${fixture.name}.doc.md`] = doc(fixture)
	}

	for (const [path, text] of Object.entries(overrides)) {
		if (text == null)
			delete files[path]
		else
			files[path] = text
	}

	return objectTree(files)
}

/** The single failure the tree produces, so a test cannot pass on an unrelated error. */
function onlyError(overrides: Record<string, string | null>): string {
	const report = checkStepCompleteness(repository(overrides))
	expect(report.errors)
		.toHaveLength(1)
	return report.errors[0]!
}

describe('a complete repository', () => {
	it('reports every step complete and no errors', () => {
		const report = checkStepCompleteness(repository())
		expect(report.errors)
			.toEqual([])
		expect(report.complete)
			.toBe(2)
		expect(report.total)
			.toBe(2)
	})

	it('reads a CRLF checkout the same as an LF one', () => {
		const lf = repository()
		const crlf = objectTree(Object.fromEntries([
			'api-surface.json',
			`${stepsRoot}/index.ts`,
			...fixtures.flatMap(fixture => [
				`${stepsRoot}/${fixture.name}/index.ts`,
				`${stepsRoot}/${fixture.name}/${fixture.name}.ts`,
				`${stepsRoot}/${fixture.name}/${fixture.name}.test.ts`,
				`${stepsRoot}/${fixture.name}/${fixture.name}.bench.ts`,
				`${stepsRoot}/${fixture.name}/${fixture.name}.doc.md`,
			]),
		].map(path => [path, lf.read(path)!.replaceAll('\n', '\r\n')])))

		expect(checkStepCompleteness(crlf))
			.toEqual({ errors: [], complete: 2, total: 2 })
	})

	it('describes itself in the success message as what it checks', () => {
		const message = successMessage({ errors: [], complete: 114, total: 114 })
		expect(message)
			.toContain('114 steps')
		expect(message)
			.toContain('registering at least one case')
		expect(message)
			.toContain('`<name>.doc.md`')
		expect(message)
			.toContain('cannot tell a real assertion from a tautology')
	})
})

describe('discovery problems', () => {
	it('replace the per-step verdict instead of being reported alongside it', () => {
		const report = checkStepCompleteness(repository({ [`${stepsRoot}/toTrimmed/toTrimmed.ts`]: null }))
		expect(report.complete)
			.toBe(0)
		expect(report.errors)
			.toHaveLength(2)
		expect(report.errors[0])
			.toContain(`${stepsRoot}/toTrimmed: no \`toTrimmed.ts\``)
	})

	it('include a missing api-surface.json rather than treating every export as absent', () => {
		expect(onlyError({ 'api-surface.json': null }))
			.toBe('api-surface.json is missing. Regenerate it with `pnpm api:surface:update`.')
	})
})

describe('the colocated test rule', () => {
	it('fails a step with no test file', () => {
		expect(onlyError({ [`${stepsRoot}/toTrimmed/toTrimmed.test.ts`]: null }))
			.toContain('no colocated `toTrimmed.test.ts`')
	})

	// Bypass: the file replaced with `expect(1).toBe(1)`, which the existence check accepted.
	it('fails a test file that registers no case', () => {
		expect(onlyError({ [`${stepsRoot}/toTrimmed/toTrimmed.test.ts`]: 'expect(1).toBe(1)\n' }))
			.toContain('`toTrimmed.test.ts` calls no `it` or `test`')
	})

	it('fails an empty test file', () => {
		expect(onlyError({ [`${stepsRoot}/toTrimmed/toTrimmed.test.ts`]: '' }))
			.toContain('calls no `it` or `test`')
	})

	it('accepts a case registered through `it.each`', () => {
		expect(checkStepCompleteness(repository({
			[`${stepsRoot}/toTrimmed/toTrimmed.test.ts`]: 'it.each([1, 2])(\'trims %i\', (value) => {\n\texpect(value).toBeDefined()\n})\n',
		})).errors)
			.toEqual([])
	})

	it('accepts a case registered through a tagged `test.each` template', () => {
		expect(checkStepCompleteness(repository({
			[`${stepsRoot}/toTrimmed/toTrimmed.test.ts`]: `test.each\`\n\tvalue\n\t\${1}\n\`('trims $value', () => {})\n`,
		})).errors)
			.toEqual([])
	})

	it('fails a file holding only a `describe` with nothing in it', () => {
		expect(onlyError({ [`${stepsRoot}/toTrimmed/toTrimmed.test.ts`]: 'describe(\'toTrimmed\', () => {})\n' }))
			.toContain('calls no `it` or `test`')
	})

	// The gap the message admits to: this rule stops at "a case exists".
	it('accepts a case that asserts nothing about the step, as its message says', () => {
		expect(checkStepCompleteness(repository({
			[`${stepsRoot}/toTrimmed/toTrimmed.test.ts`]: 'it(\'works\', () => {\n\texpect(1).toBe(1)\n})\n',
		})).errors)
			.toEqual([])
	})
})

describe('the focused benchmark rule', () => {
	it('fails a step with no benchmark file', () => {
		expect(onlyError({ [`${stepsRoot}/toTrimmed/toTrimmed.bench.ts`]: null }))
			.toContain('no focused `toTrimmed.bench.ts`')
	})

	// Bypass: the file truncated to 0 bytes, which the existence check accepted.
	it('fails a benchmark file truncated to nothing', () => {
		expect(onlyError({ [`${stepsRoot}/toTrimmed/toTrimmed.bench.ts`]: '' }))
			.toContain('`toTrimmed.bench.ts` calls no `stepBench`')
	})

	it('fails a benchmark file that registers a bare vitest bench instead of declaring cells', () => {
		// The previous generation of bench files, which `vitest bench` runs and the impact
		// gate cannot read: a `bench(name, fn)` carries no group, no expectation, and no
		// batch, so nothing downstream can measure it or check that it reaches its own step.
		expect(onlyError({ [`${stepsRoot}/toTrimmed/toTrimmed.bench.ts`]: 'describe(\'toTrimmed\', () => {\n\tbench(\'valid\', () => run())\n})\n' }))
			.toContain('calls no `stepBench`')
	})
})

describe('the public export rule', () => {
	it('fails a step missing from one package\'s runtime exports', () => {
		expect(onlyError({
			'api-surface.json': JSON.stringify({
				'@valchecker/internal': { runtime: ['isEmail', 'toTrimmed'] },
				'valchecker': { runtime: ['isEmail'] },
			}),
		}))
			.toContain('`toTrimmed` is not a runtime export of \'valchecker\'')
	})
})

describe('the step-documentation rule', () => {
	const docPath = `${stepsRoot}/toTrimmed/toTrimmed.doc.md`

	it('fails a step with no `.doc.md`', () => {
		expect(onlyError({ [docPath]: null }))
			.toContain('no `toTrimmed.doc.md`')
	})

	// What the rule this replaced could not reach: it asked only that *some* code span somewhere
	// under `docs/api` wrote the name, so an entry belonging to another step satisfied it.
	it('fails an entry whose heading names a different step', () => {
		expect(onlyError({
			[docPath]: doc({ name: 'toTrimmed' })
				.replace('### `toTrimmed()`', '### `toTrimmedStart()`'),
		}))
			.toContain('`toTrimmed.doc.md` writes no code span containing `toTrimmed(`')
	})

	it('fails a mention that lives only inside a fenced code block', () => {
		expect(onlyError({
			[docPath]: [
				'<!-- step-doc',
				'category: primitives',
				'section: initial',
				'summary: does the thing',
				'-->',
				'',
				'### Trimming',
				'',
				'Does the thing.',
				'',
				'```ts',
				'// `toTrimmed()` — removed in 2.0',
				'```',
				'',
			].join('\n'),
		}))
			.toContain('writes no code span containing `toTrimmed(`')
	})

	it('fails a mention that lives only in the declaration block', () => {
		expect(onlyError({
			[docPath]: doc({ name: 'toTrimmed' })
				.replace('summary: does the thing', 'summary: see `toTrimmed()`')
				.replace('### `toTrimmed()`', '### Trimming'),
		}))
			.toContain('writes no code span containing `toTrimmed(`')
	})

	it('fails a file with no `###` heading at all', () => {
		expect(onlyError({
			[docPath]: doc({ name: 'toTrimmed' })
				.replace('### `toTrimmed()`', '# `toTrimmed()`'),
		}))
			.toContain('`toTrimmed.doc.md` holds no `### ` heading')
	})

	it('fails an entry that goes straight from its heading into the example', () => {
		expect(onlyError({
			[docPath]: doc({ name: 'toTrimmed' })
				.replace('Does the thing, and nothing the name does not say.\n\n', ''),
		}))
			.toContain('goes straight from its heading into an example or a subheading')
	})

	it('fails an entry that goes straight from its heading into a subheading', () => {
		expect(onlyError({
			[docPath]: doc({ name: 'toTrimmed' })
				.replace('Does the thing, and nothing the name does not say.', '#### Example'),
		}))
			.toContain('goes straight from its heading into an example or a subheading')
	})

	it('fails an entry with no `ts` example', () => {
		expect(onlyError({
			[docPath]: doc({ name: 'toTrimmed' })
				.replace('```ts', '```js'),
		}))
			.toContain('holds no `ts` fenced example')
	})

	// The gap the message admits to: any mention in call form satisfies the heading rule, including
	// a sentence saying the step does not exist. Pinned so the wording cannot quietly grow.
	it('accepts an entry saying the step is unavailable, as its message says', () => {
		expect(checkStepCompleteness(repository({
			[docPath]: doc({ name: 'toTrimmed' })
				.replace('Does the thing, and nothing the name does not say.', '`toTrimmed()` has never been available on Map keys.'),
		})).errors)
			.toEqual([])
	})
})

describe('the documented issue-code rule', () => {
	const docPath = `${stepsRoot}/isEmail/isEmail.doc.md`

	it('fails a code the step\'s own entry does not list', () => {
		expect(onlyError({
			[docPath]: doc({ name: 'isEmail' }),
		}))
			.toContain('the owned issue code `isEmail:expected_email` appears in no code span of `isEmail.doc.md`')
	})

	it('fails a code that survives only in an HTML comment', () => {
		expect(onlyError({
			[docPath]: doc({ name: 'isEmail' })
				.replace('This step emits no issue.', '<!-- TODO: write up `isEmail:expected_email`. -->'),
		}))
			.toContain('appears in no code span of `isEmail.doc.md`')
	})

	it('fails a code that survives only inside a fenced block', () => {
		expect(onlyError({
			[docPath]: doc({ name: 'isEmail' })
				.replace('v.isEmail()', 'v.isEmail() // `isEmail:expected_email`'),
		}))
			.toContain('appears in no code span of `isEmail.doc.md`')
	})

	it('fails a code written in prose rather than a code span', () => {
		expect(onlyError({
			[docPath]: doc({ name: 'isEmail' })
				.replace('This step emits no issue.', 'Fails with isEmail:expected_email.'),
		}))
			.toContain('appears in no code span of `isEmail.doc.md`')
	})

	// One cause, one finding: a missing entry is not also two missing codes.
	it('says nothing about a code when the entry that would list it is absent', () => {
		const error = onlyError({ [docPath]: null })
		expect(error)
			.toContain('no `isEmail.doc.md`')
		expect(error)
			.not
			.toContain('appears in no code span')
	})
})

describe('the asserted issue-code rule', () => {
	it('fails a code no test in the directory names', () => {
		expect(onlyError({
			[`${stepsRoot}/isEmail/isEmail.test.ts`]: 'it(\'rejects\', () => {\n\texpect(run().issues[0].message).toBe(\'Invalid value.\')\n})\n',
		}))
			.toContain('the owned issue code `isEmail:expected_email` appears in no string')
	})

	// Bypass: a tautology of a test with the code left in a `// FIXME`.
	it('fails a code that survives only in a comment', () => {
		expect(onlyError({
			[`${stepsRoot}/isEmail/isEmail.test.ts`]: [
				`import { expect, it } from 'vitest'`,
				'',
				'// FIXME: assert isEmail:expected_email once the payload shape settles.',
				'it(\'accepts an email address\', () => {',
				'\texpect(1).toBe(1)',
				'})',
				'',
			].join('\n'),
		}))
			.toContain('appears in no string')
	})

	it('fails a code that survives only in a block comment', () => {
		expect(onlyError({
			[`${stepsRoot}/isEmail/isEmail.test.ts`]: 'it(\'accepts\', () => {\n\t/* isEmail:expected_email */\n\texpect(1).toBe(1)\n})\n',
		}))
			.toContain('appears in no string')
	})

	it('accepts a code carried by an inline snapshot template', () => {
		expect(checkStepCompleteness(repository({
			[`${stepsRoot}/isEmail/isEmail.test.ts`]: 'it(\'rejects\', () => {\n\texpect(run()).toMatchInlineSnapshot(`{ "code": "isEmail:expected_email" }`)\n})\n',
		})).errors)
			.toEqual([])
	})

	it('reads a sibling test file in the same directory', () => {
		expect(checkStepCompleteness(repository({
			[`${stepsRoot}/isEmail/isEmail.test.ts`]: 'it(\'rejects\', () => {\n\texpect(1).toBe(1)\n})\n',
			[`${stepsRoot}/isEmail/isEmail.types.test.ts`]: 'it(\'rejects\', () => {\n\texpectTypeOf(run().issues[0].code).toEqualTypeOf<\'isEmail:expected_email\'>()\n})\n',
		})).errors)
			.toEqual([])
	})
})

describe('the file-set rule', () => {
	it('accepts the one auxiliary test the standard names', () => {
		expect(checkStepCompleteness(repository({
			[`${stepsRoot}/toTrimmed/toTrimmed.types.test.ts`]: 'it(\'infers a string\', () => {\n\texpectTypeOf(run()).toEqualTypeOf<string>()\n})\n',
		})).errors)
			.toEqual([])
	})

	it('fails a slice of the step\'s suite filed under a subject of its own', () => {
		expect(onlyError({ [`${stepsRoot}/toTrimmed/collectAllIssues.test.ts`]: 'it(\'collects\', () => {})\n' }))
			.toContain('`collectAllIssues.test.ts` is a slice of one step\'s suite filed under a name of its own')
	})

	it('fails a slice named after the step and an aspect', () => {
		expect(onlyError({ [`${stepsRoot}/toTrimmed/toTrimmed.async.test.ts`]: 'it(\'awaits\', () => {})\n' }))
			.toContain('`toTrimmed.async.test.ts` is a slice of one step\'s suite')
	})

	it('accepts a kebab-case helper module the step imports, with and without its own suite', () => {
		const helper = {
			[`${stepsRoot}/toTrimmed/toTrimmed.ts`]: main({ name: 'toTrimmed' })
				.replace(`import { implStepPlugin } from '../../core'`, `import { implStepPlugin } from '../../core'\nimport { whitespace } from './whitespace-class'`),
			[`${stepsRoot}/toTrimmed/whitespace-class.ts`]: 'export const whitespace = /\\s/\n',
		}
		expect(checkStepCompleteness(repository(helper)).errors)
			.toEqual([])
		expect(checkStepCompleteness(repository({
			...helper,
			[`${stepsRoot}/toTrimmed/whitespace-class.test.ts`]: 'it(\'matches a tab\', () => {})\n',
			[`${stepsRoot}/toTrimmed/whitespace-class.types.test.ts`]: 'it(\'is a RegExp\', () => {\n\texpectTypeOf(whitespace).toEqualTypeOf<RegExp>()\n})\n',
		})).errors)
			.toEqual([])
	})

	it('accepts a helper reached only through another helper', () => {
		expect(checkStepCompleteness(repository({
			[`${stepsRoot}/toTrimmed/toTrimmed.ts`]: main({ name: 'toTrimmed' })
				.replace(`import { implStepPlugin } from '../../core'`, `import { implStepPlugin } from '../../core'\nimport { whitespace } from './whitespace-class'`),
			[`${stepsRoot}/toTrimmed/whitespace-class.ts`]: 'export { unicode as whitespace } from \'./unicode-space\'\n',
			[`${stepsRoot}/toTrimmed/unicode-space.ts`]: 'export const unicode = /\\s/\n',
		})).errors)
			.toEqual([])
	})

	// Bypass: the hole an adversarial review found. Requiring only that `lazy-output.ts` exist let a
	// one-line `export {}` re-admit the 231-line suite this standard was written to fold in.
	it('fails a helper module nothing in the step reaches, so a fake pair cannot re-admit a suite', () => {
		const report = checkStepCompleteness(repository({
			[`${stepsRoot}/toTrimmed/lazy-output.ts`]: 'export {}\n',
			[`${stepsRoot}/toTrimmed/lazy-output.test.ts`]: 'it(\'is lazy\', () => {})\n',
		}))
		expect(report.errors)
			.toHaveLength(1)
		expect(report.errors[0])
			.toContain('`lazy-output.ts` is a module nothing in this step reaches')
		expect(report.errors[0])
			.toContain('`lazy-output.test.ts` reads as the suite for `lazy-output.ts`')
	})

	// The distinction that separates a helper's suite from a step's suite under another name: the
	// module it claims to test has to be there, and the step has to reach it.
	it('fails a kebab-case test with no module of that name beside it', () => {
		expect(onlyError({ [`${stepsRoot}/toTrimmed/lazy-output.test.ts`]: 'it(\'is lazy\', () => {})\n' }))
			.toContain('`lazy-output.test.ts` reads as the suite for `lazy-output.ts`, which this directory does not hold')
	})

	// The limit this rule keeps, stated in its docstring: reached, not used.
	it('accepts a helper the step only side-effect imports, as its comment says', () => {
		expect(checkStepCompleteness(repository({
			[`${stepsRoot}/toTrimmed/toTrimmed.ts`]: `import './lazy-output'\n${main({ name: 'toTrimmed' })}`,
			[`${stepsRoot}/toTrimmed/lazy-output.ts`]: 'export {}\n',
			[`${stepsRoot}/toTrimmed/lazy-output.test.ts`]: 'it(\'is lazy\', () => {})\n',
		})).errors)
			.toEqual([])
	})

	it('fails a `<name>.types.test.ts` that asserts nothing at the type level', () => {
		expect(onlyError({
			[`${stepsRoot}/toTrimmed/toTrimmed.types.test.ts`]: 'it(\'trims\', () => {\n\texpect(run()).toBe(\'ok\')\n})\n',
		}))
			.toContain('`toTrimmed.types.test.ts` calls no `expectTypeOf` or `assertType`')
	})

	it('accepts a `<name>.types.test.ts` that uses assertType', () => {
		expect(checkStepCompleteness(repository({
			[`${stepsRoot}/toTrimmed/toTrimmed.types.test.ts`]: 'it(\'trims\', () => {\n\tassertType<string>(run())\n})\n',
		})).errors)
			.toEqual([])
	})

	it('fails a helper module whose name is not kebab-case', () => {
		expect(onlyError({ [`${stepsRoot}/toTrimmed/whitespaceClass.ts`]: 'export const whitespace = /\\s/\n' }))
			.toContain('`whitespaceClass.ts` is a helper module whose name is not kebab-case')
	})

	it('fails a second benchmark file', () => {
		expect(onlyError({ [`${stepsRoot}/toTrimmed/long-input.bench.ts`]: 'bench(\'long\', () => {})\n' }))
			.toContain('`long-input.bench.ts` is a second benchmark file')
	})

	// `<name>.doc.md` is the one Markdown file a step unit holds, because it is the one a generator
	// reads. Any other is documentation no page shows.
	it('fails a Markdown file that is not the step\'s own entry', () => {
		expect(onlyError({ [`${stepsRoot}/toTrimmed/README.md`]: '# toTrimmed\n' }))
			.toContain('`README.md` is not part of a step unit')
	})

	it('fails a missing barrel', () => {
		expect(onlyError({ [`${stepsRoot}/toTrimmed/index.ts`]: null }))
			.toContain('no `index.ts`')
	})
})

describe('unexpectedEntries', () => {
	/** A directory holding exactly `files`, addressed the way the gate addresses it. */
	function directory(files: Record<string, string>): ReturnType<typeof objectTree> {
		return objectTree(Object.fromEntries(Object.entries(files)
			.map(([name, text]) => [`${stepsRoot}/map/${name}`, text])))
	}

	const reaching = `import { entries } from './lazy-output'\n`

	it('names nothing in a conforming directory', () => {
		expect(unexpectedEntries(directory({
			'index.ts': 'export * from \'./map\'\n',
			'map.ts': reaching,
			'map.test.ts': '',
			'map.types.test.ts': '',
			'map.bench.ts': '',
			'map.doc.md': '',
			'lazy-output.ts': 'export const entries = 1\n',
			'lazy-output.test.ts': '',
		}), 'map'))
			.toEqual([])
	})

	it('does not let a step whose own name is kebab-shaped smuggle a second suite in', () => {
		expect(unexpectedEntries(directory({
			'index.ts': '',
			'map.ts': '',
			'map.test.ts': '',
			'map.bench.ts': '',
			'map.async.test.ts': '',
		}), 'map')[0])
			.toContain('`map.async.test.ts` is a slice of one step\'s suite')
	})

	it('reports a subdirectory', () => {
		expect(unexpectedEntries(directory({
			'index.ts': '',
			'map.ts': '',
			'map.test.ts': '',
			'map.bench.ts': '',
			'helpers/thing.ts': '',
		}), 'map')[0])
			.toContain('`helpers` is not part of a step unit')
	})
})

describe('localSpecifiers', () => {
	it('takes the local module of an import and a re-export, and nothing else', () => {
		expect(localSpecifiers([
			`import { a } from './one'`,
			`import type { B } from './two'`,
			`export { c } from './three'`,
			`import './four'`,
			`import { d } from '../../core'`,
			`import { e } from 'vitest'`,
			`const f = './not-an-import'`,
		].join('\n')))
			.toEqual(['one', 'two', 'three', 'four'])
	})
})

describe('isKebabCase', () => {
	it.each([
		['base64url', true],
		['iso-calendar-date', true],
		['template-literal-part', true],
		['collectAllIssues', false],
		['lazy-output.async', false],
		['-leading', false],
		['trailing-', false],
		['double--dash', false],
		['Upper', false],
	])('reads %s as %s', (stem, expected) => {
		expect(isKebabCase(stem))
			.toBe(expected)
	})
})

describe('the barrel rule', () => {
	it('fails a barrel that re-exports a helper module alongside the step', () => {
		expect(onlyError({
			[`${stepsRoot}/toTrimmed/index.ts`]: 'export * from \'./toTrimmed\'\nexport * from \'./whitespace-class\'\n',
			[`${stepsRoot}/toTrimmed/whitespace-class.ts`]: 'export const whitespace = /\\s/\n',
		}))
			.toContain('`index.ts` is not exactly `export * from \'./toTrimmed\'`')
	})

	it('fails a barrel that exports the wrong directory', () => {
		expect(onlyError({ [`${stepsRoot}/toTrimmed/index.ts`]: 'export * from \'./toTrimmedStart\'\n' }))
			.toContain('is not exactly')
	})

	it('accepts a barrel however its trailing whitespace is written', () => {
		expect(barrelProblems('export * from \'./map\'', 'map'))
			.toEqual([])
		expect(barrelProblems('export * from \'./map\'\r\n', 'map'))
			.toEqual([])
	})

	// A missing barrel is the file-set rule's error, not two errors for one cause.
	it('says nothing about a barrel that is not there', () => {
		expect(barrelProblems(null, 'map'))
			.toEqual([])
	})
})

describe('the steps-root rule', () => {
	it('accepts a cross-step test named after a family and an aspect', () => {
		expect(checkStepCompleteness(repository({
			[`${stepsRoot}/structural.sync-fast-path.test.ts`]: 'it(\'stays synchronous\', () => {})\n',
			[`${stepsRoot}/failure-payload.types.test.ts`]: 'it(\'infers the payload\', () => {})\n',
		})).errors)
			.toEqual([])
	})

	it('fails a cross-step test with no aspect', () => {
		expect(onlyError({ [`${stepsRoot}/structural-sync-fast-path.test.ts`]: 'it(\'stays synchronous\', () => {})\n' }))
			.toContain(`${stepsRoot}/structural-sync-fast-path.test.ts: a cross-step test is named \`<family>.<aspect>.test.ts\``)
	})

	it('fails a cross-step test whose parts are not kebab-case', () => {
		expect(onlyError({ [`${stepsRoot}/structural.syncFastPath.test.ts`]: 'it(\'stays synchronous\', () => {})\n' }))
			.toContain('a cross-step test is named')
	})

	it('accepts an extra family that is not a step', () => {
		expect(checkStepCompleteness(repository({
			[`${stepsRoot}/collection-size.async.test.ts`]: 'it(\'awaits\', () => {})\n',
		})).errors)
			.toEqual([])
	})
})

describe('stepsRootProblems', () => {
	/** The steps root holding `entries`, with one step directory so directories are skipped. */
	function root(entries: readonly string[]): ReturnType<typeof objectTree> {
		return objectTree({
			[`${stepsRoot}/map/map.ts`]: '',
			...Object.fromEntries(entries.map(entry => [`${stepsRoot}/${entry}`, ''])),
		})
	}
	const steps = new Set(['map', 'set', 'isEmail'])

	it('accepts the barrel, a kebab-case shared module, and two-part cross-step tests', () => {
		expect(stepsRootProblems(root([
			'index.ts',
			'callback-error-sentinel.ts',
			'structural.sync-fast-path.test.ts',
			'failure-payload.types.test.ts',
		]), steps))
			.toEqual([])
	})

	// Bypass: the hole an adversarial review found. Checking only the two-part shape left the rule
	// satisfied by `map.async.test.ts` moved one directory up, because every all-lowercase step
	// directory name is also a valid kebab-case family — and that file is one of the fifteen this
	// standard was written to eliminate.
	it('fails a two-part name whose family is a step, so a slice cannot escape upward', () => {
		expect(stepsRootProblems(root(['index.ts', 'map.async.test.ts']), steps))
			.toEqual([`${stepsRoot}/map.async.test.ts: \`map\` is a step, so this is one step's test sitting where the cross-step contracts live. Fold it into \`${stepsRoot}/map/map.test.ts\`; a file here spans a family of steps and belongs to no single one of them.`])
	})

	it('fails a one-part name', () => {
		expect(stepsRootProblems(root(['index.ts', 'structural-sync-fast-path.test.ts']), steps)[0])
			.toContain('a cross-step test is named')
	})

	it('fails a camelCase shared module', () => {
		expect(stepsRootProblems(root(['index.ts', 'callbackErrorSentinel.ts']), steps)[0])
			.toContain('a module shared across step directories is kebab-case')
	})

	it('skips step directories rather than judging them by these rules', () => {
		expect(stepsRootProblems(root(['index.ts']), steps))
			.toEqual([])
	})

	it('accepts a kebab-case shared module and fails a camelCase one', () => {
		expect(checkStepCompleteness(repository({
			[`${stepsRoot}/callback-error-sentinel.ts`]: 'export class CallbackErrorSentinel {}\n',
		})).errors)
			.toEqual([])
		expect(onlyError({ [`${stepsRoot}/callbackErrorSentinel.ts`]: 'export class CallbackErrorSentinel {}\n' }))
			.toContain('a module shared across step directories is kebab-case')
	})

	// A root finding is not an input problem: it must not replace the per-step verdict.
	it('is reported alongside a per-step finding rather than instead of it', () => {
		const report = checkStepCompleteness(repository({
			[`${stepsRoot}/structural-sync-fast-path.test.ts`]: 'it(\'stays synchronous\', () => {})\n',
			[`${stepsRoot}/toTrimmed/toTrimmed.bench.ts`]: '',
		}))
		expect(report.errors)
			.toHaveLength(2)
		expect(report.errors[0])
			.toContain('calls no `stepBench`')
		expect(report.errors[1])
			.toContain('a cross-step test is named')
	})
})

describe('the section-order rule', () => {
	const contract = [
		'type Meta = DefineStepMethodMeta<{',
		`\tName: 'toTrimmed'`,
		'}>',
		'',
		'interface PluginDef extends TStepPluginDef {',
		'\ttoTrimmed: DefineStepMethod<Meta, () => Next<undefined, this[\'CurrentValchecker\']>>',
		'}',
	]
	const plugin = 'export const toTrimmed = implStepPlugin<PluginDef>({}, \'sync\')'

	function file(...lines: (string | null)[]): string {
		return `${lines.filter(line => line != null)
			.join('\n')}\n`
	}

	it('accepts the canonical order, with values between PluginDef and the plugin', () => {
		expect(declarationProblems(file(...contract, '', 'const pattern = /\\s/', '', plugin), 'toTrimmed'))
			.toEqual([])
	})

	it('fails a value declared above PluginDef, naming it', () => {
		expect(declarationProblems(file('const pattern = /\\s/', '', ...contract, '', plugin), 'toTrimmed'))
			.toEqual(['toTrimmed.ts: `pattern` is above `PluginDef`, and it is not erased syntax. Only types may sit between the imports and `PluginDef`; anything that runs goes below it, so opening the file shows what the step does before how — and nothing forward-references, because the only statement that reads it is the last one.'])
	})

	it('fails a function declared between Meta and PluginDef', () => {
		expect(declarationProblems(file(...contract.slice(0, 3), '', 'function parse(): void {}', '', ...contract.slice(4), '', plugin), 'toTrimmed')[0])
			.toContain('`parse` is above `PluginDef`')
	})

	it('fails Meta declared after PluginDef', () => {
		expect(declarationProblems(file(...contract.slice(4), '', ...contract.slice(0, 3), '', plugin), 'toTrimmed'))
			.toEqual(['toTrimmed.ts: `PluginDef` is declared before `Meta`. `Meta` comes first: it is what `PluginDef` is written against.'])
	})

	it.each([
		['type StepMeta = DefineStepMethodMeta<{', 'no `type Meta` declaration'],
	])('fails a Meta under another name (%s)', (line, expected) => {
		expect(declarationProblems(file(line, `\tName: 'toTrimmed'`, '}>', '', ...contract.slice(4), '', plugin), 'toTrimmed')[0])
			.toContain(expected)
	})

	it('fails a PluginDef under another name, as the four bound steps had', () => {
		expect(declarationProblems(file(...contract.slice(0, 3), '', 'interface AtLeastPluginDef extends TStepPluginDef {', '}', '', 'export const isAtLeast = implStepPlugin<AtLeastPluginDef>({}, \'sync\')'), 'isAtLeast')[0])
			.toContain('no `interface PluginDef extends TStepPluginDef` declaration')
	})

	it('fails an issue namespace under a prefixed name', () => {
		expect(declarationProblems(file('declare namespace AtLeastInternal {', '}', '', ...contract, '', plugin), 'toTrimmed')[0])
			.toContain('the local namespace is `AtLeastInternal`, not `Internal`')
	})

	it('accepts the issue namespace under its canonical name', () => {
		expect(declarationProblems(file('declare namespace Internal {', '}', '', ...contract, '', plugin), 'toTrimmed'))
			.toEqual([])
	})

	it('fails a statement after the plugin construction', () => {
		expect(declarationProblems(file(...contract, '', plugin, '', 'const unused = 1'), 'toTrimmed')[0])
			.toContain('the `implStepPlugin` construction is not the last statement in the file')
	})

	it('fails a file that constructs no plugin', () => {
		expect(declarationProblems(file(...contract), 'toTrimmed')[0])
			.toContain('publishes no step')
	})

	// Bypass: a non-`declare` namespace emits an IIFE, so a `const` inside one is a runtime value
	// above `Meta` — which the first version, enumerating const/function/class/enum, did not see.
	it('fails a value-emitting namespace above PluginDef', () => {
		expect(declarationProblems(file('namespace Internal {', '\texport const pattern = /\\s/', '}', '', ...contract, '', plugin), 'toTrimmed')[0])
			.toContain('the value-emitting `namespace Internal` is above `PluginDef`, and it is not erased syntax')
	})

	it('still accepts the erased `declare namespace Internal` above Meta', () => {
		expect(declarationProblems(file('declare namespace Internal {', '\texport type SelfIssue = never', '}', '', ...contract, '', plugin), 'toTrimmed'))
			.toEqual([])
	})

	// Bypass: three more ways past an enumeration of declaration kinds.
	it.each([
		['a top-level expression statement', 'globalThis.marker = 1'],
		['a top-level await', 'await Promise.resolve()'],
		['an import-equals declaration', 'import legacy = require(\'./legacy\')'],
	])('fails %s above PluginDef', (_label, statement) => {
		expect(declarationProblems(file(statement, '', ...contract, '', plugin), 'toTrimmed')[0])
			.toContain('above `PluginDef`, and it is not erased syntax')
	})

	// Bypass: `plugin` used to be overwritten by each match, so an earlier construction was neither
	// position-checked nor counted as a value the order rule could see.
	it('fails a second, earlier implStepPlugin construction', () => {
		expect(declarationProblems(file('const shim = implStepPlugin({}, \'sync\')', '', ...contract, '', plugin), 'toTrimmed')[0])
			.toContain('`implStepPlugin` is called 2 times')
	})

	// The plugin is the file's only export. A helper another step needs lives in its own module.
	it.each([
		['a re-export', 'export * from \'./base64url\''],
		['a named re-export', 'export { helper } from \'./base64url\''],
		['an exported type', 'export type Extra = string'],
		['an exported const', 'export const extra = 1'],
	])('fails %s beside the plugin', (_label, statement) => {
		expect(declarationProblems(file(...contract, '', statement, '', plugin), 'toTrimmed')
			.some(problem => problem.includes('is exported. The plugin is the file\'s only export')))
			.toBe(true)
	})

	// The limit the module's comment admits to: a *type* is the same syntax in either section, so
	// the gate cannot tell an implementation type placed above `Meta` from a contract one.
	it('accepts a type declared in either section, as its comment says', () => {
		expect(declarationProblems(file('interface FlatProperties { keys: string[] }', '', ...contract, '', plugin), 'toTrimmed'))
			.toEqual([])
		expect(declarationProblems(file(...contract, '', 'interface FlatProperties { keys: string[] }', '', plugin), 'toTrimmed'))
			.toEqual([])
	})
})

describe('declaredCodes', () => {
	it('reads each code once, however the type argument is wrapped', () => {
		expect(declaredCodes('ExecutionIssue<\'a:b\', X> | ExecutionIssue<\n\t\'c:d\'\n> | ExecutionIssue<\'a:b\'>'))
			.toEqual(['a:b', 'c:d'])
	})
})

describe('documents', () => {
	// The one thing the first version already got right, kept true: a longer step name must not
	// satisfy the shorter one it starts with.
	it.each([
		['isBase64', 'isBase64Url'],
		['toTrimmed', 'toTrimmedStart'],
		['isLengthAtLeast', 'isLengthAtMost'],
		['isIsoDate', 'isIsoDateTime'],
		['isEmpty', 'isNotEmpty'],
	])('does not let %s and %s satisfy each other', (shorter, longer) => {
		expect(documents([`${longer}()`], shorter))
			.toBe(false)
		expect(documents([`${shorter}()`], longer))
			.toBe(false)
		expect(documents([`${shorter}()`], shorter))
			.toBe(true)
	})

	it('accepts a receiver and a type argument', () => {
		expect(documents(['bigint().toSafeNumber(options?)'], 'toSafeNumber'))
			.toBe(true)
		expect(documents(['literal<T>(value)'], 'literal'))
			.toBe(true)
	})

	it('rejects a bare name with no call or type argument after it', () => {
		expect(documents(['toTrimmed'], 'toTrimmed'))
			.toBe(false)
	})
})

describe('stripHtmlComments', () => {
	it('blanks a comment while keeping the line count', () => {
		const stripped = stripHtmlComments('a\n<!-- one\ntwo -->\nb')
		expect(stripped.split('\n'))
			.toHaveLength(4)
		expect(stripped).not.toContain('one')
		expect(stripped.split('\n')[3])
			.toBe('b')
	})
})

describe('outsideFencedBlocks', () => {
	it('drops a fenced block and its delimiters', () => {
		expect(outsideFencedBlocks('a\n```ts\nb\n```\nc'))
			.toBe('a\nc')
	})

	it('drops a tilde fence and an indented one', () => {
		expect(outsideFencedBlocks('a\n~~~\nb\n~~~\nc'))
			.toBe('a\nc')
		expect(outsideFencedBlocks('a\n   ```\nb\n   ```\nc'))
			.toBe('a\nc')
	})

	it('does not close a longer fence with a shorter run', () => {
		expect(outsideFencedBlocks('a\n````\n```\nb\n````\nc'))
			.toBe('a\nc')
	})

	it('does not close a backtick fence with tildes', () => {
		expect(outsideFencedBlocks('a\n```\n~~~\nb\n```\nc'))
			.toBe('a\nc')
	})

	it('runs an unclosed fence to the end of the document, as CommonMark does', () => {
		expect(outsideFencedBlocks('a\n```\nb\nc'))
			.toBe('a')
	})

	it('reads CRLF the same as LF', () => {
		expect(outsideFencedBlocks('a\r\n```ts\r\nb\r\n```\r\nc'))
			.toBe('a\nc')
	})
})

describe('codeSpans over visibleMarkdown', () => {
	it('finds a span in prose and not one inside a fence or a comment', () => {
		const page = [
			'`kept()` in prose',
			'',
			'```ts',
			'// `fenced()` here',
			'```',
			'',
			'<!-- `commented()` here -->',
		].join('\n')
		expect(codeSpans(visibleMarkdown(page)))
			.toEqual(['kept()'])
	})
})

describe('entryDescription', () => {
	it('takes the prose between the heading and the first example', () => {
		expect(entryDescription('### `x()`\n\nDoes it.\nTwice.\n\n```ts\nx()\n```\n'))
			.toBe('Does it.\nTwice.')
	})

	it('stops at a subheading', () => {
		expect(entryDescription('### `x()`\n\nDoes it.\n\n#### Example\n\nMore prose.\n'))
			.toBe('Does it.')
	})

	// Not `outsideFencedBlocks` first: with the fence removed, the text after it would read as the
	// description, and an entry with no description at all would satisfy the rule.
	it('is empty when the heading runs straight into an example', () => {
		expect(entryDescription('### `x()`\n\n```ts\nx()\n```\n\nAfterwards.\n'))
			.toBe('')
	})

	it('does not count an HTML comment as prose', () => {
		expect(entryDescription('### `x()`\n\n<!-- TODO: describe it. -->\n\n```ts\nx()\n```\n'))
			.toBe('')
	})

	it('is null when there is no `### ` heading', () => {
		expect(entryDescription('# `x()`\n\nDoes it.\n'))
			.toBeNull()
	})
})

describe('hasTypeScriptExample', () => {
	it.each([
		['```ts', true],
		['```tsx', true],
		['````ts twoslash', true],
		['   ```ts', true],
		['```js', false],
		['```', false],
		['~~~ts', false],
		['```typescript', false],
	])('reads %s as %s', (opener, expected) => {
		expect(hasTypeScriptExample(`a\n${opener}\nx()\n\`\`\`\n`))
			.toBe(expected)
	})
})

describe('stringLiteralTexts', () => {
	it('takes strings and template parts, and never a comment', () => {
		const texts = stringLiteralTexts([
			'// a:comment',
			'/* b:block */',
			'const single = \'c:single\'',
			`const template = \`d:template \${x} e:tail\``,
			'const plain = `f:plain`',
		].join('\n'))
		expect(texts.sort())
			.toEqual(['c:single', 'd:template ', 'f:plain', ' e:tail'].sort())
	})

	it('is not confused by a regular expression containing quotes and slashes', () => {
		expect(stringLiteralTexts('const pattern = /^[\'"]?\\/\\/[a-z]+$/\nconst code = \'x:y\'\n'))
			.toEqual(['x:y'])
	})
})

describe('callsAnyOf', () => {
	it('finds a call however it is qualified', () => {
		expect(callsAnyOf('it(\'a\', () => {})', ['it']))
			.toBe(true)
		expect(callsAnyOf('it.skipIf(true)(\'a\', () => {})', ['it']))
			.toBe(true)
		expect(callsAnyOf('describe(\'a\', () => {\n\ttest(\'b\', () => {})\n})', ['it', 'test']))
			.toBe(true)
	})

	it('does not find a name that only appears as a string or an identifier', () => {
		expect(callsAnyOf('const it = 1\nconst name = \'it(\'\n', ['it']))
			.toBe(false)
	})
})
