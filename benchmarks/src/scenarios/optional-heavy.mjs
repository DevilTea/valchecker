// `optional-heavy/*`: a sixteen-field configuration object where fourteen fields
// are optional, so the sparse case measures absent-key handling and the full
// case measures the same shape with every field present.
//
// The two sparse scenarios are `compatible-subset`, because the libraries do not do the
// same amount of work on a sparse input and the scenario exists to measure exactly that
// difference: Valchecker's `object` materializes each declared-but-absent optional key as
// an own enumerable property valued `undefined`, so a two-key input produces a
// sixteen-key output, while all four competitors omit the fourteen absent keys and return
// a two-key object. Fourteen extra property writes are the difference, and they are what
// a reader comparing these rows is looking at.
//
// It cannot be an asserted output, because the two outputs are genuinely different
// values and a scenario asserts one expectation for every adapter. It was also not
// *visible*: `canonicalizeOutput` went through `JSON.stringify`, which drops a property
// valued `undefined`, so a sixteen-key object and a two-key object canonicalized to the
// same string and an output assertion here would have passed without asserting anything.
// That is fixed in `define.mjs`, which is why the difference is declared rather than
// asserted here.
//
// `optional-heavy/full` stays `equivalent`: with every field present there is nothing to
// materialize and all five outputs are the same sixteen-key object.
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

const sparseScope = 'compatible-subset'

export const optionalHeavyScenarios = [
	warm('optional-heavy/sparse', 'standard', 'optionalHeavy', optionalHeavy.sparse, { success: true }, { comparisonScope: sparseScope, steps: optionalHeavySteps }),
	warmPool('optional-heavy/sparse-rotating', 'standard', 'optionalHeavy', optionalSparsePool, { success: true }, { comparisonScope: sparseScope, steps: optionalHeavySteps }),
	warm('optional-heavy/full', 'standard', 'optionalHeavy', optionalHeavy.full, { success: true, output: optionalHeavy.full }, { steps: optionalHeavySteps }),
	warm('optional-heavy/invalid', 'standard', 'optionalHeavy', optionalHeavy.invalid, { success: false }, { steps: optionalHeavySteps }),
]
