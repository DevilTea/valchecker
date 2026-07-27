// `file/*`: Zod 3 has no file schema, so both scenarios declare the `file`
// required feature and that adapter is skipped with a stated reason.
import { warm } from './define.mjs'

const fileInputs = {
	valid: new File(['benchmark payload'], 'payload.txt', { type: 'text/plain' }),
	invalidType: 'payload.txt',
}

const fileSteps = ['file']

export const fileScenarios = [
	warm('file/valid', 'standard', 'file', fileInputs.valid, { success: true, output: fileInputs.valid }, { requiredFeatures: ['file'], steps: fileSteps }),
	warm('file/invalid-type', 'full', 'file', fileInputs.invalidType, { success: false }, { requiredFeatures: ['file'], steps: fileSteps }),
]
