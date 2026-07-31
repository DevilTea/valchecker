import type { LedgerEntry } from './check-mutation-survivors'
import { describe, expect, it } from 'vitest'
import { checkSuppressions, collectSuppressions, collectSurvivors, evaluate, LEDGER_CLASSIFICATIONS, sliceSource, statesSomething, survivorKey, UNDETECTED_STATUSES, UNTRIAGED } from './check-mutation-survivors'

/**
 * These protect the two things a mutation gate gets wrong silently.
 *
 * The first is the status mapping. The hand-rolled sweep this replaces read Vitest's
 * collection-time failure (`no tests`) as "no test failed", and reported three killed mutants
 * per slice as survivors — the audit only noticed because it re-checked by hand. A runner or
 * configuration change that made `CompileError` or `RuntimeError` read as undetected would
 * reproduce that failure, and nothing else in the repository would notice, so it is pinned
 * here by name rather than left to the runner's documentation.
 *
 * The second is direction: a gate that only fails on new survivors is a ratchet that never
 * releases. Rot in the other direction — an entry whose mutant is now killed — is asserted
 * with the same weight, and so is the scoping rule that keeps a partial run from declaring
 * files it never measured to be clean.
 */

const REPORT_STATUSES = [
	'Killed',
	'Survived',
	'NoCoverage',
	'Timeout',
	'CompileError',
	'RuntimeError',
	'Ignored',
	'Pending',
] as const

function report(mutants: Array<{ status: string, replacement?: string, line?: number }>, source = 'const a = 1\nconst b = 2\n') {
	return {
		files: {
			'packages/internal/src/steps/x/x.ts': {
				source,
				mutants: mutants.map((mutant, index) => ({
					mutatorName: 'ConditionalExpression',
					replacement: mutant.replacement ?? 'false',
					status: mutant.status,
					// 1-based, and `end.column` is the column after the last character, so
					// this spans exactly one character starting at `index`.
					location: {
						start: { line: mutant.line ?? 1, column: index + 1 },
						end: { line: mutant.line ?? 1, column: index + 2 },
					},
				})),
			},
		},
	}
}

function entry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
	return {
		file: 'packages/internal/src/steps/x/x.ts',
		line: 1,
		mutator: 'ConditionalExpression',
		original: 'c',
		replacement: 'false',
		count: 1,
		classification: 'EQUIVALENT',
		reason: 'the branch falls through to a loop computing the same result',
		evidence: 'the whole suite passes with the branch replaced by a throw',
		...overrides,
	}
}

const alwaysExists = () => true

describe('mutation status mapping', () => {
	it('treats only Survived and NoCoverage as undetected', () => {
		expect([...UNDETECTED_STATUSES])
			.toEqual(['Survived', 'NoCoverage'])
	})

	it('counts a mutant that breaks compilation or the test run as detected, never as a survivor', () => {
		const survivors = collectSurvivors(report(REPORT_STATUSES.map(status => ({ status }))))
		const statuses = REPORT_STATUSES.filter(status => !(UNDETECTED_STATUSES as readonly string[]).includes(status))

		// The explicit list, not just the count: a rename on either side must fail loudly.
		expect(statuses)
			.toEqual(['Killed', 'Timeout', 'CompileError', 'RuntimeError', 'Ignored', 'Pending'])
		expect([...survivors.values()].reduce((total, survivor) => total + survivor.count, 0))
			.toBe(2)
	})

	it('groups identical mutants by source text rather than by position', () => {
		const survivors = collectSurvivors(report([
			{ status: 'Survived' },
			{ status: 'Survived' },
		], 'ccc\n'))

		expect(survivors.size)
			.toBe(1)
		expect([...survivors.values()][0]!.count)
			.toBe(2)
	})

	// Both are 1-based, and `end.column` is the column after the last character. Read as
	// 0-based the extract is shifted one character left, which still looks plausible in a
	// ledger — `default',` for `'default',` — so it is asserted against exact text.
	it('reads a single-line mutant out of the report source at its 1-based columns', () => {
		expect(sliceSource('\tif (remainder === 0)\n', { start: { line: 1, column: 6 }, end: { line: 1, column: 21 } }))
			.toBe('remainder === 0')
	})

	it('reads a mutant spanning several lines out of the report source', () => {
		expect(sliceSource('const a = [\n\t1,\n]\n', { start: { line: 1, column: 11 }, end: { line: 3, column: 2 } }))
			.toBe('[\n\t1,\n]')
	})
})

describe('mutation ledger gate', () => {
	it('fails an undetected mutant with no ledger entry', () => {
		const result = evaluate(
			{ entries: [] },
			collectSurvivors(report([{ status: 'Survived' }], 'c\n')),
			new Set(['packages/internal/src/steps/x/x.ts']),
			alwaysExists,
		)

		expect(result.unexplained)
			.toHaveLength(1)
		expect(result.acknowledged)
			.toHaveLength(0)
	})

	it('accepts a classified entry and reports it as acknowledged', () => {
		const result = evaluate(
			{ entries: [entry()] },
			collectSurvivors(report([{ status: 'Survived' }], 'c\n')),
			new Set(['packages/internal/src/steps/x/x.ts']),
			alwaysExists,
		)

		expect(result.unexplained)
			.toHaveLength(0)
		expect(result.stale)
			.toHaveLength(0)
		expect(result.acknowledged)
			.toHaveLength(1)
	})

	it('fails an entry whose mutant the run now kills, so the ledger shrinks as tests improve', () => {
		const result = evaluate(
			{ entries: [entry()] },
			collectSurvivors(report([{ status: 'Killed' }], 'c\n')),
			new Set(['packages/internal/src/steps/x/x.ts']),
			alwaysExists,
		)

		expect(result.stale)
			.toHaveLength(1)
	})

	it('fails when the number of identical survivors no longer matches the entry', () => {
		const result = evaluate(
			{ entries: [entry({ count: 2 })] },
			collectSurvivors(report([{ status: 'Survived' }], 'c\n')),
			new Set(['packages/internal/src/steps/x/x.ts']),
			alwaysExists,
		)

		expect(result.countMismatches)
			.toEqual([{ entry: entry({ count: 2 }), actual: 1 }])
	})

	it('leaves entries for files the run never mutated untouched rather than calling them stale', () => {
		const untouched = entry({ file: 'packages/internal/src/steps/y/y.ts' })
		const result = evaluate(
			{ entries: [untouched] },
			collectSurvivors(report([{ status: 'Killed' }], 'c\n')),
			new Set(['packages/internal/src/steps/x/x.ts']),
			alwaysExists,
		)

		expect(result.stale)
			.toHaveLength(0)
		expect(result.skipped)
			.toEqual([untouched])
	})

	it('rejects an untriaged entry, so --write alone cannot make the gate pass', () => {
		expect(UNTRIAGED)
			.toBe('UNKNOWN')

		const result = evaluate(
			{ entries: [entry({ classification: UNTRIAGED, reason: '', evidence: '' })] },
			collectSurvivors(report([{ status: 'Survived' }], 'c\n')),
			new Set(['packages/internal/src/steps/x/x.ts']),
			alwaysExists,
		)

		expect(result.untriaged)
			.toHaveLength(1)
	})

	it('rejects a classified entry that states no reason and one that states no evidence', () => {
		for (const missing of [{ reason: '   ' }, { evidence: '' }]) {
			const result = evaluate(
				{ entries: [entry(missing)] },
				collectSurvivors(report([{ status: 'Survived' }], 'c\n')),
				new Set(['packages/internal/src/steps/x/x.ts']),
				alwaysExists,
			)

			expect(result.invalid, JSON.stringify(missing))
				.toHaveLength(1)
		}
	})

	// The field exists so a reader can disagree with the claim. A reason that restates the
	// classification gives them nothing to disagree with, and is the shape a batch
	// classification takes when nobody checked the members individually.
	it('rejects a reason that only repeats the classification', () => {
		expect(statesSomething('equivalent'))
			.toBe(false)
		expect(statesSomething('EQUIVALENT'))
			.toBe(false)
		expect(statesSomething('see above'))
			.toBe(false)
		expect(statesSomething('short'))
			.toBe(false)
		expect(statesSomething('then(undefined) passes the value through, so the extra iteration is a no-op'))
			.toBe(true)
	})

	it('rejects TEST_GAP as a ledger classification, because a real gap is closed by a test', () => {
		expect([...LEDGER_CLASSIFICATIONS])
			.toEqual(['EQUIVALENT', 'UNREACHABLE', 'PRODUCT_DECISION', 'TOOL_ARTIFACT'])

		const result = evaluate(
			{ entries: [entry({ classification: 'TEST_GAP' as never })] },
			collectSurvivors(report([{ status: 'Survived' }], 'c\n')),
			new Set(['packages/internal/src/steps/x/x.ts']),
			alwaysExists,
		)

		expect(result.invalid)
			.toHaveLength(1)
	})

	it('fails an entry naming a file that no longer exists', () => {
		const result = evaluate(
			{ entries: [entry({ file: 'packages/internal/src/steps/gone/gone.ts' })] },
			collectSurvivors(report([{ status: 'Survived' }], 'c\n')),
			new Set(['packages/internal/src/steps/x/x.ts']),
			() => false,
		)

		expect(result.orphaned)
			.toHaveLength(1)
		expect(result.skipped)
			.toHaveLength(0)
	})

	it('identifies a survivor by source text so unrelated edits above it do not orphan the entry', () => {
		const moved = survivorKey({ ...entry(), file: entry().file })
		expect(moved)
			.toBe(survivorKey(entry()))
		expect(survivorKey(entry({ original: 'other' }))).not.toBe(moved)
		// The line travels with the entry for a reader, and is deliberately not identity.
		expect(survivorKey(entry({ line: 999 })))
			.toBe(moved)
	})
})

/**
 * The other half of the contract. A structural pattern whose equivalence follows from one
 * invariant is suppressed beside the code rather than listed in the ledger, which puts the
 * argument where it can be checked — and creates the failure mode the ledger's rot check was
 * written for: an exemption that outlives the construct it was about.
 */
describe('in-source suppressions', () => {
	const FILE = 'packages/internal/src/steps/x/x.ts'

	function suppressionReport(source: string, ignoredLines: number[]) {
		return {
			files: {
				[FILE]: {
					source,
					mutants: ignoredLines.map(line => ({
						mutatorName: 'ConditionalExpression',
						replacement: 'false',
						status: 'Ignored',
						location: { start: { line, column: 1 }, end: { line, column: 2 } },
					})),
				},
			},
		}
	}

	it('reads Stryker\'s own directive grammar, including a mutator list and a block scope', () => {
		expect(collectSuppressions(FILE, [
			'// Stryker disable next-line ConditionalExpression: the branch cannot be taken here',
			'const a = 1',
			'// Stryker disable ConditionalExpression,BlockStatement: arity specializations of one algorithm',
			'const b = 2',
			'// Stryker restore ConditionalExpression,BlockStatement',
			'// eslint-disable-next-line no-console -- not a Stryker directive',
		].join('\n')))
			.toEqual([
				{ file: FILE, line: 1, mutators: ['ConditionalExpression'], scope: 'next-line', reason: 'the branch cannot be taken here' },
				{ file: FILE, line: 3, mutators: ['ConditionalExpression', 'BlockStatement'], scope: 'block', reason: 'arity specializations of one algorithm' },
			])
	})

	it('accepts a directive that still ignores a mutant inside its scope', () => {
		const source = '// Stryker disable next-line ConditionalExpression: the branch falls through to the same loop\nif (a) return b\n'
		const { problems } = checkSuppressions(suppressionReport(source, [2]), new Set([FILE]))

		expect(problems)
			.toEqual([])
	})

	it('fails a directive that ignores nothing, so an exemption cannot outlive its code', () => {
		const source = '// Stryker disable next-line ConditionalExpression: the branch falls through to the same loop\nconst plain = 1\n'
		const { problems } = checkSuppressions(suppressionReport(source, []), new Set([FILE]))

		expect(problems.map(problem => problem.kind))
			.toEqual(['stale'])
	})

	it('fails a directive whose reason only names the conclusion', () => {
		const source = '// Stryker disable next-line ConditionalExpression: equivalent\nif (a) return b\n'
		const { problems } = checkSuppressions(suppressionReport(source, [2]), new Set([FILE]))

		expect(problems.map(problem => problem.kind))
			.toEqual(['unreasoned'])
	})

	it('scopes a block directive to its restore, so a later ignored mutant does not keep it alive', () => {
		const source = [
			'// Stryker disable ConditionalExpression: arity specializations that fall through to one loop',
			'const inside = 1',
			'// Stryker restore ConditionalExpression',
			'const outside = 2',
		].join('\n')
		const { problems } = checkSuppressions(suppressionReport(source, [4]), new Set([FILE]))

		expect(problems.map(problem => problem.kind))
			.toEqual(['stale'])
	})
})
