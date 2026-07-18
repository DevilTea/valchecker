import { readFile } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolvePerFileThresholds } from './coverage-policy'

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

function percentage(metric: CoverageMetric): number {
	return metric.pct === 'Unknown' ? 100 : metric.pct
}

export async function checkPerFileCoverage(): Promise<boolean> {
	const summary = JSON.parse(await readFile(summaryPath, 'utf8')) as Record<string, FileCoverageSummary>
	const failures: string[] = []

	for (const [filename, coverage] of Object.entries(summary)) {
		if (filename === 'total')
			continue

		const path = relative(root, filename).split(sep).join('/')
		const { name, thresholds } = resolvePerFileThresholds(path)
		for (const metric of ['lines', 'statements', 'functions', 'branches'] as const) {
			const result = coverage[metric]
			if (result.total === 0)
				continue

			const actual = percentage(result)
			const minimum = thresholds[metric]
			if (actual < minimum)
				failures.push(`${path}: ${metric} ${actual}% < ${minimum}% (${name})`)
		}
	}

	if (failures.length > 0) {
		console.error('Per-file coverage policy failed:')
		for (const failure of failures)
			console.error(`- ${failure}`)
		return false
	}

	console.log('Per-file coverage policy passed.')
	return true
}
