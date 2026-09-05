// `construct/*` and `cold/*` for the families that already existed when the
// suite was written. Construction and cold execution are benchmark groups
// rather than schema families, so they stay together in one module: moving each
// one next to its family would reorder the report without changing what is
// measured. The later-wave families keep their own construct/cold cases in
// `record-tuple-template-literal.mjs` for the same reason — that is where they
// sit in the report today.
import { collectionStructures, flatObject, nestedObject, primitive, unionInputs } from '../fixtures.mjs'
import { cold, construction } from './define.mjs'

const primitiveSteps = ['string', 'isLengthAtLeast', 'isLengthAtMost', 'check']
const flatObjectSteps = ['object', 'string', 'number', 'isInteger', 'isAtLeast', 'boolean', 'literal', 'check']
const nestedObjectSteps = ['object', 'string', 'check', 'array']
const unionSteps = ['union', 'object', 'literal', 'string', 'number', 'boolean']
const setSteps = ['set', 'string']
const mapSteps = ['map', 'string', 'number']
const intersectionSteps = ['intersection', 'object', 'string', 'number']

const primitiveComparisonNote = 'Valchecker uses a `check()` closure for the primitive pattern where competitors use built-in regex actions; the construction/cold row shares the same executable observable contract as the warm primitive family.'
const flatObjectComparisonNote = 'Valchecker uses a `check()` closure for the flat object\'s email predicate where competitors use built-in regex actions; the construction/cold row shares the same executable observable contract as the warm flat-object family.'
const nestedObjectComparisonNote = 'Valchecker uses callback constraints inside the nested object where competitors use built-in regex/length actions; executable conformance establishes the shared observable contract.'

export const lifecycleScenarios = [
	construction('construct/primitive', 'smoke', 'primitive', primitive.valid, { success: true }, { comparisonNote: primitiveComparisonNote, steps: primitiveSteps }),
	construction('construct/flat-object', 'standard', 'flatObject', flatObject.valid, { success: true }, { comparisonNote: flatObjectComparisonNote, steps: flatObjectSteps }),
	construction('construct/nested-object', 'standard', 'nestedObject', nestedObject.valid, { success: true }, { comparisonNote: nestedObjectComparisonNote, steps: nestedObjectSteps }),
	construction('construct/union', 'standard', 'union', unionInputs.first, { success: true }, { steps: unionSteps }),
	construction('construct/set', 'standard', 'set', collectionStructures.set100, { success: true, output: collectionStructures.set100 }, { steps: setSteps }),
	construction('construct/map', 'standard', 'map', collectionStructures.map100, { success: true, output: collectionStructures.map100 }, { steps: mapSteps }),
	construction('construct/intersection', 'standard', 'intersection', collectionStructures.intersection, { success: true, output: collectionStructures.intersection }, { comparisonScope: 'compatible-subset', steps: intersectionSteps }),

	cold('cold/flat-valid', 'smoke', 'flatObject', flatObject.valid, { success: true }, { comparisonNote: flatObjectComparisonNote, steps: flatObjectSteps }),
	cold('cold/nested-valid', 'standard', 'nestedObject', nestedObject.valid, { success: true }, { comparisonNote: nestedObjectComparisonNote, steps: nestedObjectSteps }),
	cold('cold/union-last', 'standard', 'union', unionInputs.last, { success: true }, { steps: unionSteps }),
	cold('cold/set-valid', 'standard', 'set', collectionStructures.set100, { success: true, output: collectionStructures.set100 }, { steps: setSteps }),
	cold('cold/map-valid', 'standard', 'map', collectionStructures.map100, { success: true, output: collectionStructures.map100 }, { steps: mapSteps }),
	cold('cold/intersection-valid', 'standard', 'intersection', collectionStructures.intersection, { success: true, output: collectionStructures.intersection }, { comparisonScope: 'compatible-subset', steps: intersectionSteps }),
]
