// `serialization/*`: native JSON text conversion in both directions.
//
// `toJSONValue` remains a compatible-subset comparison because Valchecker exposes
// the native parse as a built-in while Zod reaches the same call through a transform
// closure. `toJSONString` is different after the native-compatibility split: its
// successful behavior is exactly `JSON.stringify(value)`, so the valid row is an
// `equivalent` comparison. The cyclic failure is `library-defaults`: Valchecker
// and Valibot both catch the native `TypeError` and report their own library issue,
// while both Zod pins let that exception escape `safeParse` and are capability-gated
// out of the invalid row.
//
// Loss-preventing preflight is intentionally not represented by these rows. It now
// belongs to `toStrictJSONString()`, for which no pinned competitor exposes the same
// path-aware contract; that step is therefore declared in the benchmark-coverage
// exemption list rather than paired with a hand-written adapter stand-in.
//
// Fixtures stay plain: the valid object has only ordinary JSON data and the invalid
// stringify input is one self-reference, so all participating adapters agree on the
// observable success/failure and no serializer-specific edge case changes the work.
import { warm } from './define.mjs'

function createCyclic() {
	const cyclic = { id: 'resource-1' }
	cyclic.self = cyclic
	return cyclic
}

const inputs = {
	// Plain JSON data: four own enumerable properties, one nested array, no value
	// whose JSON representation the libraries dispute. It is also the expected output
	// of the parse scenario, so the two directions cannot drift apart.
	value: Object.freeze({ id: 'resource-1', tags: ['a', 'b'], size: 42, enabled: true }),
	// The same payload as text, in the key order `JSON.stringify` produces for the
	// object above.
	text: '{"id":"resource-1","tags":["a","b"],"size":42,"enabled":true}',
	// Truncated after a key: a valid string that is not valid JSON.
	invalidText: '{"id":',
	// A self-reference, so it cannot be written as a frozen literal.
	cyclic: createCyclic(),
}

const jsonValueSteps = ['string', 'toJSONValue']
const jsonStringSteps = ['unknown', 'toJSONString']

const subset = 'compatible-subset'
const failureReporting = ['JSON conversion failure reporting']

export const serializationScenarios = [
	warm('serialization/json-value-valid', 'standard', 'jsonValue', inputs.text, { success: true, output: inputs.value }, { comparisonScope: subset, steps: jsonValueSteps }),
	warm('serialization/json-value-invalid', 'full', 'jsonValue', inputs.invalidText, { success: false }, { comparisonScope: subset, requiredFeatures: failureReporting, steps: jsonValueSteps }),

	warm('serialization/json-string-valid', 'standard', 'jsonString', inputs.value, { success: true, output: inputs.text }, { steps: jsonStringSteps }),
	warm('serialization/json-string-invalid', 'full', 'jsonString', inputs.cyclic, { success: false }, { requiredFeatures: failureReporting, steps: jsonStringSteps }),
]
