import { describe, expect, it } from 'vitest'
import { objectTree } from './source-tree'
import {
	callsAnyOf,
	checkStepCompleteness,
	codeSpans,
	declaredCodes,
	documents,
	outsideFencedBlocks,
	stringLiteralTexts,
	stripHtmlComments,
	successMessage,
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
 * The three rules that remain weaker than what they stand for — a test case that asserts
 * nothing, a mention that is not a description — have tests pinning that too, so the gate's
 * wording and its behaviour cannot drift apart silently.
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

function main({ name, code }: StepFixture): string {
	return [
		`import { implStepPlugin } from '../../core'`,
		'',
		'type Meta = DefineStepMethodMeta<{',
		`\tName: '${name}'`,
		code == null ? null : `\tSelfIssue: ExecutionIssue<'${code}', { value: string }>`,
		'}>',
		'',
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
		`import { bench, describe } from 'vitest'`,
		'',
		`describe('${name}', () => {`,
		`\tbench('valid input', () => {`,
		`\t\trun()`,
		'\t})',
		'})',
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
		'docs/api/overview.md': [
			'# API',
			'',
			...fixtures.map(fixture => `- \`${fixture.name}()\` — does the thing`),
			'',
		].join('\n'),
		'docs/api/reference.md': [
			'# Reference',
			'',
			...fixtures.flatMap(fixture => [
				`## \`${fixture.name}()\``,
				'',
				fixture.code == null ? 'Issues: none.' : `Issues: \`${fixture.code}\`.`,
				'',
			]),
		].join('\n'),
	}

	for (const fixture of fixtures) {
		files[`${stepsRoot}/${fixture.name}/${fixture.name}.ts`] = main(fixture)
		files[`${stepsRoot}/${fixture.name}/${fixture.name}.test.ts`] = test_(fixture)
		files[`${stepsRoot}/${fixture.name}/${fixture.name}.bench.ts`] = bench(fixture)
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
			'docs/api/overview.md',
			'docs/api/reference.md',
			...fixtures.flatMap(fixture => [
				`${stepsRoot}/${fixture.name}/${fixture.name}.ts`,
				`${stepsRoot}/${fixture.name}/${fixture.name}.test.ts`,
				`${stepsRoot}/${fixture.name}/${fixture.name}.bench.ts`,
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

	it('include a missing catalog page', () => {
		expect(onlyError({ 'docs/api/overview.md': null }))
			.toContain('docs/api/overview.md is missing')
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
			.toContain('`toTrimmed.bench.ts` calls no `bench`')
	})

	it('fails a benchmark file that only describes', () => {
		expect(onlyError({ [`${stepsRoot}/toTrimmed/toTrimmed.bench.ts`]: 'describe(\'toTrimmed\', () => {})\n' }))
			.toContain('calls no `bench`')
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

describe('the catalog rule', () => {
	it('fails a step the catalog does not list', () => {
		expect(onlyError({ 'docs/api/overview.md': '# API\n\n- `isEmail()` — does the thing\n' }))
			.toContain('no code span in docs/api/overview.md writes `toTrimmed(`')
	})

	// Bypass: the catalog entry replaced by a line inside a ```ts fence. The old comment claimed
	// a fenced block could not produce a false span, which reasoned about the fence delimiters
	// and not about the lines between them.
	it('fails a catalog mention that lives inside a fenced code block', () => {
		expect(onlyError({
			'docs/api/overview.md': [
				'# API',
				'',
				'- `isEmail()` — does the thing',
				'',
				'```ts',
				'// `toTrimmed()` — removed in 2.0',
				'```',
				'',
			].join('\n'),
		}))
			.toContain('no code span in docs/api/overview.md writes `toTrimmed(`')
	})

	it('fails a catalog mention that lives inside an HTML comment', () => {
		expect(onlyError({
			'docs/api/overview.md': '# API\n\n- `isEmail()` — does the thing\n\n<!-- TODO: document `toTrimmed()`. -->\n',
		}))
			.toContain('no code span in docs/api/overview.md writes `toTrimmed(`')
	})

	it('accepts the entry once it is back outside the fence', () => {
		expect(checkStepCompleteness(repository({
			'docs/api/overview.md': '# API\n\n- `isEmail()` — does the thing\n- `toTrimmed()` — trims\n\n```ts\nv.string().toTrimmed()\n```\n',
		})).errors)
			.toEqual([])
	})
})

describe('the reference-page rule', () => {
	it('fails a step no page other than the catalog mentions', () => {
		expect(onlyError({ 'docs/api/reference.md': '# Reference\n\n## `isEmail()`\n\nIssues: `isEmail:expected_email`.\n' }))
			.toContain('no docs/api page other than overview.md writes `toTrimmed(` in a code span')
	})

	// The gap the message admits to: any mention in call form satisfies this, including a
	// sentence saying the step does not exist. Pinned so the wording cannot quietly grow.
	it('accepts a mention that says the step is unavailable, as its message says', () => {
		expect(checkStepCompleteness(repository({
			'docs/api/reference.md': [
				'# Reference',
				'',
				'## `isEmail()`',
				'',
				'Issues: `isEmail:expected_email`.',
				'',
				'`toTrimmed()` has never been available on Map keys.',
				'',
			].join('\n'),
		})).errors)
			.toEqual([])
	})
})

describe('the documented issue-code rule', () => {
	it('fails a code no reference page carries', () => {
		expect(onlyError({ 'docs/api/reference.md': '# Reference\n\n## `isEmail()`\n\n## `toTrimmed()`\n' }))
			.toContain('the owned issue code `isEmail:expected_email` appears nowhere under docs/api')
	})

	// Bypass: the code lines replaced by an HTML comment saying they still need writing up.
	it('fails a code that survives only in an HTML comment', () => {
		expect(onlyError({
			'docs/api/reference.md': [
				'# Reference',
				'',
				'## `isEmail()`',
				'',
				'<!-- TODO: write up isEmail:expected_email. -->',
				'',
				'## `toTrimmed()`',
				'',
			].join('\n'),
		}))
			.toContain('appears nowhere under docs/api')
	})

	it('fails a code that survives only inside a fenced block', () => {
		expect(onlyError({
			'docs/api/reference.md': '# Reference\n\n## `isEmail()`\n\n```json\n{ "code": "isEmail:expected_email" }\n```\n\n## `toTrimmed()`\n',
		}))
			.toContain('appears nowhere under docs/api')
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
			[`${stepsRoot}/isEmail/isEmail.async.test.ts`]: 'it(\'rejects\', () => {\n\texpect(run().issues[0].code).toBe(\'isEmail:expected_email\')\n})\n',
		})).errors)
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
