import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertResult, canonicalizeOutput, warm } from './scenarios/define.mjs'
import { getScenarioCatalog, getScenarios } from './scenarios/index.mjs'

/**
 * `steps` is what makes step coverage of the cross-library suite checkable, so
 * the guards here are about the declaration being present, well-formed, and
 * consistent for one build key — not about which steps any scenario names.
 */

const scenarios = getScenarios('full')

function defineWarm(steps) {
	return warm('probe/scenario', 'full', 'primitive', 'abc', { success: true }, { steps })
}

test('a scenario without declared steps is rejected', () => {
	assert.throws(() => defineWarm(undefined), /must declare a non-empty `steps` array/)
	assert.throws(() => defineWarm([]), /must declare a non-empty `steps` array/)
})

test('a non-string step entry is rejected', () => {
	assert.throws(() => defineWarm(['string', 42]), /every entry must be a non-empty Valchecker step-method name/)
	assert.throws(() => defineWarm(['string', '']), /every entry must be a non-empty Valchecker step-method name/)
})

test('every scenario declares steps and a unique id', () => {
	const ids = new Set()
	for (const scenario of scenarios) {
		assert.equal(ids.has(scenario.id), false, `duplicate scenario id: ${scenario.id}`)
		ids.add(scenario.id)
		assert.ok(scenario.steps.length > 0, `${scenario.id} declares no steps`)
	}
})

// `steps` describes the schema the build key produces, so two scenarios sharing
// a build key must name the same steps. Without this, one family module could
// drift from another that measures the identical schema.
test('scenarios sharing a build key declare the same steps', () => {
	const byBuildKey = new Map()
	for (const scenario of scenarios) {
		const previous = byBuildKey.get(scenario.buildKey)
		if (previous === undefined) {
			byBuildKey.set(scenario.buildKey, scenario)
			continue
		}
		assert.deepEqual(
			[...scenario.steps].sort(),
			[...previous.steps].sort(),
			`${scenario.id} and ${previous.id} share build key '${scenario.buildKey}' but declare different steps`,
		)
	}
})

test('the catalog carries steps through to the raw result', () => {
	const catalog = getScenarioCatalog('full')
	assert.equal(catalog.length, scenarios.length)
	for (const [index, entry] of catalog.entries())
		assert.deepEqual(entry.steps, scenarios[index].steps)
})

test('every equivalent scenario is backed by an executable observable conformance contract', () => {
	const catalog = getScenarioCatalog('full')
	for (const [index, scenario] of scenarios.entries()) {
		const entry = catalog[index]
		if (scenario.comparisonScope !== 'equivalent') {
			assert.equal(entry.conformanceKey, null, `${scenario.id} exposes an equivalence contract outside equivalent scope`)
			assert.equal(entry.conformanceCaseCount, 0, `${scenario.id} exposes conformance cases outside equivalent scope`)
			continue
		}

		assert.equal(entry.conformanceKey, scenario.conformanceKey, `${scenario.id} lost its conformance identity in the catalog`)
		assert.equal(entry.conformanceCaseCount, scenario.conformanceCases.length, `${scenario.id} lost conformance cases in the catalog`)
		assert.ok(scenario.conformanceCases.length > 0, `${scenario.id} has no executable conformance cases`)
		const exactSuccesses = scenario.conformanceCases.filter(({ expected }) => expected.success && Object.hasOwn(expected, 'output'))
		const failures = scenario.conformanceCases.filter(({ expected }) => !expected.success)
		assert.ok(exactSuccesses.length > 0, `${scenario.id} has no exact success/output conformance case`)
		if (failures.length === 0) {
			assert.match(scenario.conformanceNoFailureReason ?? '', /accepts every JavaScript value/, `${scenario.id} has no failure case without explaining why none exists`)
			assert.ok(exactSuccesses.length >= 2, `${scenario.id} replaces a failure case with too little success coverage`)
		}
	}
})

test('the built-in correction rows are equivalent by observable contract, not internal spelling', () => {
	const catalog = new Map(getScenarioCatalog('full')
		.map(scenario => [scenario.id, scenario]))
	for (const id of ['primitive-builtin/valid', 'flat-object-builtin/valid']) {
		const scenario = catalog.get(id)
		assert.equal(scenario.comparisonScope, 'equivalent', `${id} is not classified by its observable contract`)
		assert.ok(scenario.conformanceCaseCount >= 2, `${id} has no success/failure conformance pair`)
		assert.match(scenario.comparisonNote, /built-in/, `${id} hides its execution-model difference`)
	}
	for (const id of ['primitive/valid', 'flat-object/valid', 'nested-object/valid', 'delegation/valid']) {
		const scenario = catalog.get(id)
		assert.equal(scenario.comparisonScope, 'equivalent')
		assert.ok(scenario.comparisonNote, `${id} does not disclose its material execution-model difference`)
	}
})

test('an explicit undefined success output is asserted instead of meaning no output assertion', () => {
	const adapter = { name: 'Probe', normalize: result => result }
	assert.doesNotThrow(() => assertResult(adapter, { success: true, output: undefined }, { success: true, output: undefined }))
	assert.throws(
		() => assertResult(adapter, { success: true, output: 'wrong' }, { success: true, output: undefined }),
		/output mismatch.*Undefined/s,
	)
})

test('equivalent conformance is executed before the timed operation is created', () => {
	const scenario = warm('probe/conformance', 'full', 'probe', 'timed', { success: true, output: 'timed' }, { steps: ['string'] })
	scenario.conformanceCases = [{ input: 'contract', expected: { success: true, output: 'contract' } }]
	const adapter = {
		name: 'Probe',
		build: { probe: () => ({}) },
		parse: (_schema, input) => ({ success: true, output: input === 'contract' ? 'wrong' : input }),
		normalize: result => result,
	}
	assert.throws(() => scenario.setup(adapter), /output mismatch/)
})

/**
 * `canonicalizeOutput` decides whether an output assertion asserts anything. Two
 * values it cannot tell apart make the assertion pass for the wrong output, which is
 * indistinguishable from having no assertion — so what is checked here is that the
 * values the suite actually produces are separated, and that a value it cannot
 * separate is refused rather than silently flattened.
 */

function canonical(value) {
	return JSON.stringify(canonicalizeOutput(value))
}

test('a materialized optional key is not the same output as an absent one', () => {
	// Valchecker's `object` writes every declared-but-absent optional key as an own
	// enumerable property valued `undefined`, so the sparse `optional-heavy` input
	// produces a sixteen-key output where all four competitors produce a two-key one
	// (executed on the four adapters, not assumed). `JSON.stringify` drops a property
	// valued `undefined`, so these two used to canonicalize to the same string.
	const materialized = { id: 'config-1', enabled: true, name: undefined, region: undefined }
	const omitted = { id: 'config-1', enabled: true }
	assert.notEqual(canonical(materialized), canonical(omitted))
	// Not simply that everything differs now: the same shape still compares equal.
	assert.equal(canonical(materialized), canonical({ ...materialized }))
	assert.notEqual(canonical([1, undefined]), canonical([1, null]))
})

test('two Files and two Blobs that differ are not the same output', () => {
	// A File and a Blob have no own enumerable properties, so the generic object branch
	// would canonicalize both to `{}`: without their own branches `file-mime-type/valid`
	// would accept a `text/plain` File as the output of an `image/png` check.
	const png = new File(['payload'], 'payload.png', { type: 'image/png', lastModified: 0 })
	const text = new File(['payload'], 'payload.txt', { type: 'text/plain', lastModified: 0 })
	assert.notEqual(canonical(png), canonical(text))
	assert.equal(canonical(png), canonical(new File(['payload'], 'payload.png', { type: 'image/png', lastModified: 0 })))
	// Every File is a Blob, so the Blob branch alone would catch the pair above through
	// their differing media types. These two differ in nothing a Blob has.
	assert.notEqual(canonical(png), canonical(new File(['payload'], 'other.png', { type: 'image/png', lastModified: 0 })))
	assert.notEqual(canonical(png), canonical(new File(['payload'], 'payload.png', { type: 'image/png', lastModified: 1 })))
	assert.notEqual(canonical(new Blob(['payload'], { type: 'image/png' })), canonical(new Blob(['payload'], { type: 'text/plain' })))
	assert.notEqual(canonical(new Blob(['payload'])), canonical(new Blob(['other payload'])))
})

test('a value canonicalizeOutput cannot tell apart from an empty object is refused', () => {
	class Opaque {}
	assert.throws(() => canonicalizeOutput(new Opaque()), /Opaque value.*no own enumerable properties/s)
	assert.throws(() => canonicalizeOutput(new WeakMap()), /Add a branch for it/)
	// An empty plain object really is an empty object, and one own property is enough to
	// canonicalize an instance — which is why `BenchmarkResource` carries an `id`.
	assert.deepEqual(canonicalizeOutput({}), {})
	assert.deepEqual(canonicalizeOutput(new (class Resource {
		constructor() {
			this.id = 'resource-1'
		}
	})()), { id: 'resource-1' })
})

/**
 * How a cell was measured has to survive into `raw.json` and into the benchmark
 * group, because every aggregate in the suite is computed per group: an awaited
 * measurement inside a synchronous group would be averaged with work it is not
 * comparable to.
 */

test('the catalog carries the execution mode and entry point', () => {
	const catalog = getScenarioCatalog('full')
	for (const [index, entry] of catalog.entries()) {
		assert.equal(entry.executionMode, scenarios[index].executionMode)
		assert.equal(entry.entry, scenarios[index].entry)
		assert.ok(['sync', 'async'].includes(entry.executionMode), `${entry.id} declares executionMode ${entry.executionMode}`)
		assert.ok(['native', 'standard'].includes(entry.entry), `${entry.id} declares entry ${entry.entry}`)
	}
})

test('an async scenario is in an async benchmark group and a sync one is not', () => {
	for (const scenario of scenarios) {
		assert.equal(
			scenario.group.split('/')
				.includes('async'),
			scenario.executionMode === 'async',
			`${scenario.id} is measured ${scenario.executionMode} but its group is ${scenario.group}`,
		)
	}
})

test('an unknown execution mode is rejected', () => {
	assert.throws(
		() => warm('probe/scenario', 'full', 'primitive', 'abc', { success: true }, { steps: ['string'], executionMode: 'maybe' }),
		/declares the unknown executionMode "maybe"/,
	)
})

/**
 * The declaration has to match what the adapter actually returns, in both
 * directions. A promise measured as synchronous times promise creation and
 * publishes it as throughput; a synchronous result measured as asynchronous is a
 * sync row wearing an async label. Neither is visible in a report, so both fail
 * here instead.
 */

function probeAdapter(result) {
	return {
		name: 'Probe',
		build: { probe: () => ({}) },
		parse: () => result,
		normalize: raw => ({ success: raw.success, issueCount: 0 }),
	}
}

const probeOptions = { steps: ['string'] }

test('a promise from a scenario declared synchronous is rejected', () => {
	const scenario = warm('probe/sync', 'full', 'probe', 'abc', { success: true }, probeOptions)
	assert.throws(
		() => scenario.setup(probeAdapter(Promise.resolve({ success: true }))),
		/returned a promise for a scenario declared synchronous/,
	)
})

test('a synchronous result from a scenario declared asynchronous is rejected', () => {
	const scenario = warm('probe/async', 'full', 'probe', 'abc', { success: true }, { ...probeOptions, executionMode: 'async' })
	assert.throws(
		() => scenario.setup(probeAdapter({ success: true })),
		/returned a synchronous result for a scenario declared asynchronous/,
	)
})

test('an async scenario verifies the resolved result', async () => {
	const passing = warm('probe/async-ok', 'full', 'probe', 'abc', { success: true }, { ...probeOptions, executionMode: 'async' })
	assert.equal(typeof await passing.setup(probeAdapter(Promise.resolve({ success: true }))), 'function')
	const failing = warm('probe/async-bad', 'full', 'probe', 'abc', { success: true }, { ...probeOptions, executionMode: 'async' })
	await assert.rejects(
		() => failing.setup(probeAdapter(Promise.resolve({ success: false }))),
		/expected success=true, received false/,
	)
})

// Standard Schema V1 decides success by the absence of `issues`. Valibot returns a
// `value` alongside them for a typed failure, so a `'value' in result` test would
// read that as a success — and the harness normalizes the standard result for every
// adapter, so getting this wrong would silently pass a failing scenario everywhere.
test('a Standard Schema result carrying both a value and issues is a failure', () => {
	const adapter = {
		name: 'Probe',
		build: { probe: () => ({ '~standard': { validate: () => ({ value: 'abc', typed: true, issues: [{}, {}] }) } }) },
		parse: () => {
			throw new Error('the standard entry must not call the adapter parse')
		},
		normalize: () => {
			throw new Error('the standard entry must not use the adapter normalizer')
		},
	}
	const expectedFailure = warm('probe/standard', 'full', 'probe', 'abc', { success: false, issueCount: 2 }, { ...probeOptions, entry: 'standard' })
	assert.equal(typeof expectedFailure.setup(adapter), 'function')
	const expectedSuccess = warm('probe/standard-success', 'full', 'probe', 'abc', { success: true }, { ...probeOptions, entry: 'standard' })
	assert.throws(() => expectedSuccess.setup(adapter), /expected success=true, received false/)
})
