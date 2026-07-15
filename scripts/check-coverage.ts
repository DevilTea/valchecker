import { readFile } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const summaryPath = resolve(root, 'coverage/coverage-summary.json')

interface CoverageMetric {
	total: number
	covered: number
	skipped: number
	pct: number | 'Unknown'
}

interface FileCoverageSummary {
	lines: CoverageMetric
	statements: CoverageMetric
	functions: CoverageMetric
	branches: CoverageMetric
}

const thresholds = {
	lines: 90,
	statements: 90,
	functions: 90,
	branches: 85,
} as const

const summary = JSON.parse(await readFile(summaryPath, 'utf8')) as Record<string, FileCoverageSummary>
const failures: string[] = []

for (const [filename, coverage] of Object.entries(summary)) {
	if (filename === 'total')
		continue

	const path = relative(root, filename).split(sep).join('/')
	for (const [metric, minimum] of Object.entries(thresholds) as Array<[keyof typeof thresholds, number]>) {
		const result = coverage[metric]
		if (result.total === 0)
			continue

		const percentage = result.pct === 'Unknown' ? 100 : result.pct
		if (percentage < minimum)
			failures.push(`${path}: ${metric} ${percentage}% < ${minimum}%`)
	}
}

if (failures.length > 0) {
	console.error('Per-file coverage thresholds were not met:')
	for (const failure of failures)
		console.error(`- ${failure}`)
	process.exitCode = 1
}
else {
	console.log('Per-file coverage thresholds passed: lines/statements/functions >= 90%, branches >= 85%.')
}
