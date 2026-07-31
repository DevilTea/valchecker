/**
 * The mutation gate.
 *
 * Coverage answers "did execution reach this code?". Mutation answers "would a plausible
 * behavioural change be noticed?" — and the #134/#135 audit showed those are different
 * questions here: reading missed defects that mutation found, and several tests that looked
 * meaningful turned out not to discriminate the behaviour their titles claimed.
 *
 * **What this gate is not.** It is not a mutation score. A rule such as "score >= 95%"
 * rewards killing equivalent mutants, and the only way to kill an equivalent mutant is to
 * assert an implementation detail — a test that pins how the code is written rather than what
 * it promises. `stryker.config.mjs` therefore sets `thresholds.break` to null, and no
 * percentage appears anywhere below.
 *
 * **The hard rule.** New and unclassified survivors must be zero. Not a percentage, and not
 * "fewer than last time": a survivor is either killed by a test or written down with a
 * classification and the evidence behind it.
 *
 * **Triage has six outcomes, and only four of them can be recorded here.**
 *
 * - `TEST_GAP` — the suite cannot tell correct behaviour from this broken one. **Not a ledger
 *   classification.** Add or strengthen the smallest assertion at the layer that owns the
 *   contract, and prove it by watching the test fail under the mutation and pass without it.
 * - `EQUIVALENT` — the mutated program is observably identical. The reason must state the
 *   invariant that makes it so, not assert the conclusion: "`then(undefined)` passes the value
 *   through, so one extra iteration computes the same result" is a reason; "equivalent" is not.
 * - `UNREACHABLE` — no input the public API admits can execute it. The question it raises is
 *   whether the code should exist, which is a refactor decision rather than a test gap.
 * - `PRODUCT_DECISION` — killing it needs the public contract decided first; a test written
 *   before the decision pins an accident.
 * - `TOOL_ARTIFACT` — the mutant is not a plausible behavioural change at all: the runner
 *   produced it from syntax that carries no behaviour, so nothing about the program is in
 *   question. Name what the runner did, not just that it did something.
 * - `UNKNOWN` — triage has not reached it. Recorded so it is visible, and **it fails the
 *   gate**, because an unexamined survivor read as a passing one is the failure this exists
 *   to prevent.
 *
 * Nothing may be filed as `EQUIVALENT` because a batch of neighbours were. Each entry stands
 * on its own invariant and its own `evidence` — how the classification was checked.
 *
 * **Where a classification lives.** A survivor that belongs to a *structural pattern* whose
 * equivalence follows from one stated invariant — a set of arity specializations of one
 * algorithm, say — is suppressed in place with a `// Stryker disable … : <why>` directive, so
 * the argument sits beside the code it is about. Everything else is an isolated case and goes
 * in the ledger with its operator, location, reason and evidence. Both are checked for rot:
 * a directive that no longer ignores anything is stale and fails, exactly like a ledger entry
 * whose mutant is now killed.
 *
 * `--write` deliberately cannot make the gate pass on its own: it records new survivors as
 * `UNKNOWN`, which this gate rejects. Writing the classification is the point, and it is the
 * one part no script can do.
 *
 * **Rot is checked in both directions**, for the reason `benchmarks/src/accepted-regressions.mjs`
 * gives: a ledger that only grows is a place findings go to be forgotten. An entry whose
 * mutant is now killed fails, so the list shrinks as the tests improve; an entry naming a file
 * that no longer exists fails rather than lingering.
 *
 * **A scoped run leaves the rest of the ledger alone.** A changed-scope run only mutates some
 * files, so entries for files the run never touched are neither confirmed nor stale — they are
 * skipped, and the summary says how many. A gate that read "no survivors" from a run that
 * measured nothing would be worse than no gate.
 *
 * **Collection failure is detection.** The hand-rolled sweep this replaces counted Vitest's
 * collection-time failure (`no tests`) as "no test failed", and mistook three killed mutants
 * per slice for survivors. Stryker reports those as `CompileError` and `RuntimeError`, and
 * only `Survived` counts as undetected here — `NoCoverage` is separated for the reason given
 * on `UNCONFIRMED_STATUSES`. `mutation-survivors.test.ts` pins the whole mapping by name so a
 * future runner or config change cannot quietly reinterpret it.
 */

import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import process from 'node:process'

const root = resolve(import.meta.dirname, '..')
const ledgerPath = resolve(root, 'mutation-survivors.json')
const reportPath = resolve(root, 'reports/mutation/mutation.json')
const artifactDirectory = resolve(root, 'artifacts')
const summaryPath = resolve(artifactDirectory, 'mutation-summary.md')

/**
 * The one status that means "a test ran this mutant and did not notice". Everything else —
 * `Killed`, `Timeout`, `CompileError`, `RuntimeError`, `Ignored` — means the mutant was
 * detected or was never a question, and must not reach the ledger.
 */
export const UNDETECTED_STATUSES = ['Survived'] as const

/**
 * `NoCoverage` is a *claim* rather than a measurement, and in this repository it has been
 * observed to be wrong. Stryker never executes a `NoCoverage` mutant: it reports it from the
 * `perTest` coverage map alone. The empty-capabilities array in `createValchecker` came back
 * `NoCoverage` while `core.test.ts`'s "exposes every registered plugin capability" test kills
 * it outright — applied by hand, that test fails. So these are neither undetected nor
 * detected; they are unconfirmed, and the gate says so instead of demanding a classification
 * for a mutant that may already be dead. Confirm with `--coverageAnalysis off`, which runs
 * every mutant against the whole suite and removes the attribution step entirely.
 */
export const UNCONFIRMED_STATUSES = ['NoCoverage'] as const

export const LEDGER_CLASSIFICATIONS = ['EQUIVALENT', 'UNREACHABLE', 'PRODUCT_DECISION', 'TOOL_ARTIFACT'] as const

/** Written by `--write` and rejected by the gate: triage has not reached this survivor yet. */
export const UNTRIAGED = 'UNKNOWN'

type Classification = (typeof LEDGER_CLASSIFICATIONS)[number] | typeof UNTRIAGED

/**
 * A reason has to carry the argument. These are the words that assert the conclusion instead,
 * and a reason made only of them is refused — the point of the field is that a reader can
 * check the claim without rebuilding it.
 */
const EMPTY_REASONS = new Set(['equivalent', 'unreachable', 'unknown', 'n/a', 'na', 'none', 'tool artifact', 'artifact', 'see above', 'same as above', 'product decision'])

const MINIMUM_REASON_LENGTH = 24

interface ReportMutant {
	mutatorName: string
	replacement: string
	status: string
	statusReason?: string
	location: { start: { line: number, column: number }, end: { line: number, column: number } }
}

interface MutationReport {
	files: Record<string, { source: string, mutants: ReportMutant[] }>
}

export interface LedgerEntry {
	file: string
	/** Informational, refreshed by `--write`: identity is the source text, which does not move. */
	line: number
	mutator: string
	original: string
	replacement: string
	count: number
	classification: Classification
	/** Why the classification holds — the invariant, not the conclusion. */
	reason: string
	/** How it was checked: the run, the experiment, the reference that settles it. */
	evidence: string
}

interface Ledger {
	entries: LedgerEntry[]
}

/**
 * Joins the identity fields. A separator that can appear inside a field would let two
 * different survivors collide into one key, and every field here can contain a space —
 * `original` is arbitrary source text. Written as an escape rather than a literal NUL so
 * the file stays text to git and the character stays visible to a reader.
 */
const SEPARATOR = '\u0000'

/**
 * The identity of a survivor. Deliberately not the line and column: those move whenever
 * anything above them is edited, which would turn every unrelated refactor into a ledger
 * conflict. The mutated source text is stable under that and is also what makes a ledger
 * entry readable in a diff without opening the report.
 */
export function survivorKey(entry: Pick<LedgerEntry, 'file' | 'mutator' | 'original' | 'replacement'>): string {
	return [entry.file, entry.mutator, entry.original, entry.replacement].join(SEPARATOR)
}

/**
 * Extracts the exact source text a mutant replaces. Both lines and columns are 1-based in
 * the mutation-testing report schema, and `end.column` is the column after the last
 * character — reading the columns as 0-based shifts every extract one character left, which
 * is legible enough to look right in a ledger while naming the wrong span.
 */
export function sliceSource(source: string, location: ReportMutant['location']): string {
	const lines = source.split('\n')
	const { start, end } = location
	if (start.line === end.line)
		return (lines[start.line - 1] ?? '').slice(start.column - 1, end.column - 1)

	const first = (lines[start.line - 1] ?? '').slice(start.column - 1)
	const middle = lines.slice(start.line, end.line - 1)
	const last = (lines[end.line - 1] ?? '').slice(0, end.column - 1)
	return [first, ...middle, last].join('\n')
}

/** Collapses a multi-line mutant to one readable line, so the ledger stays diffable. */
function condense(text: string): string {
	const collapsed = text.replace(/\s+/g, ' ')
		.trim()
	return collapsed.length > 160 ? `${collapsed.slice(0, 157)}...` : collapsed
}

export function collectSurvivors(
	report: MutationReport,
	statuses: readonly string[] = UNDETECTED_STATUSES,
): Map<string, LedgerEntry> {
	const survivors = new Map<string, LedgerEntry>()
	for (const [file, { source, mutants }] of Object.entries(report.files)) {
		for (const mutant of mutants) {
			if (!statuses.includes(mutant.status))
				continue
			const entry: LedgerEntry = {
				file,
				line: mutant.location.start.line,
				mutator: mutant.mutatorName,
				original: condense(sliceSource(source, mutant.location)),
				replacement: condense(mutant.replacement),
				count: 1,
				classification: UNTRIAGED,
				reason: '',
				evidence: '',
			}
			const key = survivorKey(entry)
			const existing = survivors.get(key)
			if (existing)
				existing.count++
			else
				survivors.set(key, entry)
		}
	}
	return survivors
}

export interface Suppression {
	file: string
	line: number
	/** The mutator names the directive names, or `['all']`. */
	mutators: string[]
	scope: 'next-line' | 'block'
	reason: string
}

export interface SuppressionProblem {
	suppression: Suppression
	kind: 'stale' | 'unreasoned'
}

/**
 * Stryker's own directive grammar, so what this reads and what the runner obeys cannot drift
 * apart into a suppression that silences mutants while the gate reports it as doing nothing.
 */
const DIRECTIVE = /^\s*\/\/\s?Stryker (disable|restore)(?: (next-line))? ([a-zA-Z, ]+)(?::(.*))?$/

export function collectSuppressions(file: string, source: string): Suppression[] {
	const found: Suppression[] = []
	source.split('\n')
		.forEach((text, index) => {
			const match = DIRECTIVE.exec(text)
			if (match == null || match[1] !== 'disable')
				return
			found.push({
				file,
				line: index + 1,
				mutators: match[3]!.split(',')
					.map(name => name.trim())
					.filter(name => name !== ''),
				scope: match[2] === 'next-line' ? 'next-line' : 'block',
				reason: (match[4] ?? '').trim(),
			})
		})
	return found
}

/**
 * A directive that no longer silences anything is a stale exemption: the construct it argued
 * about was refactored away, and what is left is a comment claiming a decision about code
 * that is not there. Checked the same way, and for the same reason, as a ledger entry whose
 * mutant is now killed.
 *
 * The rule is deliberately weak in one direction and says so: it asks whether the directive
 * still covers *some* ignored mutant, not whether the invariant it names is still true. Only
 * review can decide the second.
 */
export function checkSuppressions(
	report: MutationReport,
	measuredFiles: ReadonlySet<string>,
): { suppressions: Suppression[], problems: SuppressionProblem[] } {
	const suppressions: Suppression[] = []
	const problems: SuppressionProblem[] = []

	for (const [file, { source, mutants }] of Object.entries(report.files)) {
		if (!measuredFiles.has(file))
			continue
		const ignoredLines = new Set(mutants.filter(mutant => mutant.status === 'Ignored')
			.map(mutant => mutant.location.start.line))
		const inFile = collectSuppressions(file, source)
		const restoreLines = source.split('\n')
			.map((text, index) => ({ text, line: index + 1 }))
			.filter(({ text }) => {
				const match = DIRECTIVE.exec(text)
				return match != null && match[1] === 'restore'
			})
			.map(({ line }) => line)

		for (const suppression of inFile) {
			suppressions.push(suppression)
			if (suppression.reason === '' || suppression.reason.length < MINIMUM_REASON_LENGTH || EMPTY_REASONS.has(suppression.reason.toLowerCase()))
				problems.push({ suppression, kind: 'unreasoned' })

			const end = suppression.scope === 'next-line'
				? suppression.line + 1
				: (restoreLines.find(line => line > suppression.line) ?? source.split('\n').length)
			const covers = [...ignoredLines].some(line => line > suppression.line && line <= end)
			if (!covers)
				problems.push({ suppression, kind: 'stale' })
		}
	}

	return { suppressions, problems }
}

function sortEntries(entries: LedgerEntry[]): LedgerEntry[] {
	return [...entries].sort((a, b) =>
		a.file.localeCompare(b.file)
		|| a.mutator.localeCompare(b.mutator)
		|| a.original.localeCompare(b.original)
		|| a.replacement.localeCompare(b.replacement))
}

/**
 * Whether a field carries an argument rather than a label. It cannot tell a true reason from
 * a false one — only that the author wrote something a reader could disagree with.
 */
export function statesSomething(text: string): boolean {
	const trimmed = text.trim()
	return trimmed.length >= MINIMUM_REASON_LENGTH && !EMPTY_REASONS.has(trimmed.toLowerCase())
}

export interface GateResult {
	unexplained: LedgerEntry[]
	stale: LedgerEntry[]
	countMismatches: Array<{ entry: LedgerEntry, actual: number }>
	untriaged: LedgerEntry[]
	invalid: LedgerEntry[]
	orphaned: LedgerEntry[]
	skipped: LedgerEntry[]
	acknowledged: LedgerEntry[]
}

export function evaluate(
	ledger: Ledger,
	survivors: Map<string, LedgerEntry>,
	measuredFiles: ReadonlySet<string>,
	fileExists: (file: string) => boolean,
): GateResult {
	const result: GateResult = {
		unexplained: [],
		stale: [],
		countMismatches: [],
		untriaged: [],
		invalid: [],
		orphaned: [],
		skipped: [],
		acknowledged: [],
	}
	const ledgerByKey = new Map(ledger.entries.map(entry => [survivorKey(entry), entry]))

	for (const entry of ledger.entries) {
		if (!fileExists(entry.file)) {
			result.orphaned.push(entry)
			continue
		}
		if (entry.classification === UNTRIAGED)
			result.untriaged.push(entry)
		else if (!(LEDGER_CLASSIFICATIONS as readonly string[]).includes(entry.classification) || !statesSomething(entry.reason) || !statesSomething(entry.evidence))
			result.invalid.push(entry)

		// A file the run never mutated is not evidence in either direction.
		if (!measuredFiles.has(entry.file)) {
			result.skipped.push(entry)
			continue
		}
		const actual = survivors.get(survivorKey(entry))
		if (actual == null)
			result.stale.push(entry)
		else if (actual.count !== entry.count)
			result.countMismatches.push({ entry, actual: actual.count })
		else
			result.acknowledged.push(entry)
	}

	for (const [key, survivor] of survivors) {
		if (!ledgerByKey.has(key))
			result.unexplained.push(survivor)
	}

	return result
}

function formatEntry(entry: LedgerEntry): string {
	return `  ${entry.file}\n    ${entry.mutator}: \`${entry.original}\` -> \`${entry.replacement}\`${entry.count > 1 ? ` (x${entry.count})` : ''}`
}

function formatSuppression({ suppression, kind }: SuppressionProblem): string {
	return `  ${suppression.file}:${suppression.line}\n    Stryker disable ${suppression.mutators.join(',')} — ${kind === 'stale' ? 'ignores no mutant in this run' : 'states no reason a reader can check'}`
}

function renderSummary(
	survivors: Map<string, LedgerEntry>,
	result: GateResult,
	report: MutationReport,
	suppressions: Suppression[],
): string {
	const mutants = Object.values(report.files)
		.flatMap(file => file.mutants)
	const byStatus = new Map<string, number>()
	for (const mutant of mutants)
		byStatus.set(mutant.status, (byStatus.get(mutant.status) ?? 0) + 1)

	const lines = [
		'# Mutation report',
		'',
		`Mutated files: ${Object.keys(report.files).length}. Mutants: ${mutants.length}.`,
		'',
		'| Status | Mutants |',
		'| --- | --- |',
		...[...byStatus].sort(([a], [b]) => a.localeCompare(b))
			.map(([status, count]) => `| ${status} | ${count} |`),
		'',
		`Survived (executed, unnoticed): ${[...survivors.values()].reduce((total, entry) => total + entry.count, 0)}. ${UNCONFIRMED_STATUSES.join('/')} (never executed, unconfirmed): ${[...collectSurvivors(report, UNCONFIRMED_STATUSES)
			.values()].reduce((total, entry) => total + entry.count, 0)}.`,
		`Ledger: ${result.acknowledged.length} acknowledged, ${result.unexplained.length} unexplained, ${result.stale.length} stale, ${result.untriaged.length} ${UNTRIAGED}, ${result.skipped.length} not measured by this run.`,
		`In-source suppressions covering a structural pattern: ${suppressions.length}.`,
	]

	if (result.unexplained.length > 0) {
		lines.push('', '## Unexplained survivors', '')
		for (const entry of sortEntries(result.unexplained))
			lines.push(`- \`${entry.file}:${entry.line}\` — ${entry.mutator}: \`${entry.original}\` -> \`${entry.replacement}\`${entry.count > 1 ? ` (x${entry.count})` : ''}`)
	}
	if (result.acknowledged.length > 0) {
		lines.push('', '## Acknowledged survivors', '')
		for (const entry of sortEntries(result.acknowledged))
			lines.push(`- \`${entry.file}:${entry.line}\` — ${entry.mutator} — **${entry.classification}**: ${entry.reason} _(checked: ${entry.evidence})_`)
	}
	if (suppressions.length > 0) {
		lines.push('', '## In-source suppressions', '')
		for (const suppression of [...suppressions].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line))
			lines.push(`- \`${suppression.file}:${suppression.line}\` — ${suppression.mutators.join(', ')}: ${suppression.reason}`)
	}

	return `${lines.join('\n')}\n`
}

async function main(): Promise<void> {
	if (!existsSync(reportPath)) {
		console.error(`No mutation report at ${relative(root, reportPath)}. Run \`pnpm mutation\` or \`pnpm mutation:changed\` first.`)
		process.exitCode = 1
		return
	}

	const report = JSON.parse(await readFile(reportPath, 'utf8')) as MutationReport
	const survivors = collectSurvivors(report)
	const measuredFiles = new Set(Object.keys(report.files))
	const ledger: Ledger = existsSync(ledgerPath)
		? JSON.parse(await readFile(ledgerPath, 'utf8')) as Ledger
		: { entries: [] }

	if (process.argv.includes('--write')) {
		const ledgerByKey = new Map(ledger.entries.map(entry => [survivorKey(entry), entry]))
		const kept = ledger.entries.filter(entry =>
			// Entries for files this run did not measure are carried over untouched; entries
			// for files it did measure survive only if their mutant survived again.
			!measuredFiles.has(entry.file) || survivors.has(survivorKey(entry)))
		const added = [...survivors].filter(([key]) => !ledgerByKey.has(key))
			.map(([, entry]) => entry)
		const next: Ledger = {
			entries: sortEntries([...kept, ...added].map(entry => ({
				...entry,
				count: survivors.get(survivorKey(entry))?.count ?? entry.count,
			}))),
		}
		await writeFile(ledgerPath, `${JSON.stringify(next, null, '\t')}\n`)
		console.log(`Updated ${relative(root, ledgerPath)}: ${kept.length} kept, ${added.length} added, ${ledger.entries.length - kept.length} removed.`)
		if (added.length > 0) {
			console.log(
				`New entries are recorded as ${UNTRIAGED}, which the gate rejects. Triage each one — TEST_GAP,\n`
				+ `${LEDGER_CLASSIFICATIONS.join(', ')} — then close the gaps with tests and give the rest a reason\n`
				+ 'and the evidence you checked it against. Do not classify a batch by its neighbours.',
			)
		}
		return
	}

	const result = evaluate(ledger, survivors, measuredFiles, file => existsSync(resolve(root, file)))
	const { suppressions, problems } = checkSuppressions(report, measuredFiles)
	const unconfirmed = collectSurvivors(report, UNCONFIRMED_STATUSES)

	await mkdir(artifactDirectory, { recursive: true })
	await writeFile(summaryPath, renderSummary(survivors, result, report, suppressions))

	const failures: string[] = []
	if (unconfirmed.size > 0) {
		failures.push([
			`${unconfirmed.size} mutant(s) were reported ${UNCONFIRMED_STATUSES.join('/')} and never executed:`,
			...sortEntries([...unconfirmed.values()])
				.map(formatEntry),
			'',
			'This is a claim from the coverage map, not a measurement, and it has been wrong here before:',
			'the empty-capabilities array in `createValchecker` was reported NoCoverage while a test in',
			'`core.test.ts` kills it. Confirm before classifying anything —',
			'  npx stryker run --coverageAnalysis off --mutate <file>',
			'runs every mutant against the whole suite and removes the attribution step. Only what still',
			'survives that run is a survivor.',
		].join('\n'))
	}
	if (result.unexplained.length > 0) {
		failures.push([
			`${result.unexplained.length} mutant(s) survived with nothing in the repository noticing:`,
			...sortEntries(result.unexplained)
				.map(formatEntry),
			'',
			'Triage each one on its own before recording anything. Classify it TEST_GAP, EQUIVALENT,',
			'UNREACHABLE, PRODUCT_DECISION or TOOL_ARTIFACT — and assume TEST_GAP until shown otherwise,',
			'because about four fifths of the ones triaged in #135 were. A test gap is closed by the',
			'smallest assertion at the layer that owns the contract, proved by watching it fail under the',
			'mutation and pass without it. Only what survives that goes on record: a structural pattern',
			'whose equivalence follows from one invariant belongs in a `// Stryker disable … : <why>`',
			'directive beside the code, and everything else in the ledger via `pnpm mutation:survivors:update`.',
			'Never classify a survivor because its neighbours were classified.',
		].join('\n'))
	}
	if (result.untriaged.length > 0) {
		failures.push([
			`${result.untriaged.length} ledger entr(ies) are still ${UNTRIAGED}:`,
			...sortEntries(result.untriaged)
				.map(formatEntry),
			'',
			`Set classification to one of ${LEDGER_CLASSIFICATIONS.join(', ')}, write the invariant that makes it hold, and record how you checked it.`,
		].join('\n'))
	}
	if (result.invalid.length > 0) {
		failures.push([
			`${result.invalid.length} ledger entr(ies) have an unknown classification, or a reason or evidence that states nothing:`,
			...sortEntries(result.invalid)
				.map(formatEntry),
			'',
			'`reason` has to give the invariant rather than repeat the classification, and `evidence` has to say',
			'how it was checked. Both are what let a reader disagree without redoing the triage.',
		].join('\n'))
	}
	if (problems.length > 0) {
		failures.push([
			`${problems.length} in-source Stryker suppression(s) no longer hold up:`,
			...problems.map(formatSuppression),
			'',
			'A directive that ignores nothing outlived the code it argued about — delete it. One without a',
			'reason a reader can check is a silent exclusion wearing a comment.',
		].join('\n'))
	}
	if (result.stale.length > 0) {
		failures.push([
			`${result.stale.length} ledger entr(ies) name a mutant that is now killed:`,
			...sortEntries(result.stale)
				.map(formatEntry),
			'',
			'Delete them. The ledger has to shrink as the tests improve, or it becomes a place findings go to be forgotten.',
		].join('\n'))
	}
	if (result.countMismatches.length > 0) {
		failures.push([
			`${result.countMismatches.length} ledger entr(ies) no longer match how many identical mutants survive:`,
			...result.countMismatches.map(({ entry, actual }) => `${formatEntry(entry)}\n    ledger says ${entry.count}, run measured ${actual}`),
		].join('\n'))
	}
	if (result.orphaned.length > 0) {
		failures.push([
			`${result.orphaned.length} ledger entr(ies) name a file that no longer exists:`,
			...sortEntries(result.orphaned)
				.map(formatEntry),
		].join('\n'))
	}

	if (failures.length > 0) {
		console.error(`${failures.join('\n\n')}\n\nSummary written to ${relative(root, summaryPath)}.`)
		process.exitCode = 1
		return
	}

	const total = [...survivors.values()].reduce((sum, entry) => sum + entry.count, 0)
	console.log(
		`Mutation gate passed: ${measuredFiles.size} file(s) measured, ${total} undetected mutant(s), all classified, `
		+ `${suppressions.length} in-source suppression(s) still covering something.${
			result.skipped.length > 0 ? ` ${result.skipped.length} ledger entr(ies) belong to files this run did not measure and were left untouched.` : ''}`,
	)
}

if (process.argv[1] != null && import.meta.url === `file://${process.argv[1]}`) {
	await mkdir(dirname(summaryPath), { recursive: true })
	await main()
}
