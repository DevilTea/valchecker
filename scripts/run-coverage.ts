import { spawn } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { checkCoverage } from './check-coverage'

const root = fileURLToPath(new URL('..', import.meta.url))
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const retainedLogLines = 120

function printTail(output: string): void {
	const lines = output.trimEnd().split(/\r?\n/)
	const omitted = Math.max(0, lines.length - retainedLogLines)
	if (omitted > 0)
		console.log(`[coverage] omitted ${omitted} earlier Vitest log lines`)
	console.log(lines.slice(-retainedLogLines).join('\n'))
}

function runVitest(): Promise<number> {
	return new Promise((resolve, reject) => {
		const child = spawn(pnpm, ['exec', 'vitest', '--run', '--coverage.enabled', '--reporter=dot'], {
			cwd: root,
			env: process.env,
			stdio: ['inherit', 'pipe', 'pipe'],
		})
		let output = ''

		child.stdout.setEncoding('utf8')
		child.stderr.setEncoding('utf8')
		child.stdout.on('data', chunk => output += chunk)
		child.stderr.on('data', chunk => output += chunk)

		child.once('error', reject)
		child.once('exit', (code, signal) => {
			printTail(output)
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
