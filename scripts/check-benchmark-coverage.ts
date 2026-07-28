import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { fileSystemTree } from './source-tree'
import { discoverSteps } from './step-inventory'

// Keeps the cross-library benchmark suite's step coverage from reopening. Every built-in step
// already has a colocated `*.bench.ts`, so "has a focused benchmark" would be true of all of them
// and would check nothing; what can actually rot is whether the *cross-library* suite still puts a
// step next to a competitor spelling of the same work.
//
// The covered set is read from each scenario's declared `steps`, through the scenario catalog —
// the same field that reaches `raw.json` — rather than from adapter source. Scanning an adapter for
// `.isLengthAtLeast(` would follow a rename or a respelling into silence, and it could not tell a
// Valchecker chain from a competitor closure that happens to contain the same characters.
//
// Both directions are checked, because each one lies without the other. A declared step that no
// scenario names is an uncovered step. A `steps` entry that names nothing declared is a typo that
// would otherwise report coverage for a method that does not exist while the real one stays
// uncovered.
//
// A scenario only covers a step if some *competitor* participates in it. A scenario every
// competitor is gated out of measures Valchecker against nothing, which is the same situation as a
// step no scenario names — there is no cross-library comparison — so it belongs in the allowlist
// rather than in the covered count. Participation is decided by the runner's own `supportFor`, over
// the capabilities declared in `benchmarks/src/capabilities.mjs`, so this gate cannot disagree with
// what the runner would actually skip.
//
// The allowlist below is for steps no competitor can express, so no comparison exists to build. It
// is checked for rot in both directions too: an entry for a step some scenario now covers fails, so
// the list shrinks as the suite grows instead of quietly absorbing a regression, and an entry for a
// step that no longer exists fails rather than lingering as a comment.
//
// This gate imports the scenario catalog, `define.mjs`, and the capability declarations, whose
// module graphs are closed over `fixtures.mjs` and contain no bare specifier, so it runs without
// `benchmarks/node_modules` — `benchmarks/` is installed separately with `--ignore-workspace` and
// its libraries may be absent. That is also why the capabilities are declared in a module of their
// own instead of read from the adapters: the Zod adapters detect theirs from the live module, which
// this gate cannot load. The declaration is not a second opinion, because those adapters take their
// published capabilities from it and refuse to load when detection disagrees.

interface Exemption {
	/** The `Meta.Name` of the built-in step. */
	step: string
	/** Why no cross-library comparison exists. Shape-checked here; read by people. */
	reason: string
}

// Verified against the pinned competitors (`zod@3.25.76`, `zod@4.4.3`, `valibot@1.4.2`) by
// executing each candidate spelling, not by reading their documentation.
const exemptions: Exemption[] = [
	{
		step: 'as',
		reason: 'A compile-time cast: the plugin implementation is `noop`, so the step installs no runtime step and a scenario would time an empty pipeline. Zod and Valibot need no equivalent because the equivalent is a TypeScript `as` expression, which no schema executes.',
	},
	{
		step: 'isIncludingKey',
		reason: 'No pinned competitor has a Map key-membership check. Zod 3 exports no `includes` at all; Zod 4\'s and Valibot\'s reach `Array.prototype.includes` and throw `payload.value.includes is not a function` / `dataset.value.includes is not a function` when run over a Map. The only competitor spelling is therefore a `refine`/`check` closure calling `map.has()` — a hand-rolled stand-in for a built-in, which this suite does not build.',
	},
	{
		step: 'isIncludingValue',
		reason: 'No pinned competitor has a Map value-membership check, for the same reason `isIncludingKey` has none. A closure would also have to reimplement this step\'s SameValueZero match, under which `NaN` finds `NaN`, so it would be a stand-in making a different decision rather than the same one.',
	},
	{
		step: 'json',
		reason: 'Every pinned competitor is gated out of `schema-kind/json-*`, so those scenarios rank one library against nothing. Zod 3 and Valibot have no equivalent of a check that a string parses, and Zod 4\'s `z.json()` is a recursive JSON-*value* schema that accepts `42`, `null`, arrays, plain objects, and the string `\'not json\'`, so pairing them would compare a structural walk against one native parse call.',
	},
]

// Long enough that a placeholder such as `no equivalent` cannot pass, short enough that the check
// is about shape rather than about wording.
const minimumReasonLength = 60

const root = fileURLToPath(new URL('..', import.meta.url))
const catalogEntry = path.join(root, 'benchmarks/src/scenarios/index.mjs')
const defineEntry = path.join(root, 'benchmarks/src/scenarios/define.mjs')
const capabilitiesEntry = path.join(root, 'benchmarks/src/capabilities.mjs')

// The set of steps comes from `step-inventory`, which fails rather than skipping a directory it
// cannot read as a step. Without that, an unreadable step is not an uncovered step — it is a
// step this gate never asks about, and the coverage count it prints is over a smaller set than
// the repository has.
const { steps, problems } = discoverSteps(fileSystemTree(root))
const errors: string[] = [...problems]
const declared = new Set(steps.map(step => step.name))

interface CatalogEntry {
	id: string
	steps: string[]
	issuePolicy: string
	requiredFeatures: string[]
}

interface Support {
	supported: boolean
	reason: string | null
}

const { getScenarioCatalog } = await import(pathToFileURL(catalogEntry).href) as {
	getScenarioCatalog: (mode: string) => CatalogEntry[]
}
const { supportFor } = await import(pathToFileURL(defineEntry).href) as {
	supportFor: (adapter: unknown, issuePolicy: string, requiredFeatures: string[]) => Support
}
const { competitorKeys, featureSupport, featuresFor, issuePoliciesFor } = await import(pathToFileURL(capabilitiesEntry).href) as {
	competitorKeys: string[]
	featureSupport: Record<string, string[]>
	featuresFor: (adapter: string) => string[]
	issuePoliciesFor: (adapter: string) => string[]
}

// Stand-ins for the adapters, carrying nothing but the capabilities the runner consults. The
// support decision itself is the runner's, so a scenario counted as compared here is one the
// runner would really measure on that competitor.
const competitors = competitorKeys.map(adapter => ({
	name: adapter,
	capabilities: { features: featuresFor(adapter), issuePolicies: issuePoliciesFor(adapter) },
}))

// `full` is the whole suite: the sampling tier decides how often a scenario runs, not whether it
// exists, so a step covered only by a full-tier scenario is covered.
const scenarios = getScenarioCatalog('full')

/** Each covered step, with one scenario that compares it, for the staleness message. */
const covered = new Map<string, string>()
/** Each step named only by scenarios no competitor participates in, with one such scenario. */
const uncompared = new Map<string, string>()
for (const scenario of scenarios) {
	// A required feature no adapter declares would gate every competitor out and silently turn the
	// scenario into a Valchecker-only row, which is the failure this gate exists to catch.
	for (const feature of scenario.requiredFeatures) {
		if (featureSupport[feature] === undefined)
			errors.push(`benchmarks: scenario '${scenario.id}' requires the feature '${feature}', which no adapter declares in benchmarks/src/capabilities.mjs. Fix the spelling, or declare it.`)
	}
	const compared = competitors.some(competitor => supportFor(competitor, scenario.issuePolicy, scenario.requiredFeatures).supported)
	for (const step of scenario.steps) {
		if (!declared.has(step)) {
			errors.push(`benchmarks: scenario '${scenario.id}' declares the step '${step}', which is not a built-in step name. Fix the spelling in its \`steps\`, or the step it means stays uncovered.`)
			continue
		}
		if (compared) {
			if (!covered.has(step))
				covered.set(step, scenario.id)
		}
		else if (!uncompared.has(step)) {
			uncompared.set(step, scenario.id)
		}
	}
}

const exempted = new Set(exemptions.map(exemption => exemption.step))

for (const exemption of exemptions) {
	if (exemption.reason.trim().length < minimumReasonLength) {
		errors.push(`scripts/check-benchmark-coverage.ts: the allowlist entry for '${exemption.step}' needs a reason of at least ${minimumReasonLength} characters saying why no cross-library comparison exists.`)
	}

	if (!declared.has(exemption.step)) {
		errors.push(`scripts/check-benchmark-coverage.ts: the allowlist entry for '${exemption.step}' names no built-in step. Remove it, or correct the name.`)
		continue
	}

	const coveringScenario = covered.get(exemption.step)
	if (coveringScenario != null)
		errors.push(`scripts/check-benchmark-coverage.ts: the allowlist entry for '${exemption.step}' is stale — scenario '${coveringScenario}' compares it against at least one pinned competitor. Remove the entry.`)
}

for (const step of [...declared].sort()) {
	if (covered.has(step) || exempted.has(step))
		continue
	const uncomparedScenario = uncompared.get(step)
	errors.push(uncomparedScenario == null
		? `packages/internal/src/steps/${step}: no cross-library benchmark scenario names '${step}' in its \`steps\`. Add a scenario that exercises it, or allowlist it in scripts/check-benchmark-coverage.ts with the reason no competitor can express it.`
		: `packages/internal/src/steps/${step}: scenario '${uncomparedScenario}' names '${step}', but every pinned competitor is gated out of it, so it ranks Valchecker against nothing. Add a scenario a competitor can participate in, or allowlist the step in scripts/check-benchmark-coverage.ts.`)
}

if (errors.length > 0) {
	console.error(errors.join('\n'))
	process.exitCode = 1
}
else {
	console.log(`Cross-library benchmark step coverage is complete: ${covered.size} of ${declared.size} built-in steps are compared against at least one pinned competitor across ${scenarios.length} scenarios, ${exemptions.length} allowlisted.`)
}
