/**
 * Checks every scenario's `steps` declaration against the step methods its Valchecker
 * schema actually calls.
 *
 * Two mechanisms read that field and neither could verify it: `check-benchmark-coverage.ts`
 * decides which built-in steps the cross-library suite covers, and the Performance Impact
 * gate maps a changed file through the import graph to the steps that reach it and then to
 * the scenarios naming those steps. A missing entry therefore both overstates coverage and
 * silently removes a scenario from the impact selection — an under-selection, which is the
 * failure mode that gate is built around. Up to now both mechanisms trusted a human claim.
 *
 * The audit drives every scenario's `build()` against a recording instance
 * (`step-recorder.mjs`) and compares what was called with what was declared.
 *
 * **Only under-declaration fails.** A declaration is allowed to exceed what is observed,
 * because a step can be reached without its method being called: `templateLiteral`
 * declares `literal` because `v.union(['px', 'em', 'rem'])` resolves its string branches
 * through a runtime registry lookup rather than through `v.literal`. Over-declaration
 * costs an over-selected scenario and an over-counted coverage entry; under-declaration
 * costs a regression that reaches `main` behind a green gate. So the extra names are
 * listed and not failed, and a missing one is an error.
 */
import process from 'node:process'
import { getScenarios } from './scenarios/index.mjs'
import { recordedSteps, registeredStepNames, resetRecording } from './step-recorder.mjs'

// Every scenario builds through the recorder rather than through the real build.
process.env.VALCHECKER_DIST_URL = new URL('./step-recorder.mjs', import.meta.url).href

// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM benchmark entry script executed to completion at load
const adapter = (await import('./adapters/valchecker.mjs')).default

const scenarios = getScenarios('full')
const errors = []
const overDeclared = []
const registered = new Set(registeredStepNames())

for (const scenario of scenarios) {
	const build = adapter.build[scenario.buildKey]
	if (typeof build !== 'function') {
		errors.push(`${scenario.id}: the Valchecker adapter has no build key '${scenario.buildKey}'`)
		continue
	}

	// The same context `defineScenario` hands `createOperation`, because a build can
	// branch on it — the issue-policy scenarios build `collectAllIssues` variants — and
	// auditing one branch would leave the other unaudited.
	const context = {
		issuePolicy: scenario.issuePolicy,
		comparisonScope: scenario.comparisonScope,
		resultKind: scenario.resultKind,
		executionMode: scenario.executionMode,
		entry: scenario.entry,
	}

	resetRecording()
	try {
		build(context)
	}
	catch (error) {
		errors.push(`${scenario.id}: building '${scenario.buildKey}' threw ${error instanceof Error ? error.message : String(error)}`)
		continue
	}
	const observed = recordedSteps()
	const declared = new Set(scenario.steps)

	const missing = observed.filter(step => !declared.has(step))
	if (missing.length > 0) {
		errors.push(
			`${scenario.id}: builds with ${missing.map(step => `\`${step}\``)
				.join(', ')} but does not declare ${missing.length === 1 ? 'it' : 'them'} in \`steps\`. `
				+ 'An undeclared step is a scenario the impact gate will not select when that step changes.',
		)
	}

	const unknown = scenario.steps.filter(step => !registered.has(step))
	if (unknown.length > 0) {
		errors.push(
			`${scenario.id}: declares ${unknown.map(step => `\`${step}\``)
				.join(', ')}, which the loaded build does not register as a step method.`,
		)
	}

	const extra = scenario.steps.filter(step => !observed.includes(step) && registered.has(step))
	if (extra.length > 0)
		overDeclared.push(`${scenario.id}: ${extra.join(', ')}`)
}

console.error(`[benchmark] step audit: drove ${scenarios.length} scenarios through ${new Set(scenarios.map(scenario => scenario.buildKey)).size} build keys against ${registered.size} registered step methods`)
if (overDeclared.length > 0) {
	console.error(`[benchmark] step audit: ${overDeclared.length} scenario${overDeclared.length === 1 ? '' : 's'} declare a step the build did not call, which is allowed:`)
	for (const line of overDeclared)
		console.error(`  - ${line}`)
}

if (errors.length > 0) {
	console.error(`[benchmark] step audit failed with ${errors.length} problem${errors.length === 1 ? '' : 's'}:`)
	for (const error of errors)
		console.error(`  - ${error}`)
	process.exitCode = 1
}
