import { measure } from './measure.mjs'
import { getScenarios } from './scenarios.mjs'

const adapterName = process.argv[2]
const mode = process.argv[3] ?? 'standard'
const action = process.argv[4] ?? 'measure'

const adapterPaths = {
	valchecker: './adapters/valchecker.mjs',
	zod3: './adapters/zod3.mjs',
	zod4: './adapters/zod4.mjs',
	'zod4-jitless': './adapters/zod4-jitless.mjs',
	valibot: './adapters/valibot.mjs',
}

const adapterPath = adapterPaths[adapterName]
if (!adapterPath)
	throw new Error(`Unknown benchmark adapter: ${adapterName}`)
if (action !== 'measure' && action !== 'verify')
	throw new Error(`Unknown benchmark worker action: ${action}`)

const adapter = (await import(adapterPath)).default
const scenarios = getScenarios(action === 'verify' ? 'full' : mode)
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

	const operation = scenario.setup(adapter)
	if (action === 'measure') {
		results.push({
			scenario: scenario.id,
			category: scenario.category,
			group: scenario.group,
			resultKind: scenario.resultKind,
			issuePolicy: scenario.issuePolicy,
			comparisonScope: scenario.comparisonScope,
			...measure(operation, mode),
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
