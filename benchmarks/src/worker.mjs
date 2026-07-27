import process from 'node:process'
import { measure, measureAsync } from './measure.mjs'
import { getScenarios, selectScenarios } from './scenarios/index.mjs'

const adapterName = process.argv[2]
const mode = process.argv[3] ?? 'standard'
const action = process.argv[4] ?? 'measure'
const scenarioTokens = (process.argv[5] ?? '')
	.split(',')
	.map(token => token.trim())
	.filter(Boolean)

const adapterPaths = {
	'valchecker': './adapters/valchecker.mjs',
	'zod3': './adapters/zod3.mjs',
	'zod4': './adapters/zod4.mjs',
	'zod4-jitless': './adapters/zod4-jitless.mjs',
	'valibot': './adapters/valibot.mjs',
}

const adapterPath = adapterPaths[adapterName]
if (!adapterPath)
	throw new Error(`Unknown benchmark adapter: ${adapterName}`)
if (action !== 'measure' && action !== 'verify')
	throw new Error(`Unknown benchmark worker action: ${action}`)

// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM benchmark entry script executed to completion at load
const adapter = (await import(adapterPath)).default
const scenarios = action === 'verify'
	? getScenarios('full')
	: scenarioTokens.length > 0
		? selectScenarios(scenarioTokens)
		: getScenarios(mode)
const results = []
const skippedScenarios = []

for (const scenario of scenarios) {
	const support = scenario.support(adapter)
	if (!support.supported) {
		skippedScenarios.push({
			scenario: scenario.id,
			reason: support.reason,
		})
		continue
	}

	// An async scenario verifies its correctness by awaiting, so `setup` returns a
	// promise for the operation there and the operation itself everywhere else.
	// Scenarios are set up and measured strictly one at a time, sequentially:
	// overlapping two of them would change what every number in the run means.
	// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM benchmark entry script executed to completion at load
	const operation = await scenario.setup(adapter)
	if (action === 'measure') {
		results.push({
			scenario: scenario.id,
			category: scenario.category,
			group: scenario.group,
			resultKind: scenario.resultKind,
			issuePolicy: scenario.issuePolicy,
			comparisonScope: scenario.comparisonScope,
			diagnosticIssueCount: scenario.diagnosticIssueCount,
			// Carried on the measurement itself, not only in the catalog: a row in
			// `raw.json` then states how it was measured and through which entry point,
			// so no tool can pair an awaited number with a synchronous one by losing
			// track of which scenario it came from.
			executionMode: scenario.executionMode,
			entry: scenario.entry,
			...(scenario.executionMode === 'async'
				// eslint-disable-next-line antfu/no-top-level-await -- top-level await in an ESM benchmark entry script executed to completion at load
				? await measureAsync(operation, mode)
				: measure(operation, mode)),
		})
	}
}

process.stdout.write(JSON.stringify({
	adapter: adapterName,
	name: adapter.name,
	version: adapter.version,
	capabilities: adapter.capabilities ?? {},
	verifiedScenarios: scenarios.length - skippedScenarios.length,
	totalScenarios: scenarios.length,
	skippedScenarios,
	results,
}))
