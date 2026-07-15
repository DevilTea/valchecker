import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { getProfile } from './measure.mjs'

const benchmarkRoot = fileURLToPath(new URL('..', import.meta.url))
const workerPath = fileURLToPath(new URL('./worker.mjs', import.meta.url))
const defaultAdapters = ['valchecker', 'zod3', 'zod4', 'zod4-jitless', 'valibot']

function parseArguments(argv) {
	const options = {
		mode: 'standard',
		output: resolve(benchmarkRoot, 'results/raw.json'),
		adapters: defaultAdapters,
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
		else if (argument === '--adapters' && value) {
			options.adapters = value.split(',').filter(Boolean)
			index++
		}
		else if (argument === '--seed' && value) {
			options.seed = value
			index++
		}
		else {
			throw new Error(`Unknown or incomplete argument: ${argument}`)
		}
	}

	getProfile(options.mode)
	for (const adapter of options.adapters) {
		if (!defaultAdapters.includes(adapter))
			throw new Error(`Unknown adapter: ${adapter}`)
	}
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

function runWorker(adapter, mode) {
	return new Promise((resolvePromise, reject) => {
		const child = spawn(process.execPath, [workerPath, adapter, mode], {
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

const options = parseArguments(process.argv.slice(2))
const order = shuffle(options.adapters, options.seed)
const startedAt = new Date().toISOString()
const libraries = []

for (const adapter of order) {
	console.error(`[benchmark] running ${adapter} (${options.mode})`)
	libraries.push(await runWorker(adapter, options.mode))
}

const result = {
	schemaVersion: 1,
	mode: options.mode,
	seed: options.seed,
	startedAt,
	completedAt: new Date().toISOString(),
	profile: getProfile(options.mode),
	environment: {
		node: process.version,
		platform: process.platform,
		arch: process.arch,
		cpu: os.cpus()[0]?.model ?? 'unknown',
		logicalCpuCount: os.cpus().length,
		totalMemoryBytes: os.totalmem(),
		commit: process.env.GITHUB_SHA ?? process.env.BENCHMARK_COMMIT ?? null,
		runner: process.env.RUNNER_NAME ?? null,
	},
	order,
	libraries,
}

await mkdir(dirname(options.output), { recursive: true })
await writeFile(options.output, `${JSON.stringify(result, null, 2)}\n`)
console.error(`[benchmark] wrote ${options.output}`)
