// `transform/*`: a string pipeline whose output differs from its input, so the
// scenario verifies the transformed value and not only the result state.
import { warm } from './define.mjs'

const transformInputs = {
	valid: '  Alice  ',
	invalid: 42,
	output: 'user:alice',
}

// `v.string().toTrimmed().toLowercase().transform(...)`
const transformSteps = ['string', 'toTrimmed', 'toLowercase', 'transform']

export const transformScenarios = [
	warm('transform/valid', 'smoke', 'transform', transformInputs.valid, {
		success: true,
		output: transformInputs.output,
	}, { steps: transformSteps }),
	warm('transform/invalid-type', 'standard', 'transform', transformInputs.invalid, { success: false }, { steps: transformSteps }),
]
