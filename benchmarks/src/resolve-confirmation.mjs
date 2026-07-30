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
import { confirmationSelection, renderConfirmationMarkdown, resolveConfirmation } from './confirmation.mjs'

const benchmarkRoot = fileURLToPath(new URL('..', import.meta.url))

function parseArguments(argv) {
	const options = { screen: null, confirm: null, select: false, markdown: null, json: null, failOnRegression: false }
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
		else if (argument === '--select') {
			options.select = true
		}
		else if (argument === '--fail-on-regression') {
			options.failOnRegression = true
		}
		else {
			throw new Error(`Unknown or incomplete argument: ${argument}`)
		}
	}
	if (options.screen == null)
		throw new Error('--screen <impact.json> is required: it is the first stage\'s comparison')
	if (options.select && options.confirm != null)
		throw new Error('--select prints the cells to confirm; it does not take a confirmation comparison')
	return options
}

const options = parseArguments(process.argv.slice(2))
// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM entry script executed to completion at load
const screen = JSON.parse(await readFile(options.screen, 'utf8'))

if (options.select) {
	// Stdout is the list and nothing else, so the caller can read it into a shell variable.
	// The count goes to stderr, where the log wants it.
	const selection = confirmationSelection(screen)
	process.stdout.write(selection.map(entry => entry.scenario)
		.join(','))
	console.error(`[confirm] ${selection.length} cell${selection.length === 1 ? '' : 's'} need an independent second batch`)
}
else {
	const confirm = options.confirm == null
		? null
		// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM entry script executed to completion at load
		: JSON.parse(await readFile(options.confirm, 'utf8'))
	const result = resolveConfirmation(screen, confirm)
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
	console.error(`[confirm] verdict ${result.verdict} (screen ${result.screenVerdict}): `
		+ `${result.reproduced.length} reproduced, ${result.notReproduced.length} not reproduced, ${result.unresolved.length} unresolved`)
	// Why, not just what. A job whose log ends in a one-line summary and `ELIFECYCLE` sends its
	// reader to an artifact to find out which cell failed the build, and the first real run of
	// this stage was misread as a wiring fault for exactly that reason. The rows that decided
	// are printed where the failure is.
	for (const row of result.rows.filter(candidate => result.blocking.includes(candidate.scenario))) {
		console.error(`[confirm] blocking: ${row.scenario} — screen ${row.screen} ${(row.screenDelta * 100).toFixed(2)}%, `
			+ `confirm ${row.confirm ?? 'not measured'}${row.confirmDelta == null ? '' : ` ${(row.confirmDelta * 100).toFixed(2)}%`}`)
	}
	for (const row of result.rows.filter(candidate => result.unresolved.includes(candidate.scenario))) {
		console.error(`[confirm] unresolved: ${row.scenario} — screen ${row.screen} ${(row.screenDelta * 100).toFixed(2)}%, `
			+ `confirm ${row.confirm ?? 'not measured'}${row.confirmDelta == null ? '' : ` ${(row.confirmDelta * 100).toFixed(2)}%`}`)
	}
	for (const record of result.acknowledged)
		console.error(`[confirm] accepted regression: ${record.cell} — measured -${record.depthPercent.toFixed(2)}%, accepted to -${record.bound}%`)
	for (const problem of result.acknowledgementProblems)
		console.error(`[confirm] accepted-regression list: ${problem}`)
	if (result.severeGroups.length > 0)
		console.error(`[confirm] severe group${result.severeGroups.length === 1 ? '' : 's'} from the screen, not confirmed here: ${result.severeGroups.join(', ')}`)
	if (options.failOnRegression && result.verdict === 'regression')
		process.exitCode = 1
}
