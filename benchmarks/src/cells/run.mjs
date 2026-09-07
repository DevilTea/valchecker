/**
 * Performance Impact cell runner.
 *
 * The ordinary mode measures one side. Paired mode measures both builds in one process
 * orchestrator, but still gives every observation its own worker process: for each cell the
 * baseline/candidate workers are adjacent, and repetition parity reverses their order. The
 * two outputs keep the existing raw result shape, so merge/compare remain the one downstream
 * implementation of sharding and verdict semantics.
 */

import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { versionOfModule } from '../adapters/installed-version.mjs'
import { getProfile } from '../measure.mjs'
import { assertShardSelector, selectShardScenarios } from '../sharding.mjs'
import { buildCellCatalog } from './catalog-artifact.mjs'
import { pairedCellRuns } from './pairing.mjs'

const benchmarkRoot = fileURLToPath(new URL('../..', import.meta.url))
const workerPath = fileURLToPath(new URL('./worker.mjs', import.meta.url))

function parseArguments(argv) {
	const options = {
		mode: 'standard',
		output: resolve(benchmarkRoot, 'results/cells.json'),
		catalogOutput: null,
		cells: [],
		shardIndex: 0,
		shardCount: 1,
		seed: process.env.BENCHMARK_SEED ?? String(Date.now()),
		baselineDist: null,
		candidateDist: null,
		baselineOutput: null,
		candidateOutput: null,
		baselineSha: null,
		candidateSha: null,
		repetition: null,
		selectionRoles: null,
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
		else if (argument === '--selection-roles' && value) {
			options.selectionRoles = resolve(benchmarkRoot, value)
			index++
		}
		else if (argument === '--baseline-dist' && value) {
			options.baselineDist = value
			index++
		}
		else if (argument === '--candidate-dist' && value) {
			options.candidateDist = value
			index++
		}
		else if (argument === '--baseline-output' && value) {
			options.baselineOutput = resolve(benchmarkRoot, value)
			index++
		}
		else if (argument === '--candidate-output' && value) {
			options.candidateOutput = resolve(benchmarkRoot, value)
			index++
		}
		else if (argument === '--baseline-sha' && value) {
			options.baselineSha = value
			index++
		}
		else if (argument === '--candidate-sha' && value) {
			options.candidateSha = value
			index++
		}
		else if (argument === '--repetition' && value) {
			options.repetition = Number(value)
			index++
		}
		else {
			throw new Error(`Unknown or incomplete argument: ${argument}`)
		}
	}
	getProfile(options.mode)
	assertShardSelector(options.shardIndex, options.shardCount)

	const pairedValues = [
		options.baselineDist,
		options.candidateDist,
		options.baselineOutput,
		options.candidateOutput,
		options.baselineSha,
		options.candidateSha,
		options.repetition,
	]
	const paired = pairedValues.some(value => value != null)
	if (paired && pairedValues.some(value => value == null)) {
		throw new Error(
			'Paired cell measurement requires --baseline-dist, --candidate-dist, --baseline-output, --candidate-output, '
			+ '--baseline-sha, --candidate-sha, and --repetition together.',
		)
	}
	if (paired && (!Number.isSafeInteger(options.repetition) || options.repetition < 1))
		throw new TypeError(`--repetition must be a positive safe integer; received ${String(options.repetition)}`)
	return { ...options, paired }
}

function runWorker(cellId, mode, environment = process.env) {
	return new Promise((resolvePromise, reject) => {
		const child = spawn(process.execPath, [workerPath, cellId, mode], {
			cwd: benchmarkRoot,
			env: environment,
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

function machineEnvironment(commit) {
	return {
		node: process.version,
		platform: process.platform,
		arch: process.arch,
		cpu: os.cpus()[0]?.model ?? 'unknown',
		logicalCpuCount: os.cpus().length,
		totalMemoryBytes: os.totalmem(),
		commit,
		runnerName: process.env.RUNNER_NAME ?? null,
		runnerImageOS: process.env.ImageOS ?? null,
		runnerImageVersion: process.env.ImageVersion ?? null,
	}
}

function rawResult({ options, artifact, shardCells, side, dist, commit, state, pairing, scenarioRoles }) {
	const environment = machineEnvironment(commit)
	return {
		schemaVersion: 5,
		mode: options.mode,
		seed: side == null ? options.seed : `${options.seed}-${options.repetition}-${side}`,
		scenarioFilter: options.cells.length > 0 ? options.cells : null,
		isolation: 'cell',
		temporalPairing: pairing,
		scenarioRoles,
		cellCatalogHash: artifact.catalogHash,
		startedAt: state.startedAt,
		completedAt: state.completedAt,
		profile: getProfile(options.mode),
		environment,
		shards: [{
			index: options.shardIndex,
			count: options.shardCount,
			scenarios: shardCells.map(cell => cell.id),
			startedAt: state.startedAt,
			completedAt: state.completedAt,
			environment,
		}],
		order: ['valchecker'],
		scenarioCatalog: shardCells.map(cell => ({ id: cell.id, group: cell.group, steps: cell.steps })),
		unmeasurableCells: state.unmeasurable,
		libraries: [{
			adapter: 'valchecker',
			name: 'Valchecker',
			version: versionOfModule(dist),
			capabilities: {},
			verifiedScenarios: state.results.length,
			totalScenarios: shardCells.length,
			skippedScenarios: state.unmeasurable.map(entry => ({ scenario: entry.cell, reason: entry.reason })),
			results: state.results,
		}],
	}
}

async function writeRaw(path, result) {
	await mkdir(dirname(path), { recursive: true })
	await writeFile(path, `${JSON.stringify(result, null, 2)}\n`)
}

function selectionOf(options, catalog) {
	const known = new Map(catalog.map(cell => [cell.id, cell]))
	const missing = options.cells.filter(id => !known.has(id))
	if (missing.length > 0)
		throw new Error(`No such cell: ${missing.join(', ')}`)
	const selected = options.cells.length > 0 ? options.cells.map(id => known.get(id)) : catalog
	const shardCells = selectShardScenarios(selected, options.shardIndex, options.shardCount)
	if (shardCells.length === 0) {
		throw new Error(
			`Shard ${options.shardIndex} of ${options.shardCount} has no cells; `
			+ `use a shard count no larger than the ${selected.length} selected cells`,
		)
	}
	return shardCells
}

function emptySide() {
	return { startedAt: null, completedAt: null, results: [], unmeasurable: [] }
}

function recordPayload(state, cell, payload) {
	if (payload.unmeasurable != null)
		state.unmeasurable.push({ cell: cell.id, reason: payload.unmeasurable })
	else
		state.results.push(payload.result)
}

async function runSingle(options, artifact, shardCells, scenarioRoles) {
	const state = emptySide()
	state.startedAt = new Date()
		.toISOString()
	for (const [position, cell] of shardCells.entries()) {
		console.error(`[cells] [${position + 1}/${shardCells.length}] ${cell.id}`)
		recordPayload(state, cell, await runWorker(cell.id, options.mode))
	}
	state.completedAt = new Date()
		.toISOString()
	const dist = process.env.VALCHECKER_DIST_URL ?? new URL('../../../packages/valchecker/dist/index.mjs', import.meta.url).href
	const commit = process.env.BENCHMARK_COMMIT ?? process.env.GITHUB_SHA ?? null
	for (const entry of state.unmeasurable)
		console.error(`[cells] unmeasurable against this build: ${entry.cell} — ${entry.reason}`)
	await writeRaw(options.output, rawResult({ options, artifact, shardCells, side: null, dist, commit, state, pairing: 'none', scenarioRoles }))
	console.error(`[cells] wrote ${options.output}: ${state.results.length} measured, ${state.unmeasurable.length} unmeasurable`)
}

async function runPaired(options, artifact, shardCells, scenarioRoles) {
	const sides = {
		baseline: { ...emptySide(), dist: options.baselineDist, commit: options.baselineSha, output: options.baselineOutput },
		candidate: { ...emptySide(), dist: options.candidateDist, commit: options.candidateSha, output: options.candidateOutput },
	}
	const plan = pairedCellRuns(shardCells, options.repetition)
	for (const [position, { cell, side }] of plan.entries()) {
		const state = sides[side]
		state.startedAt ??= new Date()
			.toISOString()
		console.error(`[cells] [${position + 1}/${plan.length}] ${cell.id} × ${side} (adjacent pair, repetition ${options.repetition})`)
		const payload = await runWorker(cell.id, options.mode, {
			...process.env,
			VALCHECKER_DIST_URL: state.dist,
			BENCHMARK_COMMIT: state.commit,
		})
		recordPayload(state, cell, payload)
		state.completedAt = new Date()
			.toISOString()
	}
	for (const side of ['baseline', 'candidate']) {
		const state = sides[side]
		for (const entry of state.unmeasurable)
			console.error(`[cells] ${side} unmeasurable: ${entry.cell} — ${entry.reason}`)
		const result = rawResult({
			options,
			artifact,
			shardCells,
			side,
			dist: state.dist,
			commit: state.commit,
			state,
			pairing: 'adjacent-cell',
			scenarioRoles,
		})
		await writeRaw(state.output, result)
		console.error(`[cells] wrote ${state.output}: ${state.results.length} measured, ${state.unmeasurable.length} unmeasurable`)
	}
}

async function readScenarioRoles(options) {
	if (options.selectionRoles == null)
		return null
	const artifact = JSON.parse(await readFile(options.selectionRoles, 'utf8'))
	if (artifact?.schemaVersion !== 1 || !Array.isArray(artifact.scenarios))
		throw new Error(`${options.selectionRoles} is not a Performance Impact selection artifact`)
	const roles = Object.fromEntries(artifact.scenarios.map((entry) => {
		if (typeof entry?.id !== 'string' || !['affected', 'health-canary'].includes(entry?.role))
			throw new Error(`${options.selectionRoles} contains an invalid scenario role`)
		return [entry.id, entry.role]
	}))
	const selected = options.cells.length > 0 ? options.cells : Object.keys(roles)
	const missing = selected.filter(id => roles[id] == null)
	if (missing.length > 0)
		throw new Error(`${options.selectionRoles} has no role for selected cell(s): ${missing.join(', ')}`)
	return roles
}

async function main() {
	const options = parseArguments(process.argv.slice(2))
	// The apparatus always comes from the checked-out candidate ref. In paired mode the
	// parent must resolve the bench declarations against the candidate build; each worker
	// receives the side-specific dist separately.
	if (options.paired)
		process.env.VALCHECKER_DIST_URL = options.candidateDist
	// `collect.mjs` registers the loader at import time, and Node's loader worker sees the
	// environment as it stood at registration. Paired mode therefore sets the apparatus dist
	// before importing the collector rather than mutating `process.env` afterwards.
	const { cellCatalog, collectStepBenches } = await import('./collect.mjs')
	const catalog = cellCatalog(await collectStepBenches())
	const artifact = buildCellCatalog(catalog)
	const shardCells = selectionOf(options, catalog)
	const scenarioRoles = await readScenarioRoles(options)

	if (options.paired)
		await runPaired(options, artifact, shardCells, scenarioRoles)
	else
		await runSingle(options, artifact, shardCells, scenarioRoles)

	if (options.catalogOutput != null) {
		await mkdir(dirname(options.catalogOutput), { recursive: true })
		await writeFile(options.catalogOutput, `${JSON.stringify(artifact, null, 2)}\n`)
		console.error(`[cells] wrote ${options.catalogOutput}: ${artifact.cells.length} cells, catalog ${artifact.catalogHash}`)
	}
}

// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM entry script executed to completion at load
await main()
