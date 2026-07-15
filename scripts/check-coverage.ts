import { readFile } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'
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

function percentage(metric: CoverageMetric): number {
	return metric.pct === 'Unknown' ? 100 : metric.pct
}

export async function checkCoverage(): Promise<boolean> {
	const summary = JSON.parse(await readFile(summaryPath, 'utf8')) as Record<string, FileCoverageSummary>
	const total = summary.total
	if (!total)
		throw new Error(`Coverage summary does not contain a total entry: ${summaryPath}`)

	console.log([
		'Coverage total:',
		`lines ${percentage(total.lines)}%`,
		`statements ${percentage(total.statements)}%`,
		`functions ${percentage(total.functions)}%`,
		`branches ${percentage(total.branches)}%`,
	].join(' '))

	const failures: string[] = []
	for (const [filename, coverage] of Object.entries(summary)) {
		if (filename === 'total')
			continue

		const path = relative(root, filename).split(sep).join('/')
		for (const [metric, minimum] of Object.entries(thresholds) as Array<[keyof typeof thresholds, number]>) {
			const result = coverage[metric]
			if (result.total === 0)
				continue

			const actual = percentage(result)
			if (actual < minimum)
				failures.push(`${path}: ${metric} ${actual}% < ${minimum}%`)
		}
	}

	if (failures.length > 0) {
		console.error('Per-file coverage thresholds were not met:')
		for (const failure of failures)
			console.error(`- ${failure}`)
		return false
	}

	console.log('Per-file coverage thresholds passed: lines/statements/functions >= 90%, branches >= 85%.')
	return true
}
