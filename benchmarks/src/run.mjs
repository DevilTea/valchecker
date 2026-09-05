import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { getProfile } from './measure.mjs'
import { getScenarios, selectScenarios, toScenarioCatalog } from './scenarios/index.mjs'
import { assertShardSelector, isolations, selectShardScenarios } from './sharding.mjs'

const benchmarkRoot = fileURLToPath(new URL('..', import.meta.url))
const workerPath = fileURLToPath(new URL('./worker.mjs', import.meta.url))
const defaultAdapters = ['valchecker', 'zod3', 'zod4', 'zod4-jitless', 'valibot']

function parseArguments(argv) {
	const options = {
		mode: 'standard',
		output: resolve(benchmarkRoot, 'results/raw.json'),
		adapters: defaultAdapters,
		seed: process.env.BENCHMARK_SEED ?? String(Date.now()),
		scenarios: [],
		// One process per (adapter, scenario) cell. See the comment above the run loop
		// for why this is the default and what `adapter` is still for.
		isolation: 'cell',
		shardIndex: 0,
		shardCount: 1,
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
		else if (argument === '--adapters' && value) {
			options.adapters = value.split(',')
				.map(adapter => adapter.trim())
				.filter(Boolean)
			index++
		}
		else if (argument === '--scenarios' && value) {
			options.scenarios = value.split(',')
				.map(scenario => scenario.trim())
				.filter(Boolean)
			index++
		}
		else if (argument === '--seed' && value) {
			options.seed = value
			index++
		}
		else if (argument === '--isolation' && value) {
			options.isolation = value
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
	if (options.adapters.length === 0)
		throw new Error('At least one benchmark adapter is required')
	if (new Set(options.adapters).size !== options.adapters.length)
		throw new Error('Benchmark adapters must not contain duplicates')
	for (const adapter of options.adapters) {
		if (!defaultAdapters.includes(adapter))
			throw new Error(`Unknown adapter: ${adapter}`)
	}
	if (!isolations.includes(options.isolation))
		throw new Error(`Unknown benchmark isolation: ${options.isolation}. Use one of ${isolations.join(', ')}.`)
	assertShardSelector(options.shardIndex, options.shardCount)
	return options
}

function createRandom(seed) {
	let state = 2166136261
	for (const character of seed)
		state = Math.imul(state ^ character.charCodeAt(0), 16777619)

	return () => {
		state += 0x6D2B79F5
		let value = state
		value = Math.imul(value ^ value >>> 15, value | 1)
		value ^= value + Math.imul(value ^ value >>> 7, value | 61)
		return ((value ^ value >>> 14) >>> 0) / 4294967296
	}
}

function shuffle(values, seed) {
	const random = createRandom(seed)
	const output = [...values]
	for (let index = output.length - 1; index > 0; index--) {
		const swap = Math.floor(random() * (index + 1))
		const current = output[index]
		output[index] = output[swap]
		output[swap] = current
	}
	return output
}

function runWorker(adapter, mode, scenarioIds) {
	return new Promise((resolvePromise, reject) => {
		const child = spawn(process.execPath, [workerPath, adapter, mode, 'measure', scenarioIds.join(',')], {
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
				reject(new Error(`${adapter} worker failed with ${signal ?? code}:\n${stderr || stdout}`))
				return
			}
			try {
				resolvePromise(JSON.parse(stdout))
			}
			catch (error) {
				reject(new Error(`${adapter} worker returned invalid JSON:\n${stdout}\n${stderr}`, { cause: error }))
			}
		})
	})
}

/**
 * Accumulates the worker payloads of one adapter into the single library entry
 * `raw.json` carries. With one process per cell there are as many payloads per
 * adapter as there are scenarios, and they must describe the same library: a
 * differing name or version would mean the shard measured two different builds and
 * reported them as one.
 */
function accumulate(libraries, payload) {
	const existing = libraries.get(payload.adapter)
	if (!existing) {
		libraries.set(payload.adapter, payload)
		return
	}
	for (const field of ['name', 'version']) {
		if (existing[field] !== payload[field])
			throw new Error(`${payload.adapter} reported ${field} '${payload[field]}' after '${existing[field]}'; one run cannot measure two builds of one library`)
	}
	existing.verifiedScenarios += payload.verifiedScenarios
	existing.totalScenarios += payload.totalScenarios
	existing.skippedScenarios.push(...payload.skippedScenarios)
	existing.results.push(...payload.results)
}

const options = parseArguments(process.argv.slice(2))
// Validate the scenario selection up front so a typo fails fast, before any
// worker is spawned, and derive the catalog for the selected scenarios only.
const selectedScenarios = options.scenarios.length > 0 ? selectScenarios(options.scenarios) : getScenarios(options.mode)
const shardScenarios = selectShardScenarios(selectedScenarios, options.shardIndex, options.shardCount)
if (shardScenarios.length === 0)
	throw new Error(`Shard ${options.shardIndex} of ${options.shardCount} has no scenarios; use a shard count no larger than the ${selectedScenarios.length} selected scenarios`)
const scenarioCatalog = toScenarioCatalog(shardScenarios)
const order = shuffle(options.adapters, options.seed)
const startedAt = new Date()
	.toISOString()
const libraries = new Map()

/**
 * Under `cell` isolation each (adapter, scenario) pair gets its own process, so no
 * cell's number depends on what ran before it. That dependence was large: an
 * identical array pipeline measured 83.5 ns as the first array-carried scenario in
 * a process and 261.9 ns after three others, and `schema-kind/unknown-valid`
 * measured 6.4 ns alone against 14.8 ns after `primitive/valid` and `any-valid` —
 * which moved its ratio against Zod 3 from 2.01× to 2.29×, past the 5% the report
 * needs to call an ordering reproducible. Measured the same way under this
 * isolation, both positions report 6.4 ns and the ratio holds at 2.02×. Four
 * separate findings during the scenario expansion had to work around the artefact,
 * so the cause is removed here rather than documented a fifth time.
 *
 * The loops are nested scenario-first: the adapters of one scenario are measured
 * back to back, so a drift across the run affects all of them together and the
 * within-scenario ranking — the only comparison the report makes — is what the
 * ordering protects. Processes still run strictly one at a time; overlapping two
 * would change what every number means.
 *
 * `adapter` isolation is the previous behaviour, one process per adapter running
 * every scenario. It is kept because it is what the archived runs were measured
 * with, so reproducing one of their numbers requires asking for it — and because
 * `compare` refuses to pair the two, that request can never be implicit.
 */
if (options.isolation === 'cell') {
	for (const [position, scenario] of shardScenarios.entries()) {
		console.error(`[benchmark] [${position + 1}/${shardScenarios.length}] ${scenario.id} × ${order.length} adapters (${options.mode}, cell isolation)`)
		for (const adapter of order) {
			// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM benchmark entry script executed to completion at load
			accumulate(libraries, await runWorker(adapter, options.mode, [scenario.id]))
		}
	}
}
else {
	const scenarioIds = shardScenarios.map(scenario => scenario.id)
	for (const adapter of order) {
		console.error(`[benchmark] running ${adapter} (${options.mode}, adapter isolation) [${scenarioIds.length} scenarios]`)
		// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM benchmark entry script executed to completion at load
		accumulate(libraries, await runWorker(adapter, options.mode, scenarioIds))
	}
}

const completedAt = new Date()
	.toISOString()
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
	schemaVersion: 5,
	mode: options.mode,
	seed: options.seed,
	scenarioFilter: options.scenarios.length > 0 ? options.scenarios : null,
	isolation: options.isolation,
	temporalPairing: 'none',
	scenarioRoles: null,
	startedAt,
	completedAt,
	profile: getProfile(options.mode),
	environment,
	// One entry per shard this file covers — exactly one here, and every shard of the
	// run after `merge`. It is what lets a reader see that two scenarios came from
	// two machines, which makes comparing them invalid for a second reason on top of
	// the cross-scenario one the methodology already states.
	shards: [{
		index: options.shardIndex,
		count: options.shardCount,
		scenarios: shardScenarios.map(scenario => scenario.id),
		startedAt,
		completedAt,
		environment,
	}],
	order,
	scenarioCatalog,
	libraries: order.map((adapter) => {
		const library = libraries.get(adapter)
		if (!library)
			throw new Error(`No worker result for ${adapter}`)
		return library
	}),
}

// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM benchmark entry script executed to completion at load
await mkdir(dirname(options.output), { recursive: true })
// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM benchmark entry script executed to completion at load
await writeFile(options.output, `${JSON.stringify(result, null, 2)}\n`)
console.error(`[benchmark] wrote ${options.output}`)
