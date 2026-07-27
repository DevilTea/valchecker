// `string-shape/*`: the string case and shape transformations. `transform/*`
// already measures a three-step chain that includes `toTrimmed` and `toLowercase`,
// but it measures them together with a closure; these scenarios measure one
// transformation each, which is how the rest of the suite treats a single built-in.
//
// Two of the four are gated. Neither Zod pin has a one-sided trim, and Zod 3 has
// no `normalize()` at all — verified by reading the live `z.string()` instance
// rather than the version string, so the adapter cannot claim a method it lacks.
// Every participant spells its transformation as a built-in, so each scenario is
// `equivalent` and the outputs were confirmed identical, including the normalized
// one, where all three participants produce the same composed string.
//
// The family has no failure scenario, because none of these four steps can fail:
// each is one `String.prototype` call. Their only failure is the `v.string()` check
// in front of them, and the suite measures that twice already —
// `primitive/invalid-type` and, in front of a transformation chain,
// `transform/invalid-type`. A third and fourth copy would measure the same work
// under a new name.
import { warm } from './define.mjs'

const inputs = {
	// Mixed case with whitespace at both ends, so one value serves the uppercase and
	// both trim scenarios and each one's output shows which end it touched.
	padded: '  Ada Lovelace  ',
	// `e` followed by U+0301 COMBINING ACUTE ACCENT: 15 code units that NFC composes
	// into the 14 of `Amélie Poulain`. A string that is already composed would make
	// the scenario measure a normalization that changes nothing.
	decomposed: 'Ame\u0301lie Poulain',
}

const uppercaseSteps = ['string', 'toUppercase']
const trimmedStartSteps = ['string', 'toTrimmedStart']
const trimmedEndSteps = ['string', 'toTrimmedEnd']
const normalizedSteps = ['string', 'toNormalized']

const oneSidedTrim = ['one-sided trim']
const unicodeNormalization = ['Unicode normalization']

export const stringShapeScenarios = [
	warm('string-shape/uppercase-valid', 'standard', 'shapeUppercase', inputs.padded, { success: true, output: '  ADA LOVELACE  ' }, { steps: uppercaseSteps }),
	warm('string-shape/trimmed-start-valid', 'standard', 'shapeTrimmedStart', inputs.padded, { success: true, output: 'Ada Lovelace  ' }, { requiredFeatures: oneSidedTrim, steps: trimmedStartSteps }),
	warm('string-shape/trimmed-end-valid', 'standard', 'shapeTrimmedEnd', inputs.padded, { success: true, output: '  Ada Lovelace' }, { requiredFeatures: oneSidedTrim, steps: trimmedEndSteps }),
	warm('string-shape/normalized-valid', 'standard', 'shapeNormalized', inputs.decomposed, { success: true, output: 'Am\u00E9lie Poulain' }, { requiredFeatures: unicodeNormalization, steps: normalizedSteps }),
]
