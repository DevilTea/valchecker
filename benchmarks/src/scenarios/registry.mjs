// The single ordered list of scenario families. Adding a family means adding one
// module next to this file and one entry to `scenarioFamilies` below. The import
// block is sorted by the lint rule and carries no meaning; `scenarioFamilies` is
// the order that matters.
import { asyncScenarios } from './async.mjs'
import { builtinValidatorScenarios } from './builtin-validator.mjs'
import { coercionScenarios } from './coercion.mjs'
import { collectionTransformScenarios } from './collection-transform.mjs'
import { collectionScenarios } from './collection.mjs'
import { constraintScenarios } from './constraint.mjs'
import { dateScenarios } from './date.mjs'
import { delegationScenarios } from './delegation.mjs'
import { fallbackScenarios } from './fallback.mjs'
import { fileMimeTypeScenarios } from './file-mime-type.mjs'
import { fileScenarios } from './file.mjs'
import { issuePolicyRecordTupleScenarios } from './issue-policy-record-tuple.mjs'
import { issuePolicyScenarios } from './issue-policy.mjs'
import { lifecycleScenarios } from './lifecycle.mjs'
import { nullishScenarios } from './nullish.mjs'
import { objectScenarios } from './object.mjs'
import { optionalHeavyScenarios } from './optional-heavy.mjs'
import { primitiveBuiltinScenarios } from './primitive-builtin.mjs'
import { primitiveScenarios } from './primitive.mjs'
import { recordTupleTemplateLiteralScenarios } from './record-tuple-template-literal.mjs'
import { recursionScenarios } from './recursion.mjs'
import { schemaKindScenarios } from './schema-kind.mjs'
import { serializationScenarios } from './serialization.mjs'
import { standardSchemaScenarios } from './standard-schema.mjs'
import { stringFormatExtendedScenarios } from './string-format-extended.mjs'
import { stringFormatScenarios } from './string-format.mjs'
import { stringShapeScenarios } from './string-shape.mjs'
import { taggedUnionScenarios } from './tagged-union.mjs'
import { transformScenarios } from './transform.mjs'
import { unionScenarios } from './union.mjs'

// Fixed and deliberate: this reproduces the order the scenarios had while they
// lived in one file. Existing scenario ids and their report order are stable —
// the order changes nothing statistically, but changing it churns every report
// diff for no reason.
//
// That is why the list has two waves. The families from
// `recordTupleTemplateLiteralScenarios` onwards cover steps that shipped after
// the families above them were written, and were appended under new ids so every
// pre-existing scenario stays comparable with the baseline runs cited by the open
// performance issues. A family present in both waves therefore has two modules,
// and each family's `construct/*` and `cold/*` cases sit with the wave that
// introduced them.
const scenarioFamilies = [
	lifecycleScenarios,
	primitiveScenarios,
	objectScenarios,
	collectionScenarios,
	unionScenarios,
	transformScenarios,
	optionalHeavyScenarios,
	issuePolicyScenarios,
	recordTupleTemplateLiteralScenarios,
	dateScenarios,
	fileScenarios,
	stringFormatScenarios,
	builtinValidatorScenarios,
	issuePolicyRecordTupleScenarios,
	stringFormatExtendedScenarios,
	fileMimeTypeScenarios,
	constraintScenarios,
	primitiveBuiltinScenarios,
	coercionScenarios,
	stringShapeScenarios,
	taggedUnionScenarios,
	recursionScenarios,
	fallbackScenarios,
	nullishScenarios,
	schemaKindScenarios,
	collectionTransformScenarios,
	serializationScenarios,
	asyncScenarios,
	standardSchemaScenarios,
	delegationScenarios,
]

export const allScenarios = scenarioFamilies.flat()

// `equivalent` is an executable claim, not a label. Every equivalent scenario is
// attached to a small library-neutral contract assembled from the correctness
// fixtures of scenarios that build the same schema under the same issue-policy
// context. One exact successful output and one representative failure are required;
// if a family has no timed row in one direction it supplies that case explicitly via
// `conformanceCases`. The cases are executed through each scenario's own entry point
// before its timed operation is created.
function attachEquivalentConformanceContracts(scenarios) {
	const groups = new Map()
	for (const scenario of scenarios) {
		const group = groups.get(scenario.conformanceKey)
		if (group === undefined)
			groups.set(scenario.conformanceKey, [scenario])
		else
			group.push(scenario)
	}

	const problems = []
	for (const [key, group] of groups) {
		const equivalent = group.filter(scenario => scenario.comparisonScope === 'equivalent')
		if (equivalent.length === 0)
			continue

		const seeds = group.flatMap(scenario => scenario.conformanceSeeds ?? [])
		const exactSuccesses = seeds.filter(({ expected }) => expected.success === true && Object.hasOwn(expected, 'output'))
		const failures = seeds.filter(({ expected }) => expected.success === false)
		const noFailureReasons = new Set(equivalent
			.map(scenario => scenario.conformanceNoFailureReason)
			.filter(reason => typeof reason === 'string' && reason.trim().length > 0))
		const success = exactSuccesses[0]
		const failure = failures[0]
		const noFailureContract = failure === undefined && noFailureReasons.size === 1
		if (success === undefined || (failure === undefined && !noFailureContract)) {
			const missing = [
				success === undefined ? 'an exact success case (`output` must be present, including `output: undefined`)' : null,
				failure === undefined && !noFailureContract ? 'a failure case (or one explicit no-failure reason for a schema with no rejecting input)' : null,
			].filter(Boolean)
				.join(' and ')
			problems.push(`${key}: ${missing}; equivalent scenarios: ${equivalent.map(scenario => scenario.id)
				.join(', ')}`)
			continue
		}
		if (noFailureReasons.size > 1) {
			problems.push(`${key}: equivalent scenarios disagree about why no failure case exists: ${[...noFailureReasons].join(' | ')}`)
			continue
		}

		const cases = failure === undefined ? exactSuccesses : [success, failure]
		for (const scenario of equivalent)
			scenario.conformanceCases = cases
	}

	if (problems.length > 0) {
		throw new TypeError(
			`Equivalent benchmark conformance is incomplete:\n- ${problems.join('\n- ')}\n`
			+ 'Add representative `conformanceCases` to a scenario using that build key instead of weakening the equivalence label.',
		)
	}
}

attachEquivalentConformanceContracts(allScenarios)
