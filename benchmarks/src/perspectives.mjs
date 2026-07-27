/**
 * A validator that compiles each schema into generated code wins warmed
 * scenarios for a reason unrelated to the work every other library does, so a
 * single ranking answers two different questions at once. One run therefore
 * produces two perspectives over the same measurements: one that ranks only
 * interpreted validators, and one that includes the generated-code ones.
 *
 * The split is driven by the adapter's own `capabilities.generatedCode` claim
 * rather than by adapter name, so a run that does not measure a generated-code
 * validator keeps the single undivided ranking it had before.
 */

export const INTERPRETED_PERSPECTIVE = 'interpreted'
export const COMPLETE_PERSPECTIVE = 'complete'

function generatedCodeAdapters(raw) {
	return new Set(raw.libraries
		.filter(library => library.capabilities?.generatedCode === true)
		.map(library => library.adapter))
}

/**
 * Returns one perspective when the run measured no generated-code validator (or
 * nothing would be left after excluding them), and two otherwise. A perspective
 * with `adapters === null` includes every measured library.
 */
export function reportPerspectives(raw) {
	const generated = generatedCodeAdapters(raw)
	const interpreted = raw.libraries.filter(library => !generated.has(library.adapter))
	if (generated.size === 0 || interpreted.length < 2)
		return [{ key: COMPLETE_PERSPECTIVE, title: null, note: null, adapters: null }]

	const generatedNames = raw.libraries
		.filter(library => generated.has(library.adapter))
		.map(library => library.name)
		.join(', ')

	return [
		{
			key: INTERPRETED_PERSPECTIVE,
			title: 'Interpreted validators only',
			note: `Ranks the libraries that interpret their schemas at execution time. ${generatedNames} compiles each schema into generated code, which is a different execution strategy rather than a faster version of the same work, so it is excluded here and ranked in the next section.`,
			adapters: new Set(interpreted.map(library => library.adapter)),
		},
		{
			key: COMPLETE_PERSPECTIVE,
			title: 'Including generated-code validators',
			note: `Ranks every measured library, including ${generatedNames}. Generated code trades schema-creation and first-execution cost for warmed throughput, so read this section together with the construction and cold groups rather than on its own.`,
			adapters: null,
		},
	]
}

export function perspectiveLibraries(raw, perspective) {
	return perspective.adapters === null
		? raw.libraries
		: raw.libraries.filter(library => perspective.adapters.has(library.adapter))
}

export function isInPerspective(perspective, adapter) {
	return perspective.adapters === null || perspective.adapters.has(adapter)
}
