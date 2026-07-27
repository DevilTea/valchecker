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
