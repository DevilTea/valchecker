import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const releaseRoot = resolve(root, 'artifacts/release')
const tsxCli = fileURLToPath(import.meta.resolve('tsx/cli'))
const cleanupPaths: string[] = []

function checksum(contents: Buffer, algorithm: 'sha256' | 'sha512'): string {
	return createHash(algorithm)
		.update(contents)
		.digest(algorithm === 'sha512' ? 'base64' : 'hex')
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<{ code: number | null, stdout: string, stderr: string }> {
	return new Promise((resolvePromise, reject) => {
		const child = spawn(command, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] })
		let stdout = ''
		let stderr = ''
		child.stdout.setEncoding('utf8')
		child.stderr.setEncoding('utf8')
		child.stdout.on('data', chunk => stdout += chunk)
		child.stderr.on('data', chunk => stderr += chunk)
		child.once('error', reject)
		child.once('exit', code => resolvePromise({ code, stdout, stderr }))
	})
}

afterEach(async () => {
	await Promise.all(cleanupPaths.splice(0)
		.map(path => rm(path, { recursive: true, force: true })))
})

describe('publish release registry preflight', () => {
	// The production Trusted Publishing workflow runs on Ubuntu; this process-level
	// test uses a POSIX fake npm executable. Pure release-contract tests still run on Windows.
	it.skipIf(process.platform === 'win32')('detects a later conflicting artifact before publishing any missing package', async () => {
		await mkdir(releaseRoot, { recursive: true })
		const fixtureDirectory = await mkdtemp(resolve(releaseRoot, 'publish-test-'))
		cleanupPaths.push(fixtureDirectory)
		const version = '0.0.33'
		const packageDefinitions = [
			{ name: '@valchecker/internal', directory: 'packages/internal', file: 'internal.tgz' },
			{ name: '@valchecker/all-steps', directory: 'packages/all-steps', file: 'all-steps.tgz' },
			{ name: 'valchecker', directory: 'packages/valchecker', file: 'valchecker.tgz' },
		]
		const packages = []
		for (const [index, definition] of packageDefinitions.entries()) {
			const contents = Buffer.from(`fixture-${index}`)
			const tarball = resolve(fixtureDirectory, definition.file)
			await writeFile(tarball, contents)
			packages.push({
				name: definition.name,
				version,
				directory: definition.directory,
				tarball: tarball.slice(root.length + 1),
				sha256: checksum(contents, 'sha256'),
				integrity: `sha512-${checksum(contents, 'sha512')}`,
				size: contents.length,
			})
		}
		const manifest = resolve(fixtureDirectory, 'release-manifest.json')
		await writeFile(manifest, `${JSON.stringify({ schemaVersion: 2, version, commit: 'review-sha', packages })}\n`)

		const fakeBin = await mkdtemp(resolve(tmpdir(), 'valchecker-fake-npm-'))
		cleanupPaths.push(fakeBin)
		const callsPath = resolve(fakeBin, 'calls.jsonl')
		const fakeNpm = resolve(fakeBin, 'npm')
		await writeFile(fakeNpm, `#!/usr/bin/env node
const fs = require('node:fs')
const args = process.argv.slice(2)
fs.appendFileSync(process.env.FAKE_NPM_CALLS, JSON.stringify(args) + '\\n')
if (args[0] === '--version') { console.log('11.5.1'); process.exit(0) }
if (args[0] === 'view' && args[2] === 'versions') {
  console.log(JSON.stringify(args[1] === 'valchecker' ? ['0.0.33'] : []))
  process.exit(0)
}
if (args[0] === 'view' && args[1] === 'valchecker@0.0.33' && args[2] === 'dist.integrity') {
  console.log(JSON.stringify('sha512-CONFLICT'))
  process.exit(0)
}
if (args[0] === 'publish') process.exit(0)
console.error('Unexpected fake npm arguments:', args)
process.exit(2)
`)
		await chmod(fakeNpm, 0o755)

		const env = { ...process.env }
		delete env.NODE_AUTH_TOKEN
		delete env.NPM_TOKEN
		Object.assign(env, {
			PATH: `${fakeBin}${delimiter}${process.env.PATH ?? ''}`,
			FAKE_NPM_CALLS: callsPath,
			GITHUB_ACTIONS: 'true',
			GITHUB_EVENT_NAME: 'push',
			GITHUB_REF_TYPE: 'tag',
			GITHUB_REF_NAME: `v${version}`,
			GITHUB_REF: `refs/tags/v${version}`,
			GITHUB_SHA: 'review-sha',
		})

		const result = await run(process.execPath, [tsxCli, './scripts/publish-release.ts', '--manifest', manifest.slice(root.length + 1)], env)
		expect(result.code)
			.toBe(1)
		expect(`${result.stdout}\n${result.stderr}`)
			.toContain('already exists on npm with different artifact integrity')
		const calls = (await readFile(callsPath, 'utf8'))
			.trim()
			.split('\n')
			.filter(Boolean)
			.map(line => JSON.parse(line) as string[])
		expect(calls.filter(args => args[0] === 'publish'))
			.toEqual([])
	})
})
