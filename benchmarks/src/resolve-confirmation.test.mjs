import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const entry = fileURLToPath(new URL('./resolve-confirmation.mjs', import.meta.url))
const directory = mkdtempSync(join(tmpdir(), 'valchecker-confirm-cli-'))
after(() => rmSync(directory, { recursive: true, force: true }))

function comparison(classification, delta, verdict = classification === 'severe' ? 'regression' : 'review') {
	return {
		verdict,
		severeGroups: [],
		runCounts: { baseline: 5, candidate: 5 },
		rows: [{
			scenario: 'cli/resolution-probe',
			classification,
			delta,
			intervalLow: delta - 0.02,
			intervalHigh: delta + 0.02,
		}],
	}
}

function run(screen, confirm, ...flags) {
	const screenPath = join(directory, `screen-${Math.random()}.json`)
	const confirmPath = join(directory, `confirm-${Math.random()}.json`)
	const resultPath = join(directory, `result-${Math.random()}.json`)
	writeFileSync(screenPath, JSON.stringify(screen))
	writeFileSync(confirmPath, JSON.stringify(confirm))
	const child = spawnSync(process.execPath, [
		entry,
		'--screen',
		screenPath,
		'--confirm',
		confirmPath,
		'--json',
		resultPath,
		...flags,
	], { encoding: 'utf8' })
	return { child, result: JSON.parse(readFileSync(resultPath, 'utf8')) }
}

test('require-resolved blocks an unresolved severe/inconclusive result without calling it a regression', () => {
	const { child, result } = run(
		comparison('severe', -0.14, 'regression'),
		comparison('inconclusive', -0.09, 'inconclusive'),
		'--fail-on-regression',
		'--require-resolved',
	)
	assert.equal(result.verdict, 'unresolved')
	assert.deepEqual(result.blocking, [])
	assert.deepEqual(result.unresolved, ['cli/resolution-probe'])
	assert.equal(child.status, 2)
	assert.match(child.stderr, /required check has no resolved answer: unresolved/)
})

test('fail-on-regression keeps a reproduced severe regression distinct from unresolved', () => {
	const { child, result } = run(
		comparison('severe', -0.14, 'regression'),
		comparison('severe', -0.13, 'regression'),
		'--fail-on-regression',
		'--require-resolved',
	)
	assert.equal(result.verdict, 'regression')
	assert.equal(child.status, 1)
})

test('require-resolved does not turn an ordinary review verdict into a failure', () => {
	const { child, result } = run(
		comparison('regression', -0.07, 'review'),
		comparison('regression', -0.08, 'review'),
		'--fail-on-regression',
		'--require-resolved',
	)
	assert.equal(result.verdict, 'review')
	assert.equal(child.status, 0)
})

test('require-resolved permits ordinary boundary uncertainty to converge to review when no severe regression is claimed', () => {
	const { child, result } = run(
		comparison('inconclusive', -0.04, 'inconclusive'),
		comparison('cleared', 0, 'neutral'),
		'--fail-on-regression',
		'--require-resolved',
	)
	assert.equal(result.verdict, 'review')
	assert.deepEqual(result.blocking, [])
	assert.deepEqual(result.unresolved, [])
	assert.deepEqual(result.boundaryUnresolved, [])
	assert.equal(child.status, 0)
})

test('require-resolved reports boundaryUnresolved as non-blocking review when both batches are inconclusive without severe claim', () => {
	const { child, result } = run(
		comparison('inconclusive', -0.04, 'inconclusive'),
		comparison('inconclusive', -0.03, 'inconclusive'),
		'--fail-on-regression',
		'--require-resolved',
	)
	assert.equal(result.verdict, 'review')
	assert.deepEqual(result.blocking, [])
	assert.deepEqual(result.unresolved, [])
	assert.deepEqual(result.boundaryUnresolved, ['cli/resolution-probe'])
	assert.equal(child.status, 0)
	assert.match(child.stderr, /boundary unresolved: cli\/resolution-probe/)
})

test('require-resolved blocks when confirmation discovers severe regression from inconclusive screen', () => {
	const { child, result } = run(
		comparison('inconclusive', -0.04, 'inconclusive'),
		comparison('severe', -0.14, 'regression'),
		'--fail-on-regression',
		'--require-resolved',
	)
	assert.equal(result.verdict, 'unresolved')
	assert.deepEqual(result.blocking, [])
	assert.deepEqual(result.unresolved, ['cli/resolution-probe'])
	assert.deepEqual(result.boundaryUnresolved, [])
	assert.equal(child.status, 2)
	assert.match(child.stderr, /required check has no resolved answer: unresolved/)
})
