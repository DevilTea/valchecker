// `file-mime-type/*`: a MIME-type check over a `File`. `isMimeType` reads a
// value's own `type` string rather than validating a string, so it belongs with
// the file family and not with `string-format/*`. Zod 3 has no file schema, so
// both scenarios declare the existing `file` feature and that adapter is skipped
// with a stated reason.
//
// The scope stays `equivalent`: all three participants compare the bare
// `type/subtype` against a one-entry allow-list, and although Valchecker matches
// case-insensitively and supports a `image/*` wildcard, neither can diverge here
// because `File` lowercases `type` at construction and the pattern is exact.
import { warm } from './define.mjs'

const fileMimeTypeInputs = {
	valid: new File(['benchmark payload'], 'payload.png', { type: 'image/png' }),
	// A `File`, so the failure is the MIME type under test and not the input kind.
	invalidMimeType: new File(['benchmark payload'], 'payload.txt', { type: 'text/plain' }),
}

const fileMimeTypeSteps = ['file', 'isMimeType']

export const fileMimeTypeScenarios = [
	warm('file-mime-type/valid', 'standard', 'fileMimeType', fileMimeTypeInputs.valid, { success: true, output: fileMimeTypeInputs.valid }, { requiredFeatures: ['file'], steps: fileMimeTypeSteps }),
	warm('file-mime-type/invalid-mime-type', 'full', 'fileMimeType', fileMimeTypeInputs.invalidMimeType, { success: false }, { requiredFeatures: ['file'], steps: fileMimeTypeSteps }),
]
