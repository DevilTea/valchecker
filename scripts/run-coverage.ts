import { spawn } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { checkCoverage } from './check-coverage'

const root = fileURLToPath(new URL('..', import.meta.url))
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

function runVitest(): Promise<number> {
	return new Promise((resolve, reject) => {
		const child = spawn(pnpm, ['exec', 'vitest', '--run', '--coverage.enabled'], {
			cwd: root,
			env: process.env,
			stdio: 'inherit',
		})

		child.once('error', reject)
		child.once('exit', (code, signal) => {
			if (signal) {
				reject(new Error(`Vitest terminated by ${signal}`))
				return
			}
			resolve(code ?? 1)
		})
	})
}

const vitestExitCode = await runVitest()
let perFilePassed = false

try {
	perFilePassed = await checkCoverage()
}
catch (error) {
	console.error(error)
}

if (vitestExitCode !== 0 || !perFilePassed)
	process.exitCode = 1
