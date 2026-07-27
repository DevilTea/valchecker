import assert from 'node:assert/strict'
import { test } from 'node:test'
import { warm } from './scenarios/define.mjs'
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
