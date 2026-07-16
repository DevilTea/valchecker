import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const benchmarkRoot = fileURLToPath(new URL('..', import.meta.url))
const detailedReporter = fileURLToPath(new URL('./report.mjs', import.meta.url))
const conciseReporter = fileURLToPath(new URL('./summary.mjs', import.meta.url))

function parseArguments(argv) {
	const options = {
		input: resolve(benchmarkRoot, 'results/raw.json'),
		markdown: resolve(benchmarkRoot, 'results/report.md'),
		html: resolve(benchmarkRoot, 'results/report.html'),
	}
	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index]
		const value = argv[index + 1]
		if (argument === '--input' && value) {
			options.input = resolve(benchmarkRoot, value)
			index++
		}
		else if (argument === '--markdown' && value) {
			options.markdown = resolve(benchmarkRoot, value)
			index++
		}
		else if (argument === '--html' && value) {
			options.html = resolve(benchmarkRoot, value)
			index++
		}
		else {
			throw new Error(`Unknown or incomplete argument: ${argument}`)
		}
	}
	return options
}

function run(script, args) {
	const result = spawnSync(process.execPath, [script, ...args], {
		cwd: benchmarkRoot,
		stdio: 'inherit',
	})
	if (result.error)
		throw result.error
	if (result.status !== 0)
		throw new Error(`${script} failed with ${result.signal ?? result.status}`)
}

const options = parseArguments(process.argv.slice(2))
run(detailedReporter, [
	'--input', options.input,
	'--markdown', options.markdown,
	'--html', options.html,
])
run(conciseReporter, [
	'--input', options.input,
	'--markdown', join(dirname(options.markdown), 'summary.md'),
	'--html', join(dirname(options.html), 'summary.html'),
])
