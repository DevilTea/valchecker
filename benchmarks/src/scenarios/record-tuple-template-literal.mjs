// `record/*`, `tuple/*`, and `template-literal/*`, together with their own
// `construct/*` and `cold/*` cases. The three families share this module because
// their construction and cold cases interleave in the report; splitting them per
// family would reorder it. See `registry.mjs` for why these families sit after
// `issue-policy/*` rather than next to the other structural families.
import { cold, construction, warm } from './define.mjs'

function createOpenRecordEntries(length, invalidKey) {
	const entries = {}
	for (let index = 0; index < length; index++)
		entries[`item-${index}`] = index
	if (invalidKey !== undefined)
		entries[invalidKey] = 'invalid'
	return entries
}

const openRecordEntries = {
	valid100: Object.freeze(createOpenRecordEntries(100)),
	valid1000: Object.freeze(createOpenRecordEntries(1000)),
	invalidFirst: Object.freeze(createOpenRecordEntries(100, 'item-0')),
	invalidLast: Object.freeze(createOpenRecordEntries(100, 'item-99')),
}

// `[string, number, ...boolean[]]`: a fixed head plus a rest region, so the
// scenario measures per-position dispatch and variadic iteration together.
const tupleInputs = {
	valid: Object.freeze(['head', 1, true, false, true]),
	invalidHead: Object.freeze([0, 1, true, false, true]),
	invalidRest: Object.freeze(['head', 1, true, 'invalid', true]),
	tooShort: Object.freeze(['head']),
}

// `${number}px | ${number}em | ${number}rem`.
const templateLiteralInputs = {
	valid: '1280px',
	invalid: '1280pt',
}

const openRecordSteps = ['record', 'string', 'number']
const tupleSteps = ['tuple', 'string', 'number', 'array', 'boolean']
// `v.templateLiteral([v.number(), v.union(['px', 'em', 'rem'])])`. The raw
// string branches are `union` shorthand that resolves to `literal` initial
// schemas, and the schema fails to build on an instance without `literal`
// registered, so `literal` is a real dependency of this chain.
const templateLiteralSteps = ['templateLiteral', 'number', 'union', 'literal']

export const recordTupleTemplateLiteralScenarios = [
	construction('construct/record', 'standard', 'openRecord', openRecordEntries.valid100, { success: true, output: openRecordEntries.valid100 }, { comparisonScope: 'compatible-subset', steps: openRecordSteps }),
	construction('construct/tuple', 'standard', 'tuple', tupleInputs.valid, { success: true, output: tupleInputs.valid }, { comparisonScope: 'compatible-subset', steps: tupleSteps }),
	construction('construct/template-literal', 'standard', 'templateLiteral', templateLiteralInputs.valid, { success: true, output: templateLiteralInputs.valid }, { comparisonScope: 'compatible-subset', requiredFeatures: ['template literal'], steps: templateLiteralSteps }),

	cold('cold/record-valid', 'standard', 'openRecord', openRecordEntries.valid100, { success: true, output: openRecordEntries.valid100 }, { comparisonScope: 'compatible-subset', steps: openRecordSteps }),
	cold('cold/tuple-valid', 'standard', 'tuple', tupleInputs.valid, { success: true, output: tupleInputs.valid }, { comparisonScope: 'compatible-subset', steps: tupleSteps }),

	// Valchecker's open `record` maintains a transformed-key uniqueness Map that
	// neither Zod nor Valibot has, and its tuple rest region is a nested array
	// schema rather than an in-place loop. Both are real costs of the shipped
	// API, so the scope is a compatible subset rather than identical work.
	warm('record/100-valid', 'standard', 'openRecord', openRecordEntries.valid100, { success: true, output: openRecordEntries.valid100 }, { comparisonScope: 'compatible-subset', steps: openRecordSteps }),
	warm('record/1000-valid', 'full', 'openRecord', openRecordEntries.valid1000, { success: true, output: openRecordEntries.valid1000 }, { comparisonScope: 'compatible-subset', steps: openRecordSteps }),
	warm('record/100-invalid-first', 'standard', 'openRecord', openRecordEntries.invalidFirst, { success: false }, { comparisonScope: 'compatible-subset', steps: openRecordSteps }),
	warm('record/100-invalid-last', 'full', 'openRecord', openRecordEntries.invalidLast, { success: false }, { comparisonScope: 'compatible-subset', steps: openRecordSteps }),

	warm('tuple/valid', 'standard', 'tuple', tupleInputs.valid, { success: true, output: tupleInputs.valid }, { comparisonScope: 'compatible-subset', steps: tupleSteps }),
	warm('tuple/invalid-head', 'standard', 'tuple', tupleInputs.invalidHead, { success: false }, { comparisonScope: 'compatible-subset', steps: tupleSteps }),
	warm('tuple/invalid-rest', 'full', 'tuple', tupleInputs.invalidRest, { success: false }, { comparisonScope: 'compatible-subset', steps: tupleSteps }),
	warm('tuple/too-short', 'full', 'tuple', tupleInputs.tooShort, { success: false }, { comparisonScope: 'compatible-subset', steps: tupleSteps }),

	// Valchecker matches the TypeScript checker's template-literal grammar while
	// Zod 4 applies one regex, so the accepted sets diverge outside the fixtures.
	warm('template-literal/valid', 'standard', 'templateLiteral', templateLiteralInputs.valid, { success: true, output: templateLiteralInputs.valid }, { comparisonScope: 'compatible-subset', requiredFeatures: ['template literal'], steps: templateLiteralSteps }),
	warm('template-literal/invalid', 'full', 'templateLiteral', templateLiteralInputs.invalid, { success: false }, { comparisonScope: 'compatible-subset', requiredFeatures: ['template literal'], steps: templateLiteralSteps }),
]
