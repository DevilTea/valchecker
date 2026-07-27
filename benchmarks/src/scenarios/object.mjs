// `flat-object/*` and `nested-object/*`: a ten-field flat shape (plus its strict
// variant) and a four-level nested shape.
import { flatObject, nestedObject } from '../fixtures.mjs'
import { warm, warmPool } from './define.mjs'

export const flatObjectPool = Array.from({ length: 64 }, (_, index) => ({
	id: `user-${index}`,
	name: `User ${index}`,
	age: 20 + index % 50,
	active: index % 2 === 0,
	role: 'admin',
	email: `user-${index}@example.com`,
	score: index + 0.5,
	verified: index % 3 === 0,
	nickname: `user${index}`,
	attempts: index % 5,
}))

// The adapter's `createFields()` shape. The `nickname: [v.string()]` optional
// field is `object`'s own optional handling rather than a `union` branch — an
// instance registering only `object` and `string` accepts it — so `union` is
// deliberately absent here.
const flatObjectSteps = ['object', 'string', 'number', 'isInteger', 'isAtLeast', 'boolean', 'literal', 'check']
const strictFlatObjectSteps = ['strictObject', 'string', 'number', 'isInteger', 'isAtLeast', 'boolean', 'literal', 'check']
const nestedObjectSteps = ['object', 'string', 'check', 'array']

export const objectScenarios = [
	warm('flat-object/valid', 'smoke', 'flatObject', flatObject.valid, { success: true }, { steps: flatObjectSteps }),
	warmPool('flat-object/valid-rotating', 'standard', 'flatObject', flatObjectPool, { success: true }, { steps: flatObjectSteps }),
	warm('flat-object/invalid-first', 'standard', 'flatObject', flatObject.invalidFirst, { success: false }, { steps: flatObjectSteps }),
	warm('flat-object/invalid-last', 'standard', 'flatObject', flatObject.invalidLast, { success: false }, { steps: flatObjectSteps }),
	warm('flat-object/strict-extra', 'standard', 'strictFlatObject', flatObject.extra, { success: false }, { steps: strictFlatObjectSteps }),

	warm('nested-object/valid', 'standard', 'nestedObject', nestedObject.valid, { success: true }, { steps: nestedObjectSteps }),
	warm('nested-object/invalid-deep', 'standard', 'nestedObject', nestedObject.invalidDeep, { success: false }, { steps: nestedObjectSteps }),
]
