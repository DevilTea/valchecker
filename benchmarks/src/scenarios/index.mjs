// Public entry point for the scenario set: tier selection, explicit selection,
// and the catalog that reaches `raw.json`. The scenarios themselves live in the
// family modules listed by `registry.mjs`.
import { allScenarios } from './registry.mjs'

const tierRank = { smoke: 0, standard: 1, full: 2 }

export function getScenarios(mode) {
	const rank = tierRank[mode]
	if (rank === undefined)
		throw new Error(`Unknown benchmark mode: ${mode}`)
	return allScenarios.filter(scenario => tierRank[scenario.tier] <= rank)
}

// Explicit scenario selection. Each token matches a scenario `id`
// (e.g. `primitive/valid`) or a `group` (e.g. `warm/failure/first`); the
// union of matches is returned. Selection ignores the sampling tier so a
// named scenario always runs regardless of `mode`. An unknown token is a hard
// error so a typo never silently benchmarks nothing.
export function selectScenarios(tokens) {
	const ids = new Set(allScenarios.map(scenario => scenario.id))
	const groups = new Set(allScenarios.map(scenario => scenario.group))
	const unknown = tokens.filter(token => !ids.has(token) && !groups.has(token))
	if (unknown.length > 0) {
		throw new Error(
			`Unknown benchmark scenario or group: ${unknown.join(', ')}. `
			+ `Valid groups: ${[...groups].join(', ')}.`,
		)
	}
	const selection = new Set(tokens)
	return allScenarios.filter(scenario => selection.has(scenario.id) || selection.has(scenario.group))
}

function toCatalogEntry(scenario) {
	return {
		id: scenario.id,
		category: scenario.category,
		tier: scenario.tier,
		group: scenario.group,
		resultKind: scenario.resultKind,
		issuePolicy: scenario.issuePolicy,
		comparisonScope: scenario.comparisonScope,
		diagnosticIssueCount: scenario.diagnosticIssueCount,
		requiredFeatures: scenario.requiredFeatures,
		executionMode: scenario.executionMode,
		entry: scenario.entry,
		steps: scenario.steps,
	}
}

export function getScenarioCatalog(mode) {
	return getScenarios(mode)
		.map(toCatalogEntry)
}

export function toScenarioCatalog(scenarios) {
	return scenarios.map(toCatalogEntry)
}
