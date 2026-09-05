export interface TypePerformanceMetrics {
	files: number
	types: number
	instantiations: number
	memoryKib: number
	checkSeconds: number
	totalSeconds: number
}

export interface TypePerformanceBudget {
	typescript: string
	maximum: Pick<TypePerformanceMetrics, 'types' | 'instantiations' | 'memoryKib'>
}

/**
 * The type-performance gate is a comparison against a reviewed artifact. Without that artifact
 * there is no claim to verify, so a missing budget is a failure rather than a baseline candidate.
 */
export function evaluateTypePerformance(
	metrics: TypePerformanceMetrics,
	budget: TypePerformanceBudget | undefined,
	typescript: string,
): string[] {
	if (budget == null)
		return ['No committed type-performance budget exists. Commit type-performance/budget.json before treating this gate as passed.']

	const failures: string[] = []
	if (budget.typescript !== typescript)
		failures.push(`budget targets TypeScript ${budget.typescript}, but the workspace uses ${typescript}`)
	for (const metric of ['types', 'instantiations', 'memoryKib'] as const) {
		if (metrics[metric] > budget.maximum[metric])
			failures.push(`${metric} ${metrics[metric]} exceeds ${budget.maximum[metric]}`)
	}
	return failures
}

export function typePerformanceMarkdown(
	metrics: TypePerformanceMetrics,
	budget: TypePerformanceBudget | undefined,
	typescript: string,
	failures: string[],
): string {
	const rows = [
		['Files', metrics.files.toLocaleString('en-US'), 'report only'],
		['Types', metrics.types.toLocaleString('en-US'), budget?.maximum.types.toLocaleString('en-US') ?? 'missing'],
		['Instantiations', metrics.instantiations.toLocaleString('en-US'), budget?.maximum.instantiations.toLocaleString('en-US') ?? 'missing'],
		['Memory', `${metrics.memoryKib.toLocaleString('en-US')} KiB`, budget == null ? 'missing' : `${budget.maximum.memoryKib.toLocaleString('en-US')} KiB`],
		['Check time', `${metrics.checkSeconds.toFixed(2)} s`, 'report only'],
		['Total time', `${metrics.totalSeconds.toFixed(2)} s`, 'report only'],
	]
	const status = failures.length === 0 ? 'passed' : 'failed'
	return `# Type performance\n\n**${status.toUpperCase()}** with TypeScript ${typescript}.\n\n| Metric | Observed | Budget |\n| --- | ---: | ---: |\n${rows.map(row => `| ${row.join(' | ')} |`)
		.join('\n')}\n\n${budget == null
		? 'No committed budget exists. This gate fails closed until a reviewed type-performance/budget.json is committed.\n'
		: failures.length === 0
			? 'All deterministic compiler-complexity metrics are within budget. Wall-clock timings are reported but intentionally not gated on shared runners.\n'
			: `## Regressions\n\n${failures.map(failure => `- ${failure}`)
				.join('\n')}\n`}\n`
}
