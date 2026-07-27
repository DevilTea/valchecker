import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

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
// The allowlist below is for steps no competitor can express, so no comparison exists to build. It
// is checked for rot in both directions too: an entry for a step some scenario now covers fails, so
// the list shrinks as the suite grows instead of quietly absorbing a regression, and an entry for a
// step that no longer exists fails rather than lingering as a comment.
//
// This gate imports only the scenario catalog, whose module graph is closed over `define.mjs` and
// `fixtures.mjs` and contains no bare specifier, so it runs without `benchmarks/node_modules` —
// `benchmarks/` is installed separately with `--ignore-workspace` and its libraries may be absent.

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
		step: 'toSafeNumber',
		reason: 'No pinned competitor converts a bigint to a number under a range guard. `z.coerce.number()` accepts a bigint but answers `Number(2n ** 60n)` as 1152921504606847000 with silent precision loss where this step rejects, and Valibot\'s `safeInteger` validates a number instead of converting one, so a row would compare opposite decisions.',
	},
]

// Long enough that a placeholder such as `no equivalent` cannot pass, short enough that the check
// is about shape rather than about wording.
const minimumReasonLength = 60

const root = process.cwd()
const stepsRoot = path.join(root, 'packages/internal/src/steps')
const catalogEntry = path.join(root, 'benchmarks/src/scenarios/index.mjs')
const errors: string[] = []

/** Every built-in step's public name, from the `Meta` block that declares it. */
function declaredStepNames(): Set<string> {
	const names = new Set<string>()

	for (const directory of fs.readdirSync(stepsRoot)) {
		const mainFile = path.join(stepsRoot, directory, `${directory}.ts`)
		if (!fs.existsSync(mainFile))
			continue

		const declaredName = /^\tName: '([^']+)'/m.exec(fs.readFileSync(mainFile, 'utf8'))?.[1]
		if (declaredName != null)
			names.add(declaredName)
	}

	return names
}

interface CatalogEntry {
	id: string
	steps: string[]
}

const { getScenarioCatalog } = await import(pathToFileURL(catalogEntry).href) as {
	getScenarioCatalog: (mode: string) => CatalogEntry[]
}

const declared = declaredStepNames()
// `full` is the whole suite: the sampling tier decides how often a scenario runs, not whether it
// exists, so a step covered only by a full-tier scenario is covered.
const scenarios = getScenarioCatalog('full')

/** Each covered step, with one scenario that names it, for the staleness message. */
const covered = new Map<string, string>()
for (const scenario of scenarios) {
	for (const step of scenario.steps) {
		if (!declared.has(step)) {
			errors.push(`benchmarks: scenario '${scenario.id}' declares the step '${step}', which is not a built-in step name. Fix the spelling in its \`steps\`, or the step it means stays uncovered.`)
			continue
		}
		if (!covered.has(step))
			covered.set(step, scenario.id)
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
		errors.push(`scripts/check-benchmark-coverage.ts: the allowlist entry for '${exemption.step}' is stale — scenario '${coveringScenario}' covers it. Remove the entry.`)
}

for (const step of [...declared].sort()) {
	if (covered.has(step) || exempted.has(step))
		continue
	errors.push(`packages/internal/src/steps/${step}: no cross-library benchmark scenario names '${step}' in its \`steps\`. Add a scenario that exercises it, or allowlist it in scripts/check-benchmark-coverage.ts with the reason no competitor can express it.`)
}

if (errors.length > 0) {
	console.error(errors.join('\n'))
	process.exitCode = 1
}
else {
	console.log(`Cross-library benchmark step coverage is complete: ${covered.size} of ${declared.size} built-in steps across ${scenarios.length} scenarios, ${exemptions.length} allowlisted.`)
}
