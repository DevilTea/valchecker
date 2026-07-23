import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, resolve, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

interface PackageDefinition {
	name: string
	directory: string
	workspaceDependencies: string[]
}

interface PackageManifest {
	name: string
	version: string
	type?: string
	exports?: Record<string, Record<string, unknown>>
	dependencies?: Record<string, string>
}

const packages: PackageDefinition[] = [
	{ name: '@valchecker/internal', directory: 'packages/internal', workspaceDependencies: [] },
	{
		name: '@valchecker/all-steps',
		directory: 'packages/all-steps',
		workspaceDependencies: ['@valchecker/internal'],
	},
	{
		name: 'valchecker',
		directory: 'packages/valchecker',
		workspaceDependencies: ['@valchecker/internal', '@valchecker/all-steps'],
	},
]

function run(command: string, args: string[], cwd = root): Promise<void> {
	return new Promise((resolvePromise, reject) => {
		const child = spawn(command, args, {
			cwd,
			env: {
				...process.env,
				CI: 'true',
			},
			stdio: 'inherit',
		})

		child.once('error', reject)
		child.once('exit', (code, signal) => {
			if (code === 0) {
				resolvePromise()
				return
			}

			reject(new Error(`${command} ${args.join(' ')} exited with ${signal ?? code}`))
		})
	})
}

async function listFiles(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true })
	const files = await Promise.all(entries.map(async (entry) => {
		const path = join(directory, entry.name)
		return entry.isDirectory() ? listFiles(path) : [path]
	}))
	return files.flat()
}

function toFileSpecifier(from: string, target: string): string {
	const path = relative(from, target)
		.split(sep)
		.join('/')
	return `file:${path.startsWith('.') ? path : `./${path}`}`
}

async function packPackage(
	definition: PackageDefinition,
	tarballDirectory: string,
): Promise<string> {
	const before = new Set(await readdir(tarballDirectory))
	await run(pnpm, [
		'--dir',
		resolve(root, definition.directory),
		'pack',
		'--pack-destination',
		tarballDirectory,
	])

	const created = (await readdir(tarballDirectory)).filter(file => !before.has(file))
	if (created.length !== 1 || !created[0]?.endsWith('.tgz'))
		throw new Error(`Expected one tarball for ${definition.name}, got: ${created.join(', ')}`)

	return join(tarballDirectory, created[0])
}

async function assertInstalledPackage(
	definition: PackageDefinition,
	packageDirectory: string,
	expectedVersion: string,
): Promise<void> {
	const manifest = JSON.parse(
		await readFile(join(packageDirectory, 'package.json'), 'utf8'),
	) as PackageManifest
	if (manifest.name !== definition.name)
		throw new Error(`Expected installed package ${definition.name}, received ${manifest.name}`)
	if (manifest.version !== expectedVersion)
		throw new Error(`${manifest.name} version ${manifest.version} does not match ${expectedVersion}`)
	if (manifest.type !== 'module')
		throw new Error(`${manifest.name} is not marked as an ESM package`)
	if (manifest.exports?.['.']?.require !== undefined)
		throw new Error(`${manifest.name} still exposes a CommonJS require condition`)

	for (const dependency of definition.workspaceDependencies) {
		if (manifest.dependencies?.[dependency] !== expectedVersion) {
			throw new Error(
				`${manifest.name} dependency ${dependency} must be ${expectedVersion}, received ${String(manifest.dependencies?.[dependency])}`,
			)
		}
	}

	const distFiles = await listFiles(join(packageDirectory, 'dist'))
	const forbidden = distFiles.filter(file => /(?:\.cjs(?:\.map)?|\.d\.cts(?:\.map)?)$/.test(file))
	if (forbidden.length > 0)
		throw new Error(`${manifest.name} contains CommonJS artifacts: ${forbidden.join(', ')}`)
}

const rootManifest = JSON.parse(
	await readFile(resolve(root, 'package.json'), 'utf8'),
) as { version?: unknown }
if (typeof rootManifest.version !== 'string' || rootManifest.version.length === 0)
	throw new Error('Root package version must be a non-empty string')
const expectedVersion = rootManifest.version
const temporaryRoot = await mkdtemp(join(tmpdir(), 'valchecker-package-smoke-'))

try {
	const tarballDirectory = join(temporaryRoot, 'tarballs')
	const consumerDirectory = join(temporaryRoot, 'consumer')
	await mkdir(tarballDirectory, { recursive: true })
	await mkdir(consumerDirectory, { recursive: true })

	const tarballs = new Map<string, string>()
	for (const definition of packages)
		tarballs.set(definition.name, await packPackage(definition, tarballDirectory))

	const dependencies = Object.fromEntries(packages.map(({ name }) => {
		const tarball = tarballs.get(name)
		if (!tarball)
			throw new Error(`Missing tarball for ${name}`)
		return [name, toFileSpecifier(consumerDirectory, tarball)]
	}))

	await writeFile(join(consumerDirectory, 'package.json'), `${JSON.stringify({
		name: 'valchecker-package-smoke-consumer',
		private: true,
		type: 'module',
		dependencies,
		pnpm: {
			overrides: dependencies,
		},
	}, null, '\t')}\n`)

	await run(pnpm, [
		'install',
		'--ignore-workspace',
		'--frozen-lockfile=false',
		'--prefer-offline',
	], consumerDirectory)

	await writeFile(join(consumerDirectory, 'esm.mjs'), `
import { createValchecker, object, string, toTrimmed, v } from 'valchecker'
import { allSteps } from '@valchecker/all-steps'
import { createValchecker as createInternalValchecker } from '@valchecker/internal'

const defaultResult = v.object({ name: v.string().toTrimmed() }).execute({ name: '  Alice  ' })
if (!('value' in defaultResult) || defaultResult.value.name !== 'Alice')
  throw new Error('Default ESM import did not execute correctly')

const selective = createValchecker({ steps: [string, object, toTrimmed] })
const selectiveResult = selective.object({ name: selective.string().toTrimmed() }).execute({ name: '  Bob  ' })
if (!('value' in selectiveResult) || selectiveResult.value.name !== 'Bob')
  throw new Error('Selective ESM imports did not execute correctly')

if (allSteps.length === 0 || typeof createInternalValchecker !== 'function')
  throw new Error('Direct workspace package imports are invalid')
`)

	await writeFile(join(consumerDirectory, 'commonjs.cjs'), `
void (async () => {
  const { v } = await import('valchecker')
  const result = v.string().execute('ok')
  if (!('value' in result) || result.value !== 'ok')
    throw new Error('CommonJS dynamic import did not execute correctly')
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
`)

	await writeFile(join(consumerDirectory, 'typecheck.ts'), `
import { createValchecker, object, string, v } from 'valchecker'
import { allSteps } from '@valchecker/all-steps'
import type { ExecutionResult } from '@valchecker/internal'

const schema = v.object({ name: v.string() })
const result = schema.execute({ name: 'Ada' })
const selective = createValchecker({ steps: [string, object] })
const typedResult: ExecutionResult = result

void selective
void typedResult
void allSteps
`)

	await writeFile(join(consumerDirectory, 'tsconfig.nodenext.json'), `${JSON.stringify({
		compilerOptions: {
			module: 'NodeNext',
			moduleResolution: 'NodeNext',
			strict: true,
			noEmit: true,
			target: 'ES2022',
			skipLibCheck: false,
		},
		include: ['./typecheck.ts'],
	}, null, '\t')}\n`)

	await writeFile(join(consumerDirectory, 'tsconfig.bundler.json'), `${JSON.stringify({
		compilerOptions: {
			module: 'ESNext',
			moduleResolution: 'Bundler',
			strict: true,
			noEmit: true,
			target: 'ES2022',
			skipLibCheck: false,
		},
		include: ['./typecheck.ts'],
	}, null, '\t')}\n`)

	await run(process.execPath, ['esm.mjs'], consumerDirectory)
	await run(process.execPath, ['commonjs.cjs'], consumerDirectory)
	await run(pnpm, ['exec', 'tsc', '--project', join(consumerDirectory, 'tsconfig.nodenext.json')])
	await run(pnpm, ['exec', 'tsc', '--project', join(consumerDirectory, 'tsconfig.bundler.json')])

	for (const definition of packages) {
		const segments = definition.name.split('/')
		await assertInstalledPackage(
			definition,
			join(consumerDirectory, 'node_modules', ...segments),
			expectedVersion,
		)
	}

	console.log(`Package smoke tests passed for ${expectedVersion} in ${consumerDirectory}`)
}
finally {
	if (process.env.KEEP_PACKAGE_SMOKE !== '1')
		await rm(temporaryRoot, { recursive: true, force: true })
	else
		console.log(`Package smoke-test files retained at ${temporaryRoot}`)
}
