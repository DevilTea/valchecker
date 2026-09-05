import { YAML } from 'zx'

const resolutionStepName = 'Resolve the two stages'
const allowedStepKeys = ['env', 'name', 'run', 'shell']
const githubExpression = (expression: string): string => '$' + `{{ ${expression} }}`
const expectedEnvironment = {
	COMPARE_RESULT: githubExpression('needs.compare.result'),
	CONFIRM_RESULT: githubExpression('needs.confirm-measure.result'),
	MEASURE_RESULT: githubExpression('needs.measure.result'),
	PLAN: githubExpression('needs.compare.outputs.confirm_plan'),
	RUNS: githubExpression('needs.measure.outputs.runs'),
}
const expectedNeeds = ['measure', 'compare', 'confirm-measure']
const expectedGuardPreamble = [
	'set -euo pipefail',
	'if [[ "$MEASURE_RESULT" != "success" || "$COMPARE_RESULT" != "success" ]]; then',
	'echo "[confirm] upstream evidence unavailable: measure=$MEASURE_RESULT compare=$COMPARE_RESULT" >&2',
	'exit 2',
	'fi',
	'planned_batches="$(node -e \'const plan = JSON.parse(process.argv[1]); process.stdout.write(String(plan.batches.length))\' "$PLAN")"',
	'if [[ "$planned_batches" -gt 0 && "$CONFIRM_RESULT" != "success" ]]; then',
	'echo "[confirm] $planned_batches confirmation batch(es) were planned but confirm-measure=$CONFIRM_RESULT" >&2',
	'exit 2',
	'fi',
]
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
	const document = YAML.parse(workflow) as { jobs?: Record<string, { if?: unknown, needs?: unknown, steps?: unknown }> } | null
	const verdict = document?.jobs?.verdict
	if (verdict == null)
		return ['workflow has no verdict job']
	if (JSON.stringify(verdict.needs) !== JSON.stringify(expectedNeeds))
		problems.push(`verdict job needs must equal ${JSON.stringify(expectedNeeds)}`)
	if (verdict.if !== 'always()')
		problems.push('verdict job must run with `if: always()` so upstream failures cannot skip the final gate')
	const steps = verdict.steps
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
	else {
		const executableLines = run.split(/\r?\n/)
			.map(line => line.trim())
			.filter(line => line.length > 0 && !line.startsWith('#'))
		if (JSON.stringify(executableLines.slice(0, expectedGuardPreamble.length)) !== JSON.stringify(expectedGuardPreamble))
			problems.push(`${resolutionStepName} step must fail closed before reading incomplete upstream evidence`)
		if (!run.trimEnd()
			.endsWith(expectedCommandTail)) {
			problems.push(`${resolutionStepName} step must end with the exact gated confirmation command`)
		}
	}

	return problems
}
