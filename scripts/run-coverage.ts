import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { checkPerFileCoverage } from './check-coverage'

const root = fileURLToPath(new URL('..', import.meta.url))
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const retainedLogLines = 120

interface VitestRun {
	exitCode: number
	output: string
}

function printTail(output: string): void {
	const lines = output.trimEnd().split(/\r?\n/)
	const omitted = Math.max(0, lines.length - retainedLogLines)
	if (omitted > 0)
		console.log(`[coverage] omitted ${omitted} earlier Vitest log lines`)
	console.log(lines.slice(-retainedLogLines).join('\n'))
}

function runVitest(): Promise<VitestRun> {
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
			if (signal) {
				reject(new Error(`Vitest terminated by ${signal}`))
				return
			}
			resolve({ exitCode: code ?? 1, output })
		})
	})
}

const vitest = await runVitest()
printTail(vitest.output)
await mkdir(new URL('../coverage', import.meta.url), { recursive: true })
await writeFile(new URL('../coverage/vitest.log', import.meta.url), vitest.output)

let perFilePassed = false
try {
	perFilePassed = await checkPerFileCoverage()
}
catch (error) {
	console.error(error)
}

if (vitest.exitCode !== 0 || !perFilePassed)
	process.exitCode = 1
