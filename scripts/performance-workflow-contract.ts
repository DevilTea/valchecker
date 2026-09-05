import { YAML } from 'zx'

const resolutionStepName = 'Resolve the two stages'
const allowedStepKeys = ['env', 'name', 'run', 'shell']
const githubExpression = (expression: string): string => '$' + `{{ ${expression} }}`
const expectedEnvironment = {
	CONFIRM_RESULT: githubExpression('needs.confirm-measure.result'),
	PLAN: githubExpression('needs.compare.outputs.confirm_plan'),
	RUNS: githubExpression('needs.measure.outputs.runs'),
}
const expectedCommandTail = [
	'pnpm --dir benchmarks confirm \\',
	'  --screen ../artifacts/screen/impact.json \\',
	'  "$' + '{confirm_args[@]}" \\',
	'  --markdown ../artifacts/performance-impact-verdict/confirmation.md \\',
	'  --json ../artifacts/performance-impact-verdict/confirmation.json \\',
	'  --fail-on-regression \\',
	'  --require-resolved',
].join('\n')

function sameRecord(actual: Record<string, unknown>, expected: Record<string, unknown>): boolean {
	const normalize = (value: Record<string, unknown>) => Object.entries(value)
		.sort(([left], [right]) => left.localeCompare(right))
	return JSON.stringify(normalize(actual)) === JSON.stringify(normalize(expected))
}

export function performanceVerdictWorkflowProblems(workflow: string): string[] {
	const problems: string[] = []
	const document = YAML.parse(workflow) as { jobs?: Record<string, { steps?: unknown }> } | null
	const steps = document?.jobs?.verdict?.steps
	if (!Array.isArray(steps))
		return ['verdict job has no steps array']

	const matches = steps.filter((step): step is Record<string, unknown> => (
		step != null
		&& typeof step === 'object'
		&& (step as Record<string, unknown>).name === resolutionStepName
	))
	if (matches.length !== 1)
		return [`verdict job must contain exactly one ${JSON.stringify(resolutionStepName)} step; found ${matches.length}`]

	const step = matches[0]!
	const keys = Object.keys(step)
		.sort()
	if (JSON.stringify(keys) !== JSON.stringify(allowedStepKeys)) {
		problems.push(
			`${resolutionStepName} step keys must equal ${JSON.stringify(allowedStepKeys)}, received ${JSON.stringify(keys)}`,
		)
	}
	if (step.shell !== 'bash')
		problems.push(`${resolutionStepName} step shell must be bash`)

	const environment = step.env
	if (environment == null || typeof environment !== 'object' || Array.isArray(environment)) {
		problems.push(`${resolutionStepName} step env must be the fixed verdict inputs`)
	}
	else if (!sameRecord(environment as Record<string, unknown>, expectedEnvironment)) {
		problems.push(`${resolutionStepName} step env must equal ${JSON.stringify(expectedEnvironment)}`)
	}

	const run = step.run
	if (typeof run !== 'string') {
		problems.push(`${resolutionStepName} step must have an executable run block`)
	}
	else if (!run.trimEnd()
		.endsWith(expectedCommandTail)) {
		problems.push(`${resolutionStepName} step must end with the exact gated confirmation command`)
	}

	return problems
}
