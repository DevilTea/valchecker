// The single ordered list of scenario families. Adding a family means adding one
// module next to this file and one entry to `scenarioFamilies` below. The import
// block is sorted by the lint rule and carries no meaning; `scenarioFamilies` is
// the order that matters.
import { builtinValidatorScenarios } from './builtin-validator.mjs'
import { coercionScenarios } from './coercion.mjs'
import { collectionScenarios } from './collection.mjs'
import { constraintScenarios } from './constraint.mjs'
import { dateScenarios } from './date.mjs'
import { fileMimeTypeScenarios } from './file-mime-type.mjs'
import { fileScenarios } from './file.mjs'
import { issuePolicyRecordTupleScenarios } from './issue-policy-record-tuple.mjs'
import { issuePolicyScenarios } from './issue-policy.mjs'
import { lifecycleScenarios } from './lifecycle.mjs'
import { objectScenarios } from './object.mjs'
import { optionalHeavyScenarios } from './optional-heavy.mjs'
import { primitiveBuiltinScenarios } from './primitive-builtin.mjs'
import { primitiveScenarios } from './primitive.mjs'
import { recordTupleTemplateLiteralScenarios } from './record-tuple-template-literal.mjs'
import { stringFormatExtendedScenarios } from './string-format-extended.mjs'
import { stringFormatScenarios } from './string-format.mjs'
import { stringShapeScenarios } from './string-shape.mjs'
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
]

export const allScenarios = scenarioFamilies.flat()
