import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'

const root = resolve(import.meta.dirname, '..')
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const repositoryUrl = 'git+https://github.com/DevilTea/valchecker.git'
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/

interface PackageDefinition {
	name: string
	directory: string
	workspaceDependencies: string[]
}

interface PackageManifest {
	name?: unknown
	version?: unknown
	private?: unknown
	type?: unknown
	license?: unknown
	publishConfig?: { access?: unknown }
	repository?: { type?: unknown, url?: unknown, directory?: unknown }
	engines?: { node?: unknown }
	exports?: Record<string, unknown>
	main?: unknown
	types?: unknown
	files?: unknown
	dependencies?: Record<string, unknown>
}

interface PreparedPackage {
	name: string
	version: string
	directory: string
	tarball: string
	sha256: string
	size: number
}

interface ReleaseManifest {
	schemaVersion: 1
	version: string
	commit: string | null
	packages: PreparedPackage[]
}

const packages: PackageDefinition[] = [
	{
		name: '@valchecker/internal',
		directory: 'packages/internal',
		workspaceDependencies: [],
	},
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

function parseArguments(argv: string[]): { output: string } {
	let output = resolve(root, 'artifacts/release')
	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index]
		const value = argv[index + 1]
		if (argument === '--output' && value) {
			output = resolve(root, value)
			index++
		}
		else {
			throw new Error(`Unknown or incomplete argument: ${argument}`)
		}
	}
	return { output }
}

function run(
	command: string,
	args: string[],
	options: { cwd?: string, capture?: boolean } = {},
): Promise<string> {
	return new Promise((resolvePromise, reject) => {
		const capture = options.capture ?? false
		const child = spawn(command, args, {
			cwd: options.cwd ?? root,
			env: { ...process.env, CI: 'true' },
			stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
		})
		let stdout = ''
		let stderr = ''
		if (capture) {
			child.stdout?.setEncoding('utf8')
			child.stderr?.setEncoding('utf8')
			child.stdout?.on('data', chunk => stdout += chunk)
			child.stderr?.on('data', chunk => stderr += chunk)
		}
		child.once('error', reject)
		child.once('exit', (code, signal) => {
			if (code === 0) {
				resolvePromise(stdout)
				return
			}
			reject(new Error(`${command} ${args.join(' ')} exited with ${signal ?? code}${stderr ? `:\n${stderr}` : ''}`))
		})
	})
}

async function readJson<T>(path: string): Promise<T> {
	return JSON.parse(await readFile(path, 'utf8')) as T
}

function assertString(value: unknown, expected: string, path: string): void {
	if (value !== expected)
		throw new Error(`${path} must be ${JSON.stringify(expected)}, received ${JSON.stringify(value)}`)
}

function assertStringArray(value: unknown, expected: string[], path: string): void {
	if (!Array.isArray(value) || JSON.stringify(value) !== JSON.stringify(expected))
		throw new Error(`${path} must be ${JSON.stringify(expected)}, received ${JSON.stringify(value)}`)
}

function assertPackageManifest(
	definition: PackageDefinition,
	manifest: PackageManifest,
	version: string,
): void {
	const prefix = definition.directory
	assertString(manifest.name, definition.name, `${prefix}.name`)
	assertString(manifest.version, version, `${prefix}.version`)
	if (manifest.private === true)
		throw new Error(`${prefix} must be publishable, but private is true`)
	assertString(manifest.type, 'module', `${prefix}.type`)
	assertString(manifest.license, 'MIT', `${prefix}.license`)
	assertString(manifest.publishConfig?.access, 'public', `${prefix}.publishConfig.access`)
	assertString(manifest.repository?.type, 'git', `${prefix}.repository.type`)
	assertString(manifest.repository?.url, repositoryUrl, `${prefix}.repository.url`)
	assertString(manifest.repository?.directory, definition.directory, `${prefix}.repository.directory`)
	assertString(manifest.engines?.node, '>=22', `${prefix}.engines.node`)
	assertString(manifest.main, './dist/index.mjs', `${prefix}.main`)
	assertString(manifest.types, './dist/index.d.mts', `${prefix}.types`)
	assertStringArray(manifest.files, ['dist'], `${prefix}.files`)

	const rootExport = manifest.exports?.['.']
	if (!rootExport || typeof rootExport !== 'object')
		throw new Error(`${prefix}.exports[\".\"] must be an object`)
	const exportMap = rootExport as Record<string, unknown>
	assertString(exportMap.types, './dist/index.d.mts', `${prefix}.exports[\".\"].types`)
	assertString(exportMap.import, './dist/index.mjs', `${prefix}.exports[\".\"].import`)
	assertString(exportMap.default, './dist/index.mjs', `${prefix}.exports[\".\"].default`)
	if ('require' in exportMap)
		throw new Error(`${prefix} must not expose a CommonJS require condition`)

	for (const dependency of definition.workspaceDependencies)
		assertString(manifest.dependencies?.[dependency], 'workspace:*', `${prefix}.dependencies[${dependency}]`)
}

async function sha256(path: string): Promise<string> {
	return createHash('sha256').update(await readFile(path)).digest('hex')
}

async function packPackage(definition: PackageDefinition, output: string): Promise<string> {
	const before = new Set(await readdir(output))
	await run(pnpm, [
		'--dir',
		resolve(root, definition.directory),
		'pack',
		'--pack-destination',
		output,
	])
	const created = (await readdir(output)).filter(file => !before.has(file) && file.endsWith('.tgz'))
	if (created.length !== 1)
		throw new Error(`Expected one tarball for ${definition.name}, received: ${created.join(', ')}`)
	return resolve(output, created[0]!)
}

async function inspectTarball(
	definition: PackageDefinition,
	tarball: string,
	version: string,
): Promise<void> {
	const listing = (await run('tar', ['-tf', tarball], { capture: true }))
		.split(/\r?\n/)
		.filter(Boolean)
	if (!listing.includes('package/package.json'))
		throw new Error(`${definition.name} tarball is missing package/package.json`)
	if (!listing.includes('package/dist/index.mjs'))
		throw new Error(`${definition.name} tarball is missing dist/index.mjs`)
	if (!listing.includes('package/dist/index.d.mts'))
		throw new Error(`${definition.name} tarball is missing dist/index.d.mts`)

	const forbidden = listing.filter(path => (
		path.includes('/src/')
		|| path.includes('/node_modules/')
		|| /\.(?:test|bench)\.[cm]?[jt]sx?$/.test(path)
		|| /tsconfig[^/]*\.json$/.test(path)
	))
	if (forbidden.length > 0)
		throw new Error(`${definition.name} tarball contains development files: ${forbidden.join(', ')}`)

	const packed = JSON.parse(
		await run('tar', ['-xOf', tarball, 'package/package.json'], { capture: true }),
	) as PackageManifest
	assertString(packed.name, definition.name, `${definition.name} packed name`)
	assertString(packed.version, version, `${definition.name} packed version`)

	for (const dependency of definition.workspaceDependencies)
		assertString(packed.dependencies?.[dependency], version, `${definition.name} packed dependency ${dependency}`)

	for (const [name, specifier] of Object.entries(packed.dependencies ?? {})) {
		if (typeof specifier === 'string' && specifier.startsWith('workspace:'))
			throw new Error(`${definition.name} packed dependency ${name} still uses ${specifier}`)
	}
}

async function main(): Promise<void> {
	const { output } = parseArguments(process.argv.slice(2))
	const rootManifest = await readJson<PackageManifest>(resolve(root, 'package.json'))
	if (rootManifest.private !== true)
		throw new Error('The workspace root must remain private')
	if (typeof rootManifest.version !== 'string' || !semverPattern.test(rootManifest.version))
		throw new Error(`Root version is not valid semver: ${String(rootManifest.version)}`)
	const version = rootManifest.version

	const manifests = new Map<string, PackageManifest>()
	for (const definition of packages) {
		const manifest = await readJson<PackageManifest>(resolve(root, definition.directory, 'package.json'))
		assertPackageManifest(definition, manifest, version)
		manifests.set(definition.name, manifest)
	}

	await rm(output, { recursive: true, force: true })
	await mkdir(output, { recursive: true })

	const prepared: PreparedPackage[] = []
	for (const definition of packages) {
		const tarball = await packPackage(definition, output)
		await inspectTarball(definition, tarball, version)
		prepared.push({
			name: definition.name,
			version,
			directory: definition.directory,
			tarball: relative(root, tarball).split(sep).join('/'),
			sha256: await sha256(tarball),
			size: (await stat(tarball)).size,
		})
	}

	const releaseManifest: ReleaseManifest = {
		schemaVersion: 1,
		version,
		commit: process.env.GITHUB_SHA ?? null,
		packages: prepared,
	}
	const manifestPath = resolve(output, 'release-manifest.json')
	await writeFile(manifestPath, `${JSON.stringify(releaseManifest, null, '\t')}\n`)
	console.log(`Prepared ${prepared.length} release tarballs for ${version} at ${relative(root, output)}`)
}

await main()
