import { spawn } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const benchmarkRoot = fileURLToPath(new URL('..', import.meta.url))
const workerPath = fileURLToPath(new URL('./worker.mjs', import.meta.url))
const adapters = ['valchecker', 'zod3', 'zod4', 'zod4-jitless', 'valibot']

function verifyAdapter(adapter) {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [workerPath, adapter, 'full', 'verify'], {
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
				reject(new Error(`${adapter} verification failed with ${signal ?? code}:\n${stderr || stdout}`))
				return
			}

			try {
				resolve(JSON.parse(stdout))
			}
			catch (error) {
				reject(new Error(`${adapter} verification returned invalid JSON:\n${stdout}\n${stderr}`, { cause: error }))
			}
		})
	})
}

for (const adapter of adapters) {
	// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM benchmark entry script executed to completion at load
	const result = await verifyAdapter(adapter)
	console.error(
		`[benchmark] verified ${result.name} ${result.version}: ${result.verifiedScenarios}/${result.totalScenarios} scenarios (${result.skippedScenarios.length} unsupported)`,
	)
}
