import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/

interface ReleasePlan {
	schemaVersion: unknown
	version: unknown
	npmTag: unknown
	channel: unknown
	publish: unknown
	packages: unknown
	externalPrerequisites: unknown
}

interface PackageManifest {
	name?: unknown
	version?: unknown
	private?: unknown
	engines?: { node?: unknown }
	scripts?: Record<string, unknown>
}

const packageDefinitions = [
	{ name: '@valchecker/internal', path: 'packages/internal/package.json' },
	{ name: '@valchecker/all-steps', path: 'packages/all-steps/package.json' },
	{ name: 'valchecker', path: 'packages/valchecker/package.json' },
] as const

const expectedExternalPrerequisites = [
	'GitHub environment npm is protected and restricted to main',
	'npm trusted publisher is configured for all three packages',
] as const

const requiredReleaseFiles = [
	'README.md',
	'CHANGELOG.md',
	'MIGRATION.md',
	'SUPPORT.md',
	'RELEASING.md',
	'api-surface.json',
	'docs/guide/v1-contract.md',
	'docs/guide/migration-to-1.md',
	'.github/workflows/ci.yml',
	'.github/workflows/release.yml',
] as const

async function readText(path: string): Promise<string> {
	return readFile(resolve(root, path), 'utf8')
}

async function readJson<T>(path: string): Promise<T> {
	return JSON.parse(await readText(path)) as T
}

function assertNonEmptyString(value: unknown, path: string): asserts value is string {
	if (typeof value !== 'string' || value.length === 0)
		throw new Error(`${path} must be a non-empty string`)
}

function assertExactArray(value: unknown, expected: readonly string[], path: string): asserts value is string[] {
	if (!Array.isArray(value) || value.some(item => typeof item !== 'string'))
		throw new Error(`${path} must be an array of strings`)
	if (JSON.stringify(value) !== JSON.stringify(expected))
		throw new Error(`${path} must equal ${JSON.stringify(expected)}, received ${JSON.stringify(value)}`)
}

function assertValidSemver(value: unknown, path: string): asserts value is string {
	assertNonEmptyString(value, path)
	const match = semverPattern.exec(value)
	if (!match)
		throw new Error(`${path} is not valid semver: ${value}`)
	const prerelease = match[4]
	if (prerelease) {
		for (const identifier of prerelease.split('.')) {
			if (/^\d+$/.test(identifier) && identifier.length > 1 && identifier.startsWith('0'))
				throw new Error(`${path} has a numeric prerelease identifier with a leading zero: ${identifier}`)
		}
	}
}

function assertContains(text: string, fragment: string, path: string): void {
	if (!text.includes(fragment))
		throw new Error(`${path} must contain ${JSON.stringify(fragment)}`)
}

function assertNoPlaceholders(text: string, path: string): void {
	const match = /\b(?:TODO|TBD|FIXME|PLACEHOLDER)\b/i.exec(text)
	if (match)
		throw new Error(`${path} contains unresolved placeholder ${JSON.stringify(match[0])}`)
}

function workflowTriggers(workflow: string): string[] {
	const lines = workflow.split(/\r?\n/)
	const onIndex = lines.findIndex(line => line === 'on:')
	if (onIndex === -1)
		throw new Error('.github/workflows/release.yml is missing its on block')
	const triggers: string[] = []
	for (const line of lines.slice(onIndex + 1)) {
		if (line.length > 0 && !line.startsWith(' '))
			break
		const match = /^  ([A-Za-z_][A-Za-z0-9_-]*):(?:\s|$)/.exec(line)
		if (match)
			triggers.push(match[1]!)
	}
	return triggers
}

async function main(): Promise<void> {
	const plan = await readJson<ReleasePlan>('release-plan.json')
	if (plan.schemaVersion !== 1)
		throw new Error(`release-plan.json schemaVersion must be 1, received ${String(plan.schemaVersion)}`)
	assertValidSemver(plan.version, 'release-plan.json.version')
	if (plan.npmTag !== 'next')
		throw new Error(`release-plan.json.npmTag must be "next" for this release candidate, received ${String(plan.npmTag)}`)
	if (plan.channel !== 'release-candidate')
		throw new Error(`release-plan.json.channel must be "release-candidate", received ${String(plan.channel)}`)
	if (plan.publish !== false)
		throw new Error('release-plan.json.publish must remain false; repository state never authorizes publication')
	assertExactArray(plan.packages, packageDefinitions.map(item => item.name), 'release-plan.json.packages')
	assertExactArray(plan.externalPrerequisites, expectedExternalPrerequisites, 'release-plan.json.externalPrerequisites')

	const withoutBuild = plan.version.split('+', 1)[0]!
	if (!/-rc\.\d+$/.test(withoutBuild))
		throw new Error('A release-candidate plan must use an -rc.N version')

	const rootManifest = await readJson<PackageManifest>('package.json')
	if (rootManifest.private !== true)
		throw new Error('The workspace root must remain private')
	if (rootManifest.version !== plan.version)
		throw new Error(`Root version ${String(rootManifest.version)} does not match ${plan.version}`)
	if (rootManifest.engines?.node !== '>=22')
		throw new Error('Root engines.node must remain >=22')
	const scripts = rootManifest.scripts ?? {}
	if (scripts['release:readiness'] !== 'tsx ./scripts/check-release-readiness.ts')
		throw new Error('package.json must expose the release:readiness script')
	if (typeof scripts['release:validate'] !== 'string' || !scripts['release:validate'].startsWith('pnpm release:readiness && '))
		throw new Error('release:validate must begin with the readiness gate')

	for (const definition of packageDefinitions) {
		const manifest = await readJson<PackageManifest>(definition.path)
		if (manifest.name !== definition.name)
			throw new Error(`${definition.path} has unexpected name ${String(manifest.name)}`)
		if (manifest.version !== plan.version)
			throw new Error(`${definition.name} version ${String(manifest.version)} does not match ${plan.version}`)
		if (manifest.private === true)
			throw new Error(`${definition.name} must remain publishable`)
		if (manifest.engines?.node !== '>=22')
			throw new Error(`${definition.name} engines.node must remain >=22`)
	}

	for (const path of requiredReleaseFiles) {
		await access(resolve(root, path))
		const text = await readText(path)
		if (text.trim().length === 0)
			throw new Error(`${path} must not be empty`)
	}

	const readme = await readText('README.md')
	assertContains(readme, 'Migrating to 1.0', 'README.md')
	assertContains(readme, './MIGRATION.md', 'README.md')
	assertContains(readme, './SUPPORT.md', 'README.md')
	assertContains(readme, './RELEASING.md', 'README.md')

	const changelog = await readText('CHANGELOG.md')
	assertContains(changelog, `## [${plan.version}] - Unreleased`, 'CHANGELOG.md')
	assertContains(changelog, `npm \`${plan.npmTag}\` tag`, 'CHANGELOG.md')
	assertContains(changelog, `[${plan.version}]: https://github.com/DevilTea/valchecker/releases/tag/v${plan.version}`, 'CHANGELOG.md')
	for (const heading of ['### Added', '### Changed', '### Removed', '### Security'])
		assertContains(changelog, heading, 'CHANGELOG.md')
	assertNoPlaceholders(changelog, 'CHANGELOG.md')

	const migration = await readText('MIGRATION.md')
	assertContains(migration, plan.version, 'MIGRATION.md')
	assertContains(migration, 'Node.js 22', 'MIGRATION.md')
	assertContains(migration, 'ESM-only', 'MIGRATION.md')
	assertContains(migration, '.toAsync()', 'MIGRATION.md')
	assertContains(migration, 'intersection:conflicting_outputs', 'MIGRATION.md')
	assertNoPlaceholders(migration, 'MIGRATION.md')

	const migrationPage = await readText('docs/guide/migration-to-1.md')
	assertContains(migrationPage, plan.version, 'docs/guide/migration-to-1.md')
	assertContains(migrationPage, 'MIGRATION.md', 'docs/guide/migration-to-1.md')
	assertContains(migrationPage, '/guide/v1-contract', 'docs/guide/migration-to-1.md')

	const support = await readText('SUPPORT.md')
	assertContains(support, 'Semantic Versioning', 'SUPPORT.md')
	assertContains(support, 'Deprecation policy', 'SUPPORT.md')
	assertContains(support, 'Node.js', 'SUPPORT.md')
	assertContains(support, 'ESM', 'SUPPORT.md')
	assertNoPlaceholders(support, 'SUPPORT.md')

	const releasing = await readText('RELEASING.md')
	assertContains(releasing, 'environment named `npm`', 'RELEASING.md')
	assertContains(releasing, 'npm trusted publisher', 'RELEASING.md')
	assertContains(releasing, 'publish <version> to <tag>', 'RELEASING.md')
	assertContains(releasing, 'partial release', 'RELEASING.md')
	assertContains(releasing, 'RC readiness checklist', 'RELEASING.md')
	assertContains(releasing, 'repository state never authorizes publication', 'RELEASING.md')
	assertNoPlaceholders(releasing, 'RELEASING.md')

	const releaseWorkflow = await readText('.github/workflows/release.yml')
	assertExactArray(workflowTriggers(releaseWorkflow), ['workflow_dispatch'], 'release workflow triggers')
	for (const fragment of [
		'environment: npm',
		'id-token: write',
		'persist-credentials: false',
		'pnpm release:validate',
		'pnpm release:prepare',
		'pnpm release:publish',
	]) {
		assertContains(releaseWorkflow, fragment, '.github/workflows/release.yml')
	}
	for (const forbidden of [
		/secrets\.(?:NPM_TOKEN|NODE_AUTH_TOKEN)/,
		/\bgit\s+push\b/,
		/\bgit\s+tag\b/,
		/\bnpm\s+version\b/,
		/\bpnpm\s+publish\b/,
	]) {
		if (forbidden.test(releaseWorkflow))
			throw new Error(`.github/workflows/release.yml contains forbidden operation ${forbidden}`)
	}

	const ciWorkflow = await readText('.github/workflows/ci.yml')
	assertContains(ciWorkflow, 'Release Readiness', '.github/workflows/ci.yml')
	assertContains(ciWorkflow, 'pnpm release:readiness', '.github/workflows/ci.yml')
	assertContains(ciWorkflow, 'Verify Publish Inputs', '.github/workflows/ci.yml')

	console.log(`Release readiness verified for ${plan.version} (${plan.npmTag}); publishing remains disabled.`)
	for (const prerequisite of plan.externalPrerequisites)
		console.log(`External prerequisite: ${prerequisite}`)
}

await main()
