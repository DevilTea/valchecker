/**
 * Proves every scenario's `steps` declaration equals the step methods its
 * Valchecker schema construction actually depends on.
 *
 * Direct method calls are recorded. Indirect dependencies are then discovered by
 * rebuilding with each otherwise-unobserved registered step omitted: if that sole
 * omission makes the build fail, the step is required even though no public method
 * call exposed it (notably union shorthand -> literal). The declared set must equal
 * direct + indirect exactly. Thus neither a missing dependency nor a fabricated
 * coverage claim can pass.
 */
import process from 'node:process'
import { getScenarios } from './scenarios/index.mjs'
import {
	omitAuditStep,
	recordedSteps,
	registeredStepNames,
	resetRecording,
	restoreAuditStepSet,
} from './step-recorder.mjs'

process.env.VALCHECKER_DIST_URL = new URL('./step-recorder.mjs', import.meta.url).href

// eslint-disable-next-line antfu/no-top-level-await -- benchmark audit entry script executed to completion at load
const adapter = (await import('./adapters/valchecker.mjs')).default

const scenarios = getScenarios('full')
const errors = []
const registered = registeredStepNames()
const registeredSet = new Set(registered)
const auditCache = new Map()

function contextFor(scenario) {
	return {
		issuePolicy: scenario.issuePolicy,
		comparisonScope: scenario.comparisonScope,
		resultKind: scenario.resultKind,
		executionMode: scenario.executionMode,
		entry: scenario.entry,
	}
}

function cacheKey(scenario) {
	// Adapter builds currently branch only on issuePolicy, but keeping every build
	// context field here makes the evidence correct if another branch is added later.
	return JSON.stringify([scenario.buildKey, contextFor(scenario)])
}

function buildScenario(build, context) {
	resetRecording()
	return build(context)
}

function auditDependencies(scenario, build) {
	const key = cacheKey(scenario)
	const cached = auditCache.get(key)
	if (cached !== undefined)
		return cached

	const context = contextFor(scenario)
	restoreAuditStepSet()
	buildScenario(build, context)
	const direct = new Set(recordedSteps())
	const indirect = new Set()

	for (const step of registered) {
		if (direct.has(step))
			continue
		omitAuditStep(step)
		try {
			buildScenario(build, context)
		}
		catch {
			// The omitted step is the only change from the successful full build, so
			// construction failing here is executable evidence that the build depends
			// on it. The specific error text is deliberately not a protocol.
			indirect.add(step)
		}
		finally {
			restoreAuditStepSet()
		}
	}

	const required = new Set([...direct, ...indirect])
	const result = { direct, indirect, required }
	auditCache.set(key, result)
	return result
}

for (const scenario of scenarios) {
	const build = adapter.build[scenario.buildKey]
	if (typeof build !== 'function') {
		errors.push(`${scenario.id}: the Valchecker adapter has no build key '${scenario.buildKey}'`)
		continue
	}

	let evidence
	try {
		evidence = auditDependencies(scenario, build)
	}
	catch (error) {
		errors.push(`${scenario.id}: auditing '${scenario.buildKey}' threw ${error instanceof Error ? error.message : String(error)}`)
		continue
	}

	const declared = new Set(scenario.steps)
	const unknown = scenario.steps.filter(step => !registeredSet.has(step))
	if (unknown.length > 0) {
		errors.push(`${scenario.id}: declares ${unknown.map(step => `\`${step}\``)
			.join(', ')}, which the loaded build does not register as a step method.`)
		continue
	}

	const missing = [...evidence.required].filter(step => !declared.has(step))
	const extra = scenario.steps.filter(step => !evidence.required.has(step))
	if (missing.length > 0) {
		errors.push(`${scenario.id}: omits required ${missing.map(step => `\`${step}\``)
			.join(', ')} from \`steps\`; impact selection and coverage would under-report this build.`)
	}
	if (extra.length > 0) {
		errors.push(`${scenario.id}: declares unneeded ${extra.map(step => `\`${step}\``)
			.join(', ')} in \`steps\`; the full build succeeds when each is omitted, so this would fabricate coverage.`)
	}
}

restoreAuditStepSet()
const indirectPairs = [...auditCache.values()].reduce((sum, evidence) => sum + evidence.indirect.size, 0)
console.error(`[benchmark] step audit: proved exact dependencies for ${scenarios.length} scenarios through ${auditCache.size} build/context shapes against ${registered.length} registered step methods (${indirectPairs} indirect dependency records)`)

if (errors.length > 0) {
	console.error(`[benchmark] step audit failed with ${errors.length} problem${errors.length === 1 ? '' : 's'}:`)
	for (const error of errors)
		console.error(`  - ${error}`)
	process.exitCode = 1
}
