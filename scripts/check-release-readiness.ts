import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
	assertLockstepVersions,
	assertReleaseChangelog,
	npmTagForVersion,
	releaseManifestPaths,
	releasePackages,
} from './release-contract'
import { assertReleaseWorkflowContract } from './release-workflow-contract'

const root = resolve(import.meta.dirname, '..')

interface PackageManifest {
	name?: unknown
	version?: unknown
	private?: unknown
	engines?: { node?: unknown }
	scripts?: Record<string, unknown>
}

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
	'scripts/release.ts',
	'scripts/release-contract.ts',
	'.github/workflows/security-audit.yml',
	'security-audit-acknowledgements.json',
	'scripts/check-security-audit.ts',
	'scripts/security-audit-policy.ts',
] as const

async function readText(path: string): Promise<string> {
	return readFile(resolve(root, path), 'utf8')
}

async function readJson<T>(path: string): Promise<T> {
	return JSON.parse(await readText(path)) as T
}

function assertContains(text: string, fragment: string, path: string): void {
	if (!text.includes(fragment))
		throw new Error(`${path} must contain ${JSON.stringify(fragment)}`)
}

function assertNoPlaceholders(text: string, path: string): void {
	const match = /\b(?:TODO|TBD|FIXME)\b/i.exec(text) ?? /\bPLACEHOLDER\b/.exec(text)
	if (match)
		throw new Error(`${path} contains unresolved placeholder ${JSON.stringify(match[0])}`)
}

async function assertRetiredReleasePlan(): Promise<void> {
	try {
		await access(resolve(root, 'release-plan.json'))
	}
	catch {
		return
	}
	throw new Error('release-plan.json must remain retired; annotated Git tags authorize publication')
}

async function main(): Promise<void> {
	const versionEntries = await Promise.all(releaseManifestPaths.map(async (path) => {
		const manifest = await readJson<PackageManifest>(path)
		return { path, version: manifest.version }
	}))
	const version = assertLockstepVersions(versionEntries)
	const npmTag = npmTagForVersion(version)

	const rootManifest = await readJson<PackageManifest>('package.json')
	if (rootManifest.private !== true)
		throw new Error('The workspace root must remain private')
	if (rootManifest.engines?.node !== '>=22')
		throw new Error('Root engines.node must remain >=22')
	const scripts = rootManifest.scripts ?? {}
	const expectedScripts = {
		'release': 'tsx ./scripts/release.ts open',
		'release:tag': 'tsx ./scripts/release.ts tag',
		'release:prepare': 'tsx ./scripts/prepare-release.ts',
		'release:publish': 'tsx ./scripts/publish-release.ts',
		'release:readiness': 'tsx ./scripts/check-release-readiness.ts',
		'security:audit': 'tsx ./scripts/check-security-audit.ts',
	} as const
	for (const [name, expected] of Object.entries(expectedScripts)) {
		if (scripts[name] !== expected)
			throw new Error(`package.json script ${name} must equal ${JSON.stringify(expected)}`)
	}
	if (typeof scripts['release:validate'] !== 'string' || !scripts['release:validate'].startsWith('pnpm release:readiness && '))
		throw new Error('release:validate must begin with the readiness gate')

	for (const definition of releasePackages) {
		const path = `${definition.directory}/package.json`
		const manifest = await readJson<PackageManifest>(path)
		if (manifest.name !== definition.name)
			throw new Error(`${path} has unexpected name ${String(manifest.name)}`)
		if (manifest.version !== version)
			throw new Error(`${definition.name} version ${String(manifest.version)} does not match ${version}`)
		if (manifest.private === true)
			throw new Error(`${definition.name} must remain publishable`)
		if (manifest.engines?.node !== '>=22')
			throw new Error(`${definition.name} engines.node must remain >=22`)
	}

	await assertRetiredReleasePlan()
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
	assertReleaseChangelog(changelog, version)
	for (const heading of ['### Added', '### Changed', '### Removed', '### Security'])
		assertContains(changelog, heading, 'CHANGELOG.md')
	assertNoPlaceholders(changelog, 'CHANGELOG.md')

	const migration = await readText('MIGRATION.md')
	assertContains(migration, 'Node.js 22', 'MIGRATION.md')
	assertContains(migration, 'ESM-only', 'MIGRATION.md')
	assertContains(migration, '.toAsync()', 'MIGRATION.md')
	assertContains(migration, 'intersection:conflicting_outputs', 'MIGRATION.md')
	assertNoPlaceholders(migration, 'MIGRATION.md')

	const migrationPage = await readText('docs/guide/migration-to-1.md')
	assertContains(migrationPage, 'MIGRATION.md', 'docs/guide/migration-to-1.md')
	assertContains(migrationPage, '/guide/v1-contract', 'docs/guide/migration-to-1.md')

	const support = await readText('SUPPORT.md')
	assertContains(support, 'Semantic Versioning', 'SUPPORT.md')
	assertContains(support, 'Deprecation policy', 'SUPPORT.md')
	assertContains(support, 'Node.js', 'SUPPORT.md')
	assertContains(support, 'ESM', 'SUPPORT.md')
	assertNoPlaceholders(support, 'SUPPORT.md')

	const releasing = await readText('RELEASING.md')
	for (const fragment of [
		'npm trusted publisher',
		'pnpm release <release>',
		'pnpm release:tag',
		'annotated',
		'partial release',
		'`next`',
		'`latest`',
	])
		assertContains(releasing, fragment, 'RELEASING.md')
	if (/release-plan\.json|workflow_dispatch|publish <version> to <tag>/.test(releasing))
		throw new Error('RELEASING.md still describes the retired release state/dispatch model')
	assertNoPlaceholders(releasing, 'RELEASING.md')

	const releaseScript = await readText('scripts/release.ts')
	for (const fragment of ['gh pr create', 'gh pr merge', '--auto', '--squash', '\'tag\', \'--annotate\'', '\'push\', \'origin\', tag'])
		assertContains(releaseScript, fragment, 'scripts/release.ts')

	const releaseWorkflow = await readText('.github/workflows/release.yml')
	assertReleaseWorkflowContract(releaseWorkflow)
	for (const forbidden of [
		/workflow_dispatch/,
		/\binputs\./,
		/registry-url:/,
		/secrets\.(?:NPM_TOKEN|NODE_AUTH_TOKEN)/,
		/\bgit\s+push\b/,
		/\bgit\s+tag\b/,
		/git fetch origin main --depth(?:=|\s+)1/,
		/\bnpm\s+version\b/,
		/\bpnpm\s+publish\b/,
	]) {
		if (forbidden.test(releaseWorkflow))
			throw new Error(`.github/workflows/release.yml contains forbidden operation ${forbidden}`)
	}

	const ciWorkflow = await readText('.github/workflows/ci.yml')
	assertContains(ciWorkflow, 'Release Readiness', '.github/workflows/ci.yml')
	assertContains(ciWorkflow, 'Security Audit Policy', '.github/workflows/ci.yml')
	assertContains(ciWorkflow, 'pnpm security:audit', '.github/workflows/ci.yml')
	assertContains(ciWorkflow, 'pnpm release:readiness', '.github/workflows/ci.yml')
	assertContains(ciWorkflow, 'pnpm release:publish --verify-only', '.github/workflows/ci.yml')
	if (/PUBLISH_CONFIRMATION|RELEASE_VERSION|NPM_TAG/.test(ciWorkflow))
		throw new Error('.github/workflows/ci.yml still synthesizes retired manual publish inputs')

	const securityWorkflow = await readText('.github/workflows/security-audit.yml')
	for (const fragment of [
		'cron: \'0 21 * * 0\'',
		'workflow_dispatch:',
		'pnpm install --frozen-lockfile',
		'pnpm security:audit',
		'if: always()',
		'artifacts/security-audit/report.json',
	])
		assertContains(securityWorkflow, fragment, '.github/workflows/security-audit.yml')

	console.log(`Release readiness verified for lockstep ${version}; npm tag ${npmTag} is derived from semver and annotated v${version} authorizes publication.`)
}

await main()
