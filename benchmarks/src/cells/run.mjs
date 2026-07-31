/**
 * One side of a Performance Impact comparison: every selected cell, one process each,
 * written as the same `raw.json` shape a scenario run writes.
 *
 * Keeping the shape is what makes this a change of *unit* rather than a second gate.
 * `impact-verdict.mjs`, `comparability.mjs`, `sharding.mjs`, and `merge.mjs` read a cell
 * run with no knowledge that its rows are cells, so the classification, the group
 * aggregates, the identity guards, and the shard merge are the ones already tested.
 *
 * Cell definitions come from the **checked-out ref only**. The measuring apparatus has
 * always been fixed while `before` and `after` are two builds it points at, and cells are
 * part of the apparatus: if each side read its own definitions, an author editing a bench
 * file would be editing the measurement, and `inert-change.ts` cannot see that. The cost
 * is that a cell which cannot execute against the baseline build — a new step's, most
 * often — has no baseline number. It is reported as **unmeasurable**, by name, rather
 * than dropped.
 */

import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { versionOfModule } from '../adapters/installed-version.mjs'
import { getProfile } from '../measure.mjs'
import { assertShardSelector, selectShardScenarios } from '../sharding.mjs'
import { buildCellCatalog } from './catalog-artifact.mjs'
import { cellCatalog, collectStepBenches } from './collect.mjs'

const benchmarkRoot = fileURLToPath(new URL('../..', import.meta.url))
const workerPath = fileURLToPath(new URL('./worker.mjs', import.meta.url))

function parseArguments(argv) {
	const options = {
		mode: 'standard',
		output: resolve(benchmarkRoot, 'results/cells.json'),
		// Where to persist the catalog this run measured against. Written by the measuring
		// job so that `compare` reads a file instead of re-collecting cells through the
		// loader that points at the build under test.
		catalogOutput: null,
		cells: [],
		shardIndex: 0,
		shardCount: 1,
		seed: process.env.BENCHMARK_SEED ?? String(Date.now()),
	}
	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index]
		const value = argv[index + 1]
		if (argument === '--mode' && value) {
			options.mode = value
			index++
		}
		else if (argument === '--output' && value) {
			options.output = resolve(benchmarkRoot, value)
			index++
		}
		else if (argument === '--catalog-output' && value) {
			options.catalogOutput = resolve(benchmarkRoot, value)
			index++
		}
		else if (argument === '--cells' && value) {
			options.cells = value.split(',')
				.map(cell => cell.trim())
				.filter(Boolean)
			index++
		}
		else if (argument === '--seed' && value) {
			options.seed = value
			index++
		}
		else if (argument === '--shard-index' && value) {
			options.shardIndex = Number(value)
			index++
		}
		else if (argument === '--shard-count' && value) {
			options.shardCount = Number(value)
			index++
		}
		else {
			throw new Error(`Unknown or incomplete argument: ${argument}`)
		}
	}
	getProfile(options.mode)
	assertShardSelector(options.shardIndex, options.shardCount)
	return options
}

function runWorker(cellId, mode) {
	return new Promise((resolvePromise, reject) => {
		const child = spawn(process.execPath, [workerPath, cellId, mode], {
			cwd: benchmarkRoot,
			env: process.env,
			stdio: ['ignore', 'pipe', 'pipe'],
		})
		let stdout = ''
		let stderr = ''
		child.stdout.setEncoding('utf8')
		child.stderr.setEncoding('utf8')
		child.stdout.on('data', chunk => stdout += chunk)
		child.stderr.on('data', chunk => stderr += chunk)
		child.once('error', reject)
		child.once('exit', (code, signal) => {
			if (code !== 0) {
				reject(new Error(`The worker for ${cellId} failed with ${signal ?? code}:\n${stderr || stdout}`))
				return
			}
			try {
				resolvePromise(JSON.parse(stdout))
			}
			catch (error) {
				reject(new Error(`The worker for ${cellId} returned invalid JSON:\n${stdout}\n${stderr}`, { cause: error }))
			}
		})
	})
}

async function main() {
	const options = parseArguments(process.argv.slice(2))
	const catalog = cellCatalog(await collectStepBenches())
	// The catalog this run measured against, as data. Its hash goes into the result so that
	// merge, the identity guard, and compare can all check that they are talking about one
	// cell set; the file it is written to is what compare reads instead of collecting cells
	// itself. Both come from the same collection, so the hash cannot describe a different
	// catalog than the file.
	const artifact = buildCellCatalog(catalog)
	const known = new Map(catalog.map(cell => [cell.id, cell]))

	// A selection naming a cell this ref does not declare is a mistake worth failing on
	// rather than silently measuring less: the selector and the cells come from the same
	// checked-out tree, so they cannot legitimately disagree.
	const missing = options.cells.filter(id => !known.has(id))
	if (missing.length > 0)
		throw new Error(`No such cell: ${missing.join(', ')}`)

	const selected = options.cells.length > 0 ? options.cells.map(id => known.get(id)) : catalog
	const shardCells = selectShardScenarios(selected, options.shardIndex, options.shardCount)
	if (shardCells.length === 0)
		throw new Error(`Shard ${options.shardIndex} of ${options.shardCount} has no cells; use a shard count no larger than the ${selected.length} selected cells`)

	const startedAt = new Date()
		.toISOString()
	const results = []
	const unmeasurable = []
	for (const [position, cell] of shardCells.entries()) {
		console.error(`[cells] [${position + 1}/${shardCells.length}] ${cell.id}`)
		const payload = await runWorker(cell.id, options.mode)
		if (payload.unmeasurable != null)
			unmeasurable.push({ cell: cell.id, reason: payload.unmeasurable })
		else
			results.push(payload.result)
	}
	const completedAt = new Date()
		.toISOString()

	// Named, not counted. A cell that cannot execute against the build under test is a fact
	// about that build, and the reader has to be able to see which cell and why.
	for (const entry of unmeasurable)
		console.error(`[cells] unmeasurable against this build: ${entry.cell} — ${entry.reason}`)

	const environment = {
		node: process.version,
		platform: process.platform,
		arch: process.arch,
		cpu: os.cpus()[0]?.model ?? 'unknown',
		logicalCpuCount: os.cpus().length,
		totalMemoryBytes: os.totalmem(),
		commit: process.env.BENCHMARK_COMMIT ?? process.env.GITHUB_SHA ?? null,
		runnerName: process.env.RUNNER_NAME ?? null,
		runnerImageOS: process.env.ImageOS ?? null,
		runnerImageVersion: process.env.ImageVersion ?? null,
	}
	const result = {
		schemaVersion: 4,
		mode: options.mode,
		seed: options.seed,
		// The identity `comparability.mjs` compares. `null` is the whole cell set and is
		// deliberately not the same value as a filter that happens to name every cell in it.
		scenarioFilter: options.cells.length > 0 ? options.cells : null,
		// One process per cell, which is what the field has always meant.
		isolation: 'cell',
		// Which cell set this run measured against, so a result can be paired only with
		// another measured from the same catalog. `comparability.mjs` carries it in the
		// measurement identity and `merge` refuses shards that disagree.
		cellCatalogHash: artifact.catalogHash,
		startedAt,
		completedAt,
		profile: getProfile(options.mode),
		environment,
		// The cells this shard was **assigned**, measurable or not. The catalog is the run
		// order — `interleaveShards` inverts `p % count` from it — so dropping a cell that
		// could not execute against this build would renumber every cell after it and give
		// `merge` shard sizes positional round-robin cannot produce. A cell with no number is
		// recorded below the way the cross-library runner records an adapter it had to skip:
		// present in the catalog, absent from the results, named with its reason.
		shards: [{
			index: options.shardIndex,
			count: options.shardCount,
			scenarios: shardCells.map(cell => cell.id),
			startedAt,
			completedAt,
			environment,
		}],
		order: ['valchecker'],
		scenarioCatalog: shardCells.map(cell => ({ id: cell.id, group: cell.group, steps: cell.steps })),
		unmeasurableCells: unmeasurable,
		libraries: [{
			adapter: 'valchecker',
			name: 'Valchecker',
			version: versionOfModule(process.env.VALCHECKER_DIST_URL ?? new URL('../../../packages/valchecker/dist/index.mjs', import.meta.url).href),
			capabilities: {},
			verifiedScenarios: results.length,
			totalScenarios: shardCells.length,
			skippedScenarios: unmeasurable.map(entry => ({ scenario: entry.cell, reason: entry.reason })),
			results,
		}],
	}

	await mkdir(dirname(options.output), { recursive: true })
	await writeFile(options.output, `${JSON.stringify(result, null, 2)}\n`)
	console.error(`[cells] wrote ${options.output}: ${results.length} measured, ${unmeasurable.length} unmeasurable`)

	if (options.catalogOutput != null) {
		await mkdir(dirname(options.catalogOutput), { recursive: true })
		await writeFile(options.catalogOutput, `${JSON.stringify(artifact, null, 2)}\n`)
		console.error(`[cells] wrote ${options.catalogOutput}: ${artifact.cells.length} cells, catalog ${artifact.catalogHash}`)
	}
}

// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM entry script executed to completion at load
await main()
