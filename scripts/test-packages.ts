import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, resolve, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const corepack = process.platform === 'win32' ? 'corepack.cmd' : 'corepack'
const rootManifest = JSON.parse(
	readFileSync(resolve(root, 'package.json'), 'utf8'),
) as { version?: unknown, packageManager?: unknown }
if (typeof rootManifest.version !== 'string' || rootManifest.version.length === 0)
	throw new Error('Root package version must be a non-empty string')
if (typeof rootManifest.packageManager !== 'string' || !/^pnpm@\d+\.\d+\.\d+$/.test(rootManifest.packageManager))
	throw new Error('Root packageManager must pin pnpm to an exact version')
const pinnedPnpmVersion = rootManifest.packageManager.slice('pnpm@'.length)

interface PackageDefinition {
	name: string
	directory: string
	workspaceDependencies: string[]
}

interface PackageManifest {
	name: string
	version: string
	type?: string
	sideEffects?: unknown
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

function runPnpm(args: string[], cwd = root): Promise<void> {
	return run(corepack, [`pnpm@${pinnedPnpmVersion}`, ...args], cwd)
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
	await runPnpm([
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
	if (manifest.sideEffects !== false)
		throw new Error(`${manifest.name} packed manifest must preserve sideEffects: false; received ${JSON.stringify(manifest.sideEffects)}`)
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
		packageManager: `pnpm@${pinnedPnpmVersion}`,
		dependencies,
		pnpm: {
			overrides: dependencies,
		},
	}, null, '\t')}\n`)

	await runPnpm([
		'install',
		'--ignore-workspace',
		'--frozen-lockfile=false',
		'--prefer-offline',
	], consumerDirectory)

	// pnpm 11 ignored this manifest-level override and linked registry copies for transitive
	// workspace dependencies. The generated lockfile is the package manager's resolution record;
	// require every sibling to remain a local file resolution so that old behavior cannot go green.
	const lockfile = await readFile(join(consumerDirectory, 'pnpm-lock.yaml'), 'utf8')
	for (const [name, tarball] of tarballs) {
		const relativeTarball = relative(consumerDirectory, tarball)
			.split(sep)
			.join('/')
		const localKey = `${name}@file:${relativeTarball}`
		if (!lockfile.includes(localKey))
			throw new Error(`${name} was not resolved from the freshly packed local tarball in pnpm-lock.yaml`)
		if (lockfile.includes(`${name}@${expectedVersion}`))
			throw new Error(`${name} also resolved from a registry/version entry; sibling package resolution is ambiguous`)
	}
	// D12 cross-copy topology: materialize two physical copies of the packed internal
	// package at different real paths. Importing through two query strings is not
	// sufficient evidence because package entrypoints can still share one resolved
	// internal module; these copies guarantee distinct ESM module identities while
	// exercising exactly the artifact installed from the tarball above.
	const installedInternal = join(consumerDirectory, 'node_modules', '@valchecker', 'internal')
	const copyAInternal = join(consumerDirectory, 'copies', 'a', 'node_modules', '@valchecker', 'internal')
	const copyBInternal = join(consumerDirectory, 'copies', 'b', 'node_modules', '@valchecker', 'internal')
	await mkdir(join(copyAInternal, '..'), { recursive: true })
	await mkdir(join(copyBInternal, '..'), { recursive: true })
	await cp(installedInternal, copyAInternal, { dereference: true, recursive: true })
	await cp(installedInternal, copyBInternal, { dereference: true, recursive: true })

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

	await writeFile(join(consumerDirectory, 'dual-copy.mjs'), `
import * as a from './copies/a/node_modules/@valchecker/internal/dist/index.mjs'
import * as b from './copies/b/node_modules/@valchecker/internal/dist/index.mjs'

const failures = []
const check = (condition, message) => {
  if (!condition)
    failures.push(message)
}
const issueOf = (result, label) => {
  if (!('issues' in result) || result.issues.length !== 1) {
    failures.push(label + ': expected exactly one issue')
    return undefined
  }
  return result.issues[0]
}
const checkIssue = (result, expected, label) => {
  const issue = issueOf(result, label)
  if (issue == null)
    return
  check(issue.code === expected.code, label + ': expected code ' + expected.code + ', received ' + issue.code)
  check(issue.message === expected.message, label + ': expected message ' + expected.message + ', received ' + issue.message)
  check(JSON.stringify(issue.path) === JSON.stringify(expected.path), label + ': expected path ' + JSON.stringify(expected.path) + ', received ' + JSON.stringify(issue.path))
}

check(a.createValchecker !== b.createValchecker, 'two-copy topology reused createValchecker identity')
check(a.string !== b.string, 'two-copy topology reused step-plugin identity')
check(a.runtimeExecutionStepDefMarker === b.runtimeExecutionStepDefMarker, 'runtime step marker identity differs across copies')

const foreignDiscoveredSteps = Object.values(a).filter(step => step && typeof step === 'object' && step[b.runtimeExecutionStepDefMarker])
check(foreignDiscoveredSteps.includes(a.string), 'copy B discovery marker could not recognize copy A string plugin')

const stepsA = [a.string, a.unknown, a.use, a.array, a.generic, a.toAsync, a.check, a.literal, a.union, a.templateLiteral, a.record, a.number]
const stepsB = [b.string, b.unknown, b.use, b.array, b.generic, b.toAsync, b.check, b.literal, b.union, b.templateLiteral, b.record, b.number]
const va = a.createValchecker({ steps: stepsA })
const vb = b.createValchecker({ steps: stepsB })

const child = va.string({ message: issue => 'dynamic:' + issue.code })
checkIssue(child.execute(123), { code: 'string:expected_string', message: 'dynamic:string:expected_string', path: [] }, 'single-copy child')
checkIssue(vb.unknown().use(child).execute(123), { code: 'string:expected_string', message: 'dynamic:string:expected_string', path: [] }, 'cross-copy use')
checkIssue(vb.array(vb.array(child)).execute([[123]]), { code: 'string:expected_string', message: 'dynamic:string:expected_string', path: [0, 0] }, 'cross-copy nested array')
checkIssue(vb.unknown().generic(child).execute(123), { code: 'string:expected_string', message: 'dynamic:string:expected_string', path: [] }, 'cross-copy generic')

const asyncChild = va.string()
  .toAsync()
  .check(() => false, { message: issue => 'async:' + issue.code })
const asyncPending = vb.array(asyncChild).execute(['ok'])
check(asyncPending instanceof Promise, 'cross-copy async composition did not return a native Promise')
const asyncResult = await asyncPending
checkIssue(asyncResult, { code: 'check:failed', message: 'async:check:failed', path: [0] }, 'cross-copy async array')

// Foreign construction metadata must remain readable by the compatible copy.
const foreignFinite = va.union(['left', 'right'])
const templated = vb.templateLiteral([foreignFinite])
check('value' in templated.execute('left'), 'cross-copy template-literal metadata was not recognized')
check('issues' in templated.execute('other'), 'cross-copy template-literal metadata accepted an unrelated value')
const finiteRecord = vb.record({ key: foreignFinite, value: vb.number() })
check('value' in finiteRecord.execute({ left: 1, right: 2 }), 'cross-copy literal-members metadata was not recognized')
checkIssue(finiteRecord.execute({ left: 1 }), { code: 'record:missing_key', message: 'Missing required record key.', path: ['right'] }, 'cross-copy finite record')

// Foreign plugin objects must be registrable by another compatible core copy.
// This exercises the step-plugin marker/default-mode/capabilities protocol and
// the union-shorthand capability nested inside the literal plugin capabilities.
const foreignPluginV = b.createValchecker({ steps: [a.union, a.literal] })
check(foreignPluginV.literal('foreign')['~core'].operationMode === 'sync', 'cross-copy plugin default operation mode was not recognized')
check('value' in foreignPluginV.union(['foreign']).execute('foreign'), 'cross-copy foreign plugin/capability registration failed')

// D12 requires protocol identity to be explicit, namespaced, and versioned.
const expectedMarkerKey = 'valchecker.protocol.runtimeExecutionStepDef.v1'
const expectedDefaultModeKey = 'valchecker.protocol.stepPluginDefaultOperationMode.v1'
const expectedCapabilitiesKey = 'valchecker.protocol.stepPluginCapabilities.v1'
const expectedIssueDraftKey = 'valchecker.protocol.issueDraftMetadata.v1'
const expectedUnionShorthandKey = 'valchecker.protocol.unionShorthand.v1'
const expectedLiteralMembersKey = 'valchecker.protocol.literalMembers.v1'
const expectedTemplatePartKey = 'valchecker.protocol.templateLiteralPart.v1'
check(Symbol.keyFor(a.runtimeExecutionStepDefMarker) === expectedMarkerKey, 'runtime step marker is not versioned protocol v1')

const literalPluginKeys = Object.getOwnPropertySymbols(a.literal).map(symbol => Symbol.keyFor(symbol)).filter(Boolean).sort()
check(JSON.stringify(literalPluginKeys) === JSON.stringify([expectedMarkerKey, expectedCapabilitiesKey, expectedDefaultModeKey].sort()), 'literal plugin protocol keys are not the expected v1 set: ' + JSON.stringify(literalPluginKeys))
const capabilities = a.literal[Symbol.for(expectedCapabilitiesKey)]
const capabilityKeys = capabilities == null ? [] : Object.getOwnPropertySymbols(capabilities).map(symbol => Symbol.keyFor(symbol)).filter(Boolean)
check(capabilityKeys.includes(expectedUnionShorthandKey), 'union shorthand capability is not versioned protocol v1: ' + JSON.stringify(capabilityKeys))

const metadataKeys = Object.getOwnPropertySymbols(foreignFinite['~core'].metadata ?? {}).map(symbol => Symbol.keyFor(symbol)).filter(Boolean).sort()
check(JSON.stringify(metadataKeys) === JSON.stringify([expectedLiteralMembersKey, expectedTemplatePartKey].sort()), 'construction metadata protocol keys are not the expected v1 set: ' + JSON.stringify(metadataKeys))
const rawChild = child['~execute'](123)
const rawIssue = 'issues' in rawChild ? rawChild.issues[0] : undefined
const issueKeys = rawIssue == null ? [] : Object.getOwnPropertySymbols(rawIssue).map(symbol => Symbol.keyFor(symbol)).filter(Boolean)
check(issueKeys.includes(expectedIssueDraftKey), 'issue-draft metadata is not versioned protocol v1: ' + JSON.stringify(issueKeys))

if (failures.length > 0)
  throw new Error(['Dual-copy protocol verification failed:', ...failures.map(message => '- ' + message)].join(String.fromCharCode(10)))
`)

	await writeFile(join(consumerDirectory, 'typecheck.ts'), `
import { createValchecker, implStepPlugin, object, string, v } from 'valchecker'
import { allSteps } from '@valchecker/all-steps'
import type { ExecutionResult, StepPlugin, TStepPluginDef } from '@valchecker/internal'

const schema = v.object({ name: v.string() })
const result = schema.execute({ name: 'Ada' })
const standardResult = schema['~standard'].validate({ name: 'Ada' }, {
  libraryOptions: { trace: true },
})
const selective = createValchecker({ steps: [string, object] })
const typedResult: ExecutionResult = result

const attemptStandardMutation = (props: typeof schema['~standard']): void => {
  // @ts-expect-error Standard Schema V1.1 props are readonly.
  props.version = 1
  // @ts-expect-error Standard Schema V1.1 props are readonly.
  props.vendor = 'valchecker'
  // @ts-expect-error Standard Schema V1.1 props are readonly.
  props.validate = () => ({ value: { name: 'bypassed' } })
  // @ts-expect-error Standard Schema V1.1 props are readonly.
  props.types = undefined
}

void standardResult
void attemptStandardMutation
const capabilityOnlyPlugin: StepPlugin<TStepPluginDef> = implStepPlugin<TStepPluginDef>({}, 'sync')
const capabilityOnly = createValchecker({ steps: [capabilityOnlyPlugin] })
const complete = createValchecker({ steps: allSteps })
type AllStep = typeof allSteps[number]

// @ts-expect-error An arbitrary object is not a registered Valchecker step plugin.
createValchecker({ steps: [{}] })
// @ts-expect-error An arbitrary function is not a registered Valchecker step plugin.
createValchecker({ steps: [() => 123] })
// @ts-expect-error AllSteps contains registered step plugins, not arbitrary objects.
const invalidAllStepObject: AllStep = {}
// @ts-expect-error AllSteps contains registered step plugins, not arbitrary functions.
const invalidAllStepFunction: AllStep = () => 123

void capabilityOnly
void complete
void invalidAllStepObject
void invalidAllStepFunction
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
	await run(process.execPath, ['dual-copy.mjs'], consumerDirectory)
	await runPnpm(['exec', 'tsc', '--project', join(consumerDirectory, 'tsconfig.nodenext.json')])
	await runPnpm(['exec', 'tsc', '--project', join(consumerDirectory, 'tsconfig.bundler.json')])

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
