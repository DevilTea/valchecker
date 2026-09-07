// The confirmation stage's entry point: arguments, files, exit code. The decision itself is
// in `confirmation.mjs`, where a test can drive every screen/confirm combination without a
// filesystem.
//
// Two modes, because the workflow needs the stage in two pieces:
//
//   --select            print the cells the confirmation batch must measure, as one
//                       comma-separated list, so the measuring job can be given `--cells`;
//   --confirm <file>    resolve the screen against the confirmation comparison, write the
//                       report, and set the exit code.
//
// Like `compare.mjs`, this loads no build: both inputs are `impact.json` files.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { acceptedGroupRegressionsForBase, acceptedRegressionsForBase } from './accepted-regressions.mjs'
import { baselineCommitOf, confirmationPlan, planSummaryLines, renderConfirmationMarkdown, resolveConfirmation } from './confirmation.mjs'

const benchmarkRoot = fileURLToPath(new URL('..', import.meta.url))

function parseArguments(argv) {
	const options = { screen: null, confirm: null, groupConfirm: [], plan: false, markdown: null, json: null, failOnRegression: false, requireResolved: false }
	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index]
		const value = argv[index + 1]
		if (argument === '--screen' && value) {
			options.screen = resolve(benchmarkRoot, value)
			index++
		}
		else if (argument === '--confirm' && value) {
			options.confirm = resolve(benchmarkRoot, value)
			index++
		}
		else if (argument === '--markdown' && value) {
			options.markdown = resolve(benchmarkRoot, value)
			index++
		}
		else if (argument === '--json' && value) {
			options.json = resolve(benchmarkRoot, value)
			index++
		}
		else if (argument === '--group-confirm' && value) {
			// `<group>=<path>`: one comparison per group, because group confirmation is scheduled
			// independently of row confirmation and of every other group's.
			const separator = value.indexOf('=')
			if (separator < 1)
				throw new Error(`--group-confirm takes <group>=<path>, received '${value}'`)
			options.groupConfirm.push({ group: value.slice(0, separator), path: resolve(benchmarkRoot, value.slice(separator + 1)) })
			index++
		}
		else if (argument === '--plan') {
			options.plan = true
		}
		else if (argument === '--fail-on-regression') {
			options.failOnRegression = true
		}
		else if (argument === '--require-resolved') {
			options.requireResolved = true
		}
		else {
			throw new Error(`Unknown or incomplete argument: ${argument}`)
		}
	}
	if (options.screen == null)
		throw new Error('--screen <impact.json> is required: it is the first stage\'s comparison')
	if (options.plan && options.confirm != null)
		throw new Error('--plan prints the batch to measure; it does not take a confirmation comparison')
	return options
}

const options = parseArguments(process.argv.slice(2))
// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM entry script executed to completion at load
const screen = JSON.parse(await readFile(options.screen, 'utf8'))

if (options.plan) {
	// Stdout is the whole plan as JSON and nothing else, so the workflow reads `batches` — the
	// unit it schedules — rather than a hand-picked subset that can drift from it. It drifted:
	// this branch emitted `{ cells, shardCount }` after the planner had moved to independent
	// batches, so even past the `TypeError` the next step would have read an undefined `batches`.
	const baseCommit = baselineCommitOf(screen)
	const acknowledgedGroups = new Set(acceptedGroupRegressionsForBase(baseCommit)
		.map(entry => entry.group))
	const acknowledgedCells = new Set(acceptedRegressionsForBase(baseCommit)
		.map(entry => entry.cell))
	// The repetition count the screen actually used, not the planner's default. `workflow_dispatch`
	// accepts a `runs` other than five and `confirm-measure` executes that same number, so a
	// default of five would price a different job than the one scheduled: 100 cells is about
	// 40.8 min at five repetitions and is admitted, while the same dispatch at ten needs about
	// 79.7 min by this model — past the job's own timeout, admitted on arithmetic that never
	// applied to it.
	const repetitions = screen.runCounts?.baseline
	if (!Number.isInteger(repetitions) || repetitions < 1)
		throw new Error(`The screen comparison records no usable repetition count (${String(repetitions)}), so the confirmation batch cannot be priced`)
	if (screen.runCounts.candidate !== repetitions) {
		throw new Error(
			`The screen comparison measured ${repetitions} baseline repetitions and ${String(screen.runCounts.candidate)} candidate ones. `
			+ 'The confirmation batch measures both sides the same number of times, so there is no single count to price it with.',
		)
	}
	const plan = confirmationPlan(screen, { acknowledgedGroups, acknowledgedCells, repetitions })
	process.stdout.write(JSON.stringify(plan))
	for (const line of planSummaryLines(plan))
		console.error(line)
}
else {
	const confirm = options.confirm == null
		? null
		// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM entry script executed to completion at load
		: JSON.parse(await readFile(options.confirm, 'utf8'))
	// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM entry script executed to completion at load
	const groupConfirmations = Object.fromEntries(await Promise.all(options.groupConfirm.map(async entry => [
		entry.group,
		JSON.parse(await readFile(entry.path, 'utf8')),
	])))
	const result = resolveConfirmation(screen, confirm, { groupConfirmations })
	if (options.markdown != null) {
		// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM entry script executed to completion at load
		await mkdir(dirname(options.markdown), { recursive: true })
		// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM entry script executed to completion at load
		await writeFile(options.markdown, renderConfirmationMarkdown(result))
	}
	if (options.json != null) {
		// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM entry script executed to completion at load
		await mkdir(dirname(options.json), { recursive: true })
		// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM entry script executed to completion at load
		await writeFile(options.json, `${JSON.stringify(result, null, 2)}\n`)
	}
	const boundaryUnresolvedCount = result.boundaryUnresolved?.length ?? 0
	console.error(`[confirm] verdict ${result.verdict} (screen ${result.screenVerdict}): `
		+ `${result.reproduced.length} reproduced, ${result.notReproduced.length} not reproduced, ${result.unresolved.length} unresolved (severe), ${boundaryUnresolvedCount} boundary unresolved`)
	// Why, not just what. A job whose log ends in a one-line summary and `ELIFECYCLE` sends its
	// reader to an artifact to find out which cell failed the build, and the first real run of
	// this stage was misread as a wiring fault for exactly that reason. The rows that decided
	// are printed where the failure is.
	for (const row of result.rows.filter(candidate => result.blocking.includes(candidate.scenario))) {
		console.error(`[confirm] blocking: ${row.scenario} — screen ${row.screen} ${(row.screenDelta * 100).toFixed(2)}%, `
			+ `confirm ${row.confirm ?? 'not measured'}${row.confirmDelta == null ? '' : ` ${(row.confirmDelta * 100).toFixed(2)}%`}`)
	}
	for (const row of result.rows.filter(candidate => result.unresolved.includes(candidate.scenario))) {
		console.error(`[confirm] unresolved (severe): ${row.scenario} — screen ${row.screen} ${(row.screenDelta * 100).toFixed(2)}%, `
			+ `confirm ${row.confirm ?? 'not measured'}${row.confirmDelta == null ? '' : ` ${(row.confirmDelta * 100).toFixed(2)}%`}`)
	}
	for (const row of result.rows.filter(candidate => result.boundaryUnresolved?.includes(candidate.scenario))) {
		console.error(`[confirm] boundary unresolved: ${row.scenario} — screen ${row.screen} ${(row.screenDelta * 100).toFixed(2)}%, `
			+ `confirm ${row.confirm ?? 'not measured'}${row.confirmDelta == null ? '' : ` ${(row.confirmDelta * 100).toFixed(2)}%`}`)
	}
	for (const record of result.acknowledged)
		console.error(`[confirm] accepted regression: ${record.cell} — measured -${record.depthPercent.toFixed(2)}%, accepted to -${record.bound}%`)
	for (const record of result.inactiveAcknowledgements ?? []) {
		const target = record.type === 'cell' ? record.cell : `group ${record.group}`
		console.error(`[confirm] inactive acknowledgement (${target}): pinned to base ${record.baseCommit ? record.baseCommit.slice(0, 7) : 'n/a'} — not active for this run`)
	}
	for (const problem of result.acknowledgementProblems)
		console.error(`[confirm] accepted-regression list: ${problem}`)
	for (const problem of result.unassessedAcknowledgements)
		console.error(`[confirm] rot check not assessed: ${problem}`)
	for (const verdict of result.groupVerdicts)
		console.error(`[confirm] group ${verdict.group}: ${verdict.blocking ? 'BLOCKING' : 'review'} — ${verdict.why}`)
	for (const record of result.acknowledgedGroups)
		console.error(`[confirm] accepted group regression: ${record.group} — measured -${record.depthPercent.toFixed(2)}%, accepted to -${record.bound}%`)
	if (result.unacknowledgedSevereGroups.length > 0) {
		console.error(`[confirm] severe group${result.unacknowledgedSevereGroups.length === 1 ? '' : 's'} from the screen, not confirmed here: ${
			result.unacknowledgedSevereGroups.join(', ')}`)
	}
	if (options.failOnRegression && result.verdict === 'regression') {
		process.exitCode = 1
	}
	else if (options.requireResolved && (result.verdict === 'unresolved' || result.verdict === 'inconclusive')) {
		console.error(`[confirm] required check has no resolved answer: ${result.verdict}`)
		process.exitCode = 2
	}
}
