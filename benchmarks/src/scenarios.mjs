import {
	collectionStructures,
	createInvalidRecords,
	createRecords,
	dateInputs,
	fileInputs,
	flatObject,
	flatObjectPool,
	issuePolicyInputs,
	issuePolicyRecordInput,
	issuePolicyTupleInput,
	membershipInputs,
	nestedObject,
	openRecordEntries,
	optionalHeavy,
	optionalSparsePool,
	primitive,
	recordArrayPool,
	stringFormatInputs,
	templateLiteralInputs,
	transformInputs,
	tupleInputs,
	unionFirstPool,
	unionInputs,
} from './fixtures.mjs'

const tierRank = { smoke: 0, standard: 1, full: 2 }
const explicitIssuePolicies = new Set(['first', 'all'])

function canonicalizeOutput(value) {
	if (value instanceof Map)
		return { type: 'Map', entries: [...value].map(([key, item]) => [canonicalizeOutput(key), canonicalizeOutput(item)]) }
	if (value instanceof Set)
		return { type: 'Set', values: [...value].map(canonicalizeOutput) }
	// A Date has no own enumerable properties, so the generic object branch below
	// would canonicalize every Date to `{}` and compare all of them as equal.
	if (value instanceof Date)
		return { type: 'Date', time: value.getTime() }
	if (Array.isArray(value))
		return value.map(canonicalizeOutput)
	if (value != null && typeof value === 'object') {
		return Object.fromEntries(Object.entries(value)
			.map(([key, item]) => [key, canonicalizeOutput(item)]))
	}
	return value
}

function assertResult(adapter, rawResult, expected) {
	const normalized = adapter.normalize(rawResult)
	if (normalized.success !== expected.success)
		throw new Error(`${adapter.name}: expected success=${expected.success}, received ${normalized.success}`)

	if (expected.output !== undefined) {
		const actual = JSON.stringify(canonicalizeOutput(normalized.output))
		const wanted = JSON.stringify(canonicalizeOutput(expected.output))
		if (actual !== wanted)
			throw new Error(`${adapter.name}: output mismatch. Expected ${wanted}, received ${actual}`)
	}

	if (expected.issueCount !== undefined && normalized.issueCount !== expected.issueCount) {
		throw new Error(`${adapter.name}: expected ${expected.issueCount} issues, received ${normalized.issueCount ?? 'unknown'}`)
	}
}

function benchmarkGroup(category, resultKind, issuePolicy) {
	if (category !== 'warm')
		return category
	if (resultKind === 'success')
		return 'warm/success'
	return `warm/failure/${issuePolicy}`
}

// A feature name exists only for a schema capability that at least one adapter
// genuinely lacks, so an adapter's `capabilities.features` list stays short and
// every entry is a real claim. A scenario that requires a feature is skipped
// with a reason for adapters that do not declare it, rather than approximated
// with a hand-rolled stand-in that would compare different work.
function featureSupportFor(adapter, requiredFeatures) {
	if (requiredFeatures.length === 0)
		return { supported: true, reason: null }
	const supportedFeatures = adapter.capabilities?.features ?? []
	const missing = requiredFeatures.filter(feature => !supportedFeatures.includes(feature))
	return missing.length === 0
		? { supported: true, reason: null }
		: {
				supported: false,
				reason: `${adapter.name} has no benchmark-equivalent ${missing.join(', ')} schema`,
			}
}

function supportFor(adapter, issuePolicy, requiredFeatures) {
	const featureSupport = featureSupportFor(adapter, requiredFeatures)
	if (!featureSupport.supported)
		return featureSupport
	if (!explicitIssuePolicies.has(issuePolicy))
		return { supported: true, reason: null }
	const supportedPolicies = adapter.capabilities?.issuePolicies ?? []
	return supportedPolicies.includes(issuePolicy)
		? { supported: true, reason: null }
		: {
				supported: false,
				reason: `${adapter.name} does not expose a benchmark-equivalent ${issuePolicy}-issue policy`,
			}
}

function defineScenario({
	id,
	category,
	tier,
	buildKey,
	resultKind,
	issuePolicy,
	comparisonScope,
	diagnosticIssueCount,
	requiredFeatures = [],
	createOperation,
}) {
	const group = benchmarkGroup(category, resultKind, issuePolicy)
	return {
		id,
		category,
		tier,
		group,
		resultKind,
		issuePolicy,
		comparisonScope,
		diagnosticIssueCount,
		requiredFeatures,
		buildKey,
		support(adapter) {
			return supportFor(adapter, issuePolicy, requiredFeatures)
		},
		setup(adapter) {
			// A missing build key means the adapter and the scenario disagree about
			// what is supported. Fail loudly instead of letting a forgotten feature
			// declaration silently shrink the compared set.
			if (typeof adapter.build[buildKey] !== 'function') {
				throw new TypeError(
					`${adapter.name} has no build key '${buildKey}' required by scenario '${id}'. `
					+ 'Add the build, or declare the missing capability with requiredFeatures.',
				)
			}
			return createOperation(adapter, { issuePolicy, comparisonScope, resultKind })
		},
	}
}

function construction(id, tier, buildKey, correctnessInput, expected = { success: true }, options = {}) {
	return defineScenario({
		id,
		category: 'construction',
		tier,
		buildKey,
		resultKind: expected.success ? 'success' : 'failure',
		issuePolicy: options.issuePolicy ?? 'not-applicable',
		comparisonScope: options.comparisonScope ?? 'equivalent',
		diagnosticIssueCount: expected.issueCount ?? null,
		requiredFeatures: options.requiredFeatures,
		createOperation(adapter, context) {
			const verifySchema = adapter.build[buildKey](context)
			assertResult(adapter, adapter.parse(verifySchema, correctnessInput, context), expected)
			return () => adapter.build[buildKey](context)
		},
	})
}

function cold(id, tier, buildKey, input, expected, options = {}) {
	return defineScenario({
		id,
		category: 'cold',
		tier,
		buildKey,
		resultKind: expected.success ? 'success' : 'failure',
		issuePolicy: options.issuePolicy ?? (expected.success ? 'not-applicable' : 'library-default'),
		comparisonScope: options.comparisonScope ?? (expected.success ? 'equivalent' : 'library-defaults'),
		diagnosticIssueCount: expected.issueCount ?? null,
		requiredFeatures: options.requiredFeatures,
		createOperation(adapter, context) {
			const operation = () => adapter.parse(adapter.build[buildKey](context), input, context)
			assertResult(adapter, operation(), expected)
			return operation
		},
	})
}

function warm(id, tier, buildKey, input, expected, options = {}) {
	return defineScenario({
		id,
		category: 'warm',
		tier,
		buildKey,
		resultKind: expected.success ? 'success' : 'failure',
		issuePolicy: options.issuePolicy ?? (expected.success ? 'not-applicable' : 'library-default'),
		comparisonScope: options.comparisonScope ?? (expected.success ? 'equivalent' : 'library-defaults'),
		diagnosticIssueCount: expected.issueCount ?? null,
		requiredFeatures: options.requiredFeatures,
		createOperation(adapter, context) {
			const schema = adapter.build[buildKey](context)
			const operation = () => adapter.parse(schema, input, context)
			assertResult(adapter, operation(), expected)
			return operation
		},
	})
}

function warmPool(id, tier, buildKey, inputs, expected, options = {}) {
	return defineScenario({
		id,
		category: 'warm',
		tier,
		buildKey,
		resultKind: expected.success ? 'success' : 'failure',
		issuePolicy: options.issuePolicy ?? (expected.success ? 'not-applicable' : 'library-default'),
		comparisonScope: options.comparisonScope ?? (expected.success ? 'equivalent' : 'library-defaults'),
		diagnosticIssueCount: expected.issueCount ?? null,
		requiredFeatures: options.requiredFeatures,
		createOperation(adapter, context) {
			const schema = adapter.build[buildKey](context)
			for (const input of inputs)
				assertResult(adapter, adapter.parse(schema, input, context), expected)
			let index = 0
			return () => {
				const input = inputs[index % inputs.length]
				index++
				return adapter.parse(schema, input, context)
			}
		},
	})
}

function issuePolicyPair(structure, buildKey, input, options = {}) {
	const comparisonScope = options.comparisonScope ?? 'equivalent'
	const allIssueCount = options.allIssueCount ?? 2
	const tier = options.tier ?? 'standard'
	return [
		warm(
			`issue-policy/${structure}/invalid/first`,
			tier,
			buildKey,
			input,
			{ success: false, issueCount: 1 },
			{ issuePolicy: 'first', comparisonScope, requiredFeatures: options.requiredFeatures },
		),
		warm(
			`issue-policy/${structure}/invalid/all`,
			tier,
			buildKey,
			input,
			{ success: false, issueCount: allIssueCount },
			{ issuePolicy: 'all', comparisonScope, requiredFeatures: options.requiredFeatures },
		),
	]
}

const records10 = createRecords(10)
const records100 = createRecords(100)
const records1000 = createRecords(1000)

const allScenarios = [
	construction('construct/primitive', 'smoke', 'primitive', primitive.valid),
	construction('construct/flat-object', 'standard', 'flatObject', flatObject.valid),
	construction('construct/nested-object', 'standard', 'nestedObject', nestedObject.valid),
	construction('construct/union', 'standard', 'union', unionInputs.first),
	construction('construct/set', 'standard', 'set', collectionStructures.set100, { success: true, output: collectionStructures.set100 }),
	construction('construct/map', 'standard', 'map', collectionStructures.map100, { success: true, output: collectionStructures.map100 }),
	construction('construct/intersection', 'standard', 'intersection', collectionStructures.intersection, { success: true, output: collectionStructures.intersection }, { comparisonScope: 'compatible-subset' }),

	cold('cold/flat-valid', 'smoke', 'flatObject', flatObject.valid, { success: true }),
	cold('cold/nested-valid', 'standard', 'nestedObject', nestedObject.valid, { success: true }),
	cold('cold/union-last', 'standard', 'union', unionInputs.last, { success: true }),
	cold('cold/set-valid', 'standard', 'set', collectionStructures.set100, { success: true, output: collectionStructures.set100 }),
	cold('cold/map-valid', 'standard', 'map', collectionStructures.map100, { success: true, output: collectionStructures.map100 }),
	cold('cold/intersection-valid', 'standard', 'intersection', collectionStructures.intersection, { success: true, output: collectionStructures.intersection }, { comparisonScope: 'compatible-subset' }),

	warm('primitive/valid', 'smoke', 'primitive', primitive.valid, { success: true }),
	warm('primitive/invalid-type', 'standard', 'primitive', primitive.invalidEarly, { success: false }),
	warm('primitive/invalid-late', 'standard', 'primitive', primitive.invalidLate, { success: false }),

	warm('flat-object/valid', 'smoke', 'flatObject', flatObject.valid, { success: true }),
	warmPool('flat-object/valid-rotating', 'standard', 'flatObject', flatObjectPool, { success: true }),
	warm('flat-object/invalid-first', 'standard', 'flatObject', flatObject.invalidFirst, { success: false }),
	warm('flat-object/invalid-last', 'standard', 'flatObject', flatObject.invalidLast, { success: false }),
	warm('flat-object/strict-extra', 'standard', 'strictFlatObject', flatObject.extra, { success: false }),

	warm('nested-object/valid', 'standard', 'nestedObject', nestedObject.valid, { success: true }),
	warm('nested-object/invalid-deep', 'standard', 'nestedObject', nestedObject.invalidDeep, { success: false }),

	warm('array/10-valid', 'smoke', 'recordArray', records10, { success: true }),
	warmPool('array/10-valid-rotating', 'standard', 'recordArray', recordArrayPool, { success: true }),
	warm('array/100-valid', 'standard', 'recordArray', records100, { success: true }),
	warm('array/1000-valid', 'full', 'recordArray', records1000, { success: true }),
	warm('array/100-invalid-first', 'standard', 'recordArray', createInvalidRecords(100, 0), { success: false }),
	warm('array/100-invalid-last', 'standard', 'recordArray', createInvalidRecords(100, 99), { success: false }),
	warm('array/1000-invalid-last', 'full', 'recordArray', createInvalidRecords(1000, 999), { success: false }),

	warm('set/100-valid', 'standard', 'set', collectionStructures.set100, { success: true, output: collectionStructures.set100 }),
	warm('map/100-valid', 'standard', 'map', collectionStructures.map100, { success: true, output: collectionStructures.map100 }),
	warm('intersection/valid', 'standard', 'intersection', collectionStructures.intersection, { success: true, output: collectionStructures.intersection }, { comparisonScope: 'compatible-subset' }),

	warm('union/first', 'smoke', 'union', unionInputs.first, { success: true }),
	warmPool('union/first-rotating', 'standard', 'union', unionFirstPool, { success: true }),
	warm('union/middle', 'standard', 'union', unionInputs.middle, { success: true }),
	warm('union/last', 'standard', 'union', unionInputs.last, { success: true }),
	warm('union/all-fail', 'standard', 'union', unionInputs.invalid, { success: false }),

	warm('transform/valid', 'smoke', 'transform', transformInputs.valid, {
		success: true,
		output: transformInputs.output,
	}),
	warm('transform/invalid-type', 'standard', 'transform', transformInputs.invalid, { success: false }),

	warm('optional-heavy/sparse', 'standard', 'optionalHeavy', optionalHeavy.sparse, { success: true }),
	warmPool('optional-heavy/sparse-rotating', 'standard', 'optionalHeavy', optionalSparsePool, { success: true }),
	warm('optional-heavy/full', 'standard', 'optionalHeavy', optionalHeavy.full, { success: true }),
	warm('optional-heavy/invalid', 'standard', 'optionalHeavy', optionalHeavy.invalid, { success: false }),

	...issuePolicyPair('object', 'issuePolicyObject', issuePolicyInputs.object, { tier: 'smoke' }),
	...issuePolicyPair('strict-object', 'issuePolicyStrictObject', issuePolicyInputs.strictObject, { allIssueCount: 3 }),
	...issuePolicyPair('loose-object', 'issuePolicyLooseObject', issuePolicyInputs.looseObject),
	...issuePolicyPair('array', 'issuePolicyArray', issuePolicyInputs.array),
	...issuePolicyPair('set', 'issuePolicySet', issuePolicyInputs.set),
	...issuePolicyPair('map', 'issuePolicyMap', issuePolicyInputs.map),
	...issuePolicyPair('intersection', 'issuePolicyIntersection', issuePolicyInputs.intersection, { comparisonScope: 'compatible-subset' }),

	// Steps that shipped after the scenario set above was written. Added under
	// new ids so every pre-existing scenario stays comparable with the baseline
	// runs cited by the open performance issues. A secondary or failure variant
	// sits at `full` so the standard-tier pull-request gate stays affordable.
	construction('construct/record', 'standard', 'openRecord', openRecordEntries.valid100, { success: true, output: openRecordEntries.valid100 }, { comparisonScope: 'compatible-subset' }),
	construction('construct/tuple', 'standard', 'tuple', tupleInputs.valid, { success: true, output: tupleInputs.valid }, { comparisonScope: 'compatible-subset' }),
	construction('construct/template-literal', 'standard', 'templateLiteral', templateLiteralInputs.valid, { success: true, output: templateLiteralInputs.valid }, { comparisonScope: 'compatible-subset', requiredFeatures: ['template literal'] }),

	cold('cold/record-valid', 'standard', 'openRecord', openRecordEntries.valid100, { success: true, output: openRecordEntries.valid100 }, { comparisonScope: 'compatible-subset' }),
	cold('cold/tuple-valid', 'standard', 'tuple', tupleInputs.valid, { success: true, output: tupleInputs.valid }, { comparisonScope: 'compatible-subset' }),

	// Valchecker's open `record` maintains a transformed-key uniqueness Map that
	// neither Zod nor Valibot has, and its tuple rest region is a nested array
	// schema rather than an in-place loop. Both are real costs of the shipped
	// API, so the scope is a compatible subset rather than identical work.
	warm('record/100-valid', 'standard', 'openRecord', openRecordEntries.valid100, { success: true, output: openRecordEntries.valid100 }, { comparisonScope: 'compatible-subset' }),
	warm('record/1000-valid', 'full', 'openRecord', openRecordEntries.valid1000, { success: true, output: openRecordEntries.valid1000 }, { comparisonScope: 'compatible-subset' }),
	warm('record/100-invalid-first', 'standard', 'openRecord', openRecordEntries.invalidFirst, { success: false }, { comparisonScope: 'compatible-subset' }),
	warm('record/100-invalid-last', 'full', 'openRecord', openRecordEntries.invalidLast, { success: false }, { comparisonScope: 'compatible-subset' }),

	warm('tuple/valid', 'standard', 'tuple', tupleInputs.valid, { success: true, output: tupleInputs.valid }, { comparisonScope: 'compatible-subset' }),
	warm('tuple/invalid-head', 'standard', 'tuple', tupleInputs.invalidHead, { success: false }, { comparisonScope: 'compatible-subset' }),
	warm('tuple/invalid-rest', 'full', 'tuple', tupleInputs.invalidRest, { success: false }, { comparisonScope: 'compatible-subset' }),
	warm('tuple/too-short', 'full', 'tuple', tupleInputs.tooShort, { success: false }, { comparisonScope: 'compatible-subset' }),

	// Valchecker matches the TypeScript checker's template-literal grammar while
	// Zod 4 applies one regex, so the accepted sets diverge outside the fixtures.
	warm('template-literal/valid', 'standard', 'templateLiteral', templateLiteralInputs.valid, { success: true, output: templateLiteralInputs.valid }, { comparisonScope: 'compatible-subset', requiredFeatures: ['template literal'] }),
	warm('template-literal/invalid', 'full', 'templateLiteral', templateLiteralInputs.invalid, { success: false }, { comparisonScope: 'compatible-subset', requiredFeatures: ['template literal'] }),

	warm('date/valid', 'standard', 'date', dateInputs.valid, { success: true, output: dateInputs.validOutput }),
	warm('date/invalid-type', 'full', 'date', dateInputs.invalidType, { success: false }),
	// `z.coerce.date()` performs no input type check at all, so the Zod cells are
	// a lower bound rather than the same work.
	warm('date/from-string', 'standard', 'dateFromString', dateInputs.fromStringInput, { success: true, output: dateInputs.fromStringOutput }, { comparisonScope: 'compatible-subset' }),
	warm('date/from-unparseable-string', 'full', 'dateFromString', dateInputs.unparseableString, { success: false }, { comparisonScope: 'compatible-subset' }),
	// `isAfter`/`isBefore` are strict; `z.date().min/max` and `minValue`/`maxValue`
	// are inclusive, so the accepted sets differ at the bound itself even though
	// the fixtures agree and the compared work is one comparison per bound.
	warm('date/bounds-valid', 'standard', 'dateBounds', dateInputs.insideBounds, { success: true, output: dateInputs.insideBoundsOutput }, { comparisonScope: 'compatible-subset' }),
	warm('date/bounds-invalid', 'full', 'dateBounds', dateInputs.outsideBounds, { success: false }, { comparisonScope: 'compatible-subset' }),

	warm('file/valid', 'standard', 'file', fileInputs.valid, { success: true, output: fileInputs.valid }, { requiredFeatures: ['file'] }),
	warm('file/invalid-type', 'full', 'file', fileInputs.invalidType, { success: false }, { requiredFeatures: ['file'] }),

	// Each library ships its own accepted set for these formats, so the scope is
	// a compatible subset: the fixtures are accepted (or rejected) by all of them.
	warm('string-format/email-valid', 'standard', 'formatEmail', stringFormatInputs.email, { success: true, output: stringFormatInputs.email }, { comparisonScope: 'compatible-subset' }),
	warm('string-format/email-invalid', 'standard', 'formatEmail', stringFormatInputs.invalidEmail, { success: false }, { comparisonScope: 'compatible-subset' }),
	warm('string-format/uuid-valid', 'standard', 'formatUuid', stringFormatInputs.uuid, { success: true, output: stringFormatInputs.uuid }, { comparisonScope: 'compatible-subset' }),
	warm('string-format/uuid-invalid', 'full', 'formatUuid', stringFormatInputs.invalidUuid, { success: false }, { comparisonScope: 'compatible-subset' }),
	warm('string-format/iso-date-time-valid', 'standard', 'formatIsoDateTime', stringFormatInputs.isoDateTime, { success: true, output: stringFormatInputs.isoDateTime }, { comparisonScope: 'compatible-subset' }),
	warm('string-format/iso-date-time-invalid', 'full', 'formatIsoDateTime', stringFormatInputs.invalidIsoDateTime, { success: false }, { comparisonScope: 'compatible-subset' }),

	// The pre-existing flat-object scenarios model the email field with a
	// `check()` closure because no format validator existed when they were
	// written, which understates today's idiomatic Valchecker. This variant keeps
	// the same validation semantics and every competitor schema unchanged, and
	// only spells the Valchecker side the way a user would write it now.
	warm('flat-object-builtin/valid', 'standard', 'builtinFlatObject', flatObject.valid, { success: true }, { comparisonScope: 'compatible-subset' }),
	warm('flat-object-builtin/invalid-last', 'full', 'builtinFlatObject', flatObject.invalidLast, { success: false }, { comparisonScope: 'compatible-subset' }),

	// Valchecker validates the string and then membership; the competitors
	// dispatch a single enum/picklist check. The benchmark deliberately measures
	// the `string().isOneOf()` chain, which is both idiomatic and faster here
	// than the single-step `union([...])` shorthand.
	warm('membership/valid', 'standard', 'membership', membershipInputs.valid, { success: true, output: membershipInputs.valid }, { comparisonScope: 'compatible-subset' }),
	warm('membership/invalid', 'full', 'membership', membershipInputs.invalid, { success: false }, { comparisonScope: 'compatible-subset' }),

	...issuePolicyPair('record', 'issuePolicyRecord', issuePolicyRecordInput, { comparisonScope: 'compatible-subset' }),
	...issuePolicyPair('tuple', 'issuePolicyTuple', issuePolicyTupleInput, { comparisonScope: 'compatible-subset' }),
]

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
	}
}

export function getScenarioCatalog(mode) {
	return getScenarios(mode)
		.map(toCatalogEntry)
}

export function toScenarioCatalog(scenarios) {
	return scenarios.map(toCatalogEntry)
}
