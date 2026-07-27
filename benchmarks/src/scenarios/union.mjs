// `union/*`: a five-branch discriminated union matched at the first, middle, and
// last branch, plus an input no branch accepts.
import { unionInputs } from '../fixtures.mjs'
import { warm, warmPool } from './define.mjs'

const unionFirstPool = Array.from({ length: 64 }, (_, index) => ({
	type: 'text',
	value: `value-${index}`,
}))

// `v.union([v.object({ type: v.literal('text'), ... }), ...])`
const unionSteps = ['union', 'object', 'literal', 'string', 'number', 'boolean']

export const unionScenarios = [
	warm('union/first', 'smoke', 'union', unionInputs.first, { success: true }, { steps: unionSteps }),
	warmPool('union/first-rotating', 'standard', 'union', unionFirstPool, { success: true }, { steps: unionSteps }),
	warm('union/middle', 'standard', 'union', unionInputs.middle, { success: true }, { steps: unionSteps }),
	warm('union/last', 'standard', 'union', unionInputs.last, { success: true }, { steps: unionSteps }),
	warm('union/all-fail', 'standard', 'union', unionInputs.invalid, { success: false }, { steps: unionSteps }),
]
