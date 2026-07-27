// `optional-heavy/*`: a sixteen-field configuration object where fourteen fields
// are optional, so the sparse case measures absent-key handling and the full
// case measures the same shape with every field present.
import { warm, warmPool } from './define.mjs'

const optionalHeavy = {
	sparse: Object.freeze({ id: 'config-1', enabled: true }),
	full: Object.freeze({
		id: 'config-1',
		enabled: true,
		name: 'production',
		region: 'eu-west',
		retries: 3,
		timeout: 5000,
		endpoint: 'https://example.com',
		cache: true,
		debug: false,
		owner: 'platform',
		team: 'runtime',
		description: 'Production config',
		priority: 2,
		batchSize: 100,
		parallelism: 4,
		tag: 'stable',
	}),
	invalid: Object.freeze({ id: 'config-1', enabled: true, retries: 'three' }),
}

const optionalSparsePool = Array.from({ length: 64 }, (_, index) => ({
	id: `config-${index}`,
	enabled: index % 2 === 0,
}))

// The adapter's `createOptionalFields()` shape. Every `[v.string()]` entry is
// `object`'s own optional handling rather than a `union` branch, so `union` is
// deliberately absent.
const optionalHeavySteps = ['object', 'string', 'boolean', 'number', 'isInteger']

export const optionalHeavyScenarios = [
	warm('optional-heavy/sparse', 'standard', 'optionalHeavy', optionalHeavy.sparse, { success: true }, { steps: optionalHeavySteps }),
	warmPool('optional-heavy/sparse-rotating', 'standard', 'optionalHeavy', optionalSparsePool, { success: true }, { steps: optionalHeavySteps }),
	warm('optional-heavy/full', 'standard', 'optionalHeavy', optionalHeavy.full, { success: true }, { steps: optionalHeavySteps }),
	warm('optional-heavy/invalid', 'standard', 'optionalHeavy', optionalHeavy.invalid, { success: false }, { steps: optionalHeavySteps }),
]
