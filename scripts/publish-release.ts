import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import process from 'node:process'

const root = resolve(import.meta.dirname, '..')
const releaseDirectory = resolve(root, 'artifacts/release')
const minimumNpmVersion = [11, 5, 1] as const

interface PreparedPackage {
	name: string
	version: string
	directory: string
	tarball: string
	sha256: string
	size: number
}

interface ReleaseManifest {
	schemaVersion: unknown
	version: unknown
	commit: unknown
	packages: unknown
}

const expectedPackages = [
	{ name: '@valchecker/internal', directory: 'packages/internal' },
	{ name: '@valchecker/all-steps', directory: 'packages/all-steps' },
	{ name: 'valchecker', directory: 'packages/valchecker' },
] as const

function parseArguments(argv: string[]): { manifest: string, verifyOnly: boolean } {
	let manifest = resolve(releaseDirectory, 'release-manifest.json')
	let verifyOnly = false
	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index]
		const value = argv[index + 1]
		if (argument === '--') {
			continue
		}
		if (argument === '--manifest' && value) {
			manifest = resolve(root, value)
			index++
		}
		else if (argument === '--verify-only') {
			verifyOnly = true
		}
		else {
			throw new Error(`Unknown or incomplete argument: ${argument}`)
		}
	}
	return { manifest, verifyOnly }
}

function run(
	command: string,
	args: string[],
	options: { capture?: boolean } = {},
): Promise<string> {
	return new Promise((resolvePromise, reject) => {
		const capture = options.capture ?? false
		const child = spawn(command, args, {
			cwd: root,
			env: process.env,
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
				resolvePromise(stdout.trim())
				return
			}
			reject(new Error(`${command} ${args.join(' ')} exited with ${signal ?? code}${stderr ? `:\n${stderr}` : ''}`))
		})
	})
}

function requireEnvironment(name: string): string {
	const value = process.env[name]
	if (!value)
		throw new Error(`Missing required environment variable: ${name}`)
	return value
}

function parseVersion(version: string): number[] {
	const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version)
	if (!match)
		throw new Error(`Unable to parse version: ${version}`)
	return match.slice(1).map(Number)
}

function isAtLeast(actual: number[], minimum: readonly number[]): boolean {
	for (let index = 0; index < minimum.length; index++) {
		const difference = (actual[index] ?? 0) - (minimum[index] ?? 0)
		if (difference !== 0)
			return difference > 0
	}
	return true
}

function isPrereleaseVersion(version: string): boolean {
	const withoutBuildMetadata = version.split('+', 1)[0]!
	return withoutBuildMetadata.includes('-')
}

function assertPreparedPackages(value: unknown, version: string): PreparedPackage[] {
	if (!Array.isArray(value) || value.length !== expectedPackages.length)
		throw new Error(`Release manifest must contain exactly ${expectedPackages.length} packages`)
	return value.map((item, index) => {
		if (!item || typeof item !== 'object')
			throw new TypeError(`packages[${index}] must be an object`)
		const packageItem = item as Record<string, unknown>
		const expected = expectedPackages[index]!
		if (packageItem.name !== expected.name)
			throw new Error(`packages[${index}].name must be ${expected.name}`)
		if (packageItem.directory !== expected.directory)
			throw new Error(`${expected.name}.directory must be ${expected.directory}`)
		if (packageItem.version !== version)
			throw new Error(`${expected.name} version does not match ${version}`)
		for (const field of ['tarball', 'sha256']) {
			if (typeof packageItem[field] !== 'string' || packageItem[field].length === 0)
				throw new Error(`${expected.name}.${field} must be a non-empty string`)
		}
		if (!Number.isSafeInteger(packageItem.size) || Number(packageItem.size) <= 0)
			throw new Error(`${expected.name}.size must be a positive safe integer`)
		return packageItem as unknown as PreparedPackage
	})
}

function resolvePreparedTarball(path: string): string {
	const absolute = resolve(root, path)
	const fromReleaseDirectory = relative(releaseDirectory, absolute)
	if (fromReleaseDirectory === '' || fromReleaseDirectory.startsWith('..') || isAbsolute(fromReleaseDirectory))
		throw new Error(`Tarball must be inside artifacts/release: ${path}`)
	if (!absolute.endsWith('.tgz'))
		throw new Error(`Prepared package is not a .tgz tarball: ${path}`)
	return absolute
}

async function sha256(path: string): Promise<string> {
	return createHash('sha256').update(await readFile(path)).digest('hex')
}

async function main(): Promise<void> {
	const { manifest: manifestPath, verifyOnly } = parseArguments(process.argv.slice(2))
	if (!verifyOnly) {
		if (process.env.GITHUB_ACTIONS !== 'true')
			throw new Error('Publishing is restricted to GitHub Actions')
		if (process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch')
			throw new Error('Publishing requires a manually dispatched workflow')
		if (process.env.GITHUB_REF !== 'refs/heads/main')
			throw new Error(`Publishing requires refs/heads/main, received ${String(process.env.GITHUB_REF)}`)
		if (process.env.NODE_AUTH_TOKEN || process.env.NPM_TOKEN)
			throw new Error('Long-lived npm tokens are not allowed; use npm trusted publishing through OIDC')
	}

	const requestedVersion = requireEnvironment('RELEASE_VERSION')
	const npmTag = requireEnvironment('NPM_TAG')
	const confirmation = requireEnvironment('PUBLISH_CONFIRMATION')
	if (confirmation !== `publish ${requestedVersion} to ${npmTag}`)
		throw new Error(`Confirmation must exactly equal: publish ${requestedVersion} to ${npmTag}`)
	const isPrerelease = isPrereleaseVersion(requestedVersion)
	if (isPrerelease && npmTag !== 'next')
		throw new Error('Prerelease versions must use the next npm tag')
	if (!isPrerelease && npmTag !== 'latest')
		throw new Error('Stable versions must use the latest npm tag')

	const npmVersionText = await run('npm', ['--version'], { capture: true })
	if (!isAtLeast(parseVersion(npmVersionText), minimumNpmVersion))
		throw new Error(`npm ${npmVersionText} is too old for trusted publishing; require >=${minimumNpmVersion.join('.')}`)

	const raw = JSON.parse(await readFile(manifestPath, 'utf8')) as ReleaseManifest
	if (raw.schemaVersion !== 1)
		throw new Error(`Unsupported release manifest schema: ${String(raw.schemaVersion)}`)
	if (raw.version !== requestedVersion)
		throw new Error(`Requested version ${requestedVersion} does not match prepared version ${String(raw.version)}`)
	const expectedCommit = process.env.GITHUB_SHA ?? null
	if (raw.commit !== expectedCommit)
		throw new Error(`Prepared commit ${String(raw.commit)} does not match current commit ${String(expectedCommit)}`)
	const packages = assertPreparedPackages(raw.packages, requestedVersion)

	const tarballs = new Map<string, string>()
	for (const packageItem of packages) {
		const tarballPath = resolvePreparedTarball(packageItem.tarball)
		const actualSize = (await stat(tarballPath)).size
		if (actualSize !== packageItem.size)
			throw new Error(`${packageItem.name} tarball size changed after preparation`)
		if (await sha256(tarballPath) !== packageItem.sha256)
			throw new Error(`${packageItem.name} tarball checksum changed after preparation`)
		tarballs.set(packageItem.name, tarballPath)
	}

	if (verifyOnly) {
		console.log(`Verified ${packages.length} prepared tarballs for ${requestedVersion} with npm ${npmVersionText}; nothing was published.`)
		return
	}

	console.log(`Publishing ${requestedVersion} to npm tag ${npmTag} with npm ${npmVersionText}.`)
	for (const packageItem of packages) {
		const tarballPath = tarballs.get(packageItem.name)
		if (!tarballPath)
			throw new Error(`Missing verified tarball for ${packageItem.name}`)
		console.log(`Publishing ${packageItem.name} from ${packageItem.tarball}`)
		await run('npm', [
			'publish',
			tarballPath,
			'--access',
			'public',
			'--tag',
			npmTag,
			'--ignore-scripts',
		])
	}
}

try {
	await main()
}
catch (error) {
	if (process.argv.includes('--verify-only')) {
		const text = error instanceof Error ? error.stack ?? error.message : String(error)
		await writeFile(resolve(releaseDirectory, 'verification-error.txt'), `${text}\n`)
	}
	throw error
}
