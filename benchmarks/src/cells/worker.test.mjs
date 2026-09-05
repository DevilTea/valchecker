import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const worker = fileURLToPath(new URL('./worker.mjs', import.meta.url))

test('a cell added after the baseline build is reported as unmeasurable instead of crashing the shard', () => {
	const fakeDist = join(tmpdir(), `valchecker-missing-new-step-${process.pid}-${Date.now()}.mjs`)
	writeFileSync(fakeDist, 'export function createValchecker() { throw new Error(\"should not execute\") }\n')

	const result = spawnSync(
		process.execPath,
		[worker, 'toStrictJSONString/nested-object', 'smoke'],
		{
			encoding: 'utf8',
			env: { ...process.env, VALCHECKER_DIST_URL: pathToFileURL(fakeDist).href },
		},
	)

	assert.equal(result.status, 0, result.stderr)
	const payload = JSON.parse(result.stdout)
	assert.equal(payload.cell, 'toStrictJSONString/nested-object')
	assert.match(payload.unmeasurable, /does not provide an export named 'toStrictJSONString'/)
})
