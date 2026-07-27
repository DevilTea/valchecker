// `date/*`: Date validation, string-to-Date conversion, and strict bounds.
// The bound values themselves live in the shared fixtures because every adapter
// imports them.
import { warm } from './define.mjs'

// Input and expected-output Dates are distinct instances: `Object.freeze` cannot
// protect a Date's internal slot, so sharing one instance between the input and
// the expectation would make an adapter that mutated it silently self-consistent.
const dateInputs = {
	valid: new Date('2024-03-05T08:09:10.123Z'),
	validOutput: new Date('2024-03-05T08:09:10.123Z'),
	invalidType: '2024-03-05T08:09:10.123Z',
	fromStringInput: '2024-03-05T08:09:10.123Z',
	fromStringOutput: new Date('2024-03-05T08:09:10.123Z'),
	unparseableString: 'not-a-date',
	insideBounds: new Date('2024-03-05T08:09:10.123Z'),
	insideBoundsOutput: new Date('2024-03-05T08:09:10.123Z'),
	outsideBounds: new Date('2019-01-01T00:00:00.000Z'),
}

const dateSteps = ['date']
const dateFromStringSteps = ['string', 'toDate']
const dateBoundsSteps = ['date', 'isAfter', 'isBefore']

export const dateScenarios = [
	warm('date/valid', 'standard', 'date', dateInputs.valid, { success: true, output: dateInputs.validOutput }, { steps: dateSteps }),
	warm('date/invalid-type', 'full', 'date', dateInputs.invalidType, { success: false }, { steps: dateSteps }),
	// `z.coerce.date()` performs no input type check at all, so the Zod cells are
	// a lower bound rather than the same work.
	warm('date/from-string', 'standard', 'dateFromString', dateInputs.fromStringInput, { success: true, output: dateInputs.fromStringOutput }, { comparisonScope: 'compatible-subset', steps: dateFromStringSteps }),
	warm('date/from-unparseable-string', 'full', 'dateFromString', dateInputs.unparseableString, { success: false }, { comparisonScope: 'compatible-subset', steps: dateFromStringSteps }),
	// `isAfter`/`isBefore` are strict; `z.date().min/max` and `minValue`/`maxValue`
	// are inclusive, so the accepted sets differ at the bound itself even though
	// the fixtures agree and the compared work is one comparison per bound.
	warm('date/bounds-valid', 'standard', 'dateBounds', dateInputs.insideBounds, { success: true, output: dateInputs.insideBoundsOutput }, { comparisonScope: 'compatible-subset', steps: dateBoundsSteps }),
	warm('date/bounds-invalid', 'full', 'dateBounds', dateInputs.outsideBounds, { success: false }, { comparisonScope: 'compatible-subset', steps: dateBoundsSteps }),
]
