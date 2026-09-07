export const releasePackages = [
	{ name: '@valchecker/internal', directory: 'packages/internal' },
	{ name: '@valchecker/all-steps', directory: 'packages/all-steps' },
	{ name: 'valchecker', directory: 'packages/valchecker' },
] as const

export const releaseManifestPaths = [
	'package.json',
	...releasePackages.map(pkg => `${pkg.directory}/package.json`),
] as const

const semverPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-([0-9A-Z-]+(?:\.[0-9A-Z-]+)*))?(?:\+[0-9A-Z-]+(?:\.[0-9A-Z-]+)*)?$/i
const releaseHeadingPattern = /^## \[([^\]]+)\] - (\d{4}-\d{2}-\d{2})$/gm

export function assertValidSemver(value: unknown, path = 'version'): asserts value is string {
	if (typeof value !== 'string' || value.length === 0)
		throw new Error(`${path} must be a non-empty semver string`)
	const match = semverPattern.exec(value)
	if (!match)
		throw new Error(`${path} is not valid semver: ${value}`)
	const prerelease = match[1]
	if (prerelease) {
		for (const identifier of prerelease.split('.')) {
			if (/^\d+$/.test(identifier) && identifier.length > 1 && identifier.startsWith('0'))
				throw new Error(`${path} has a numeric prerelease identifier with a leading zero: ${identifier}`)
		}
	}
}

export function npmTagForVersion(version: string): 'latest' | 'next' {
	assertValidSemver(version)
	const withoutBuild = version.split('+', 1)[0]!
	if (!withoutBuild.includes('-'))
		return 'latest'
	if (!/-rc\.\d+$/.test(withoutBuild))
		throw new Error(`Unsupported prerelease version ${version}; Valchecker prereleases must end in -rc.N`)
	return 'next'
}

export function releaseTagForVersion(version: string): string {
	assertValidSemver(version)
	return `v${version}`
}

export function assertLockstepVersions(entries: readonly { path: string, version: unknown }[]): string {
	if (entries.length === 0)
		throw new Error('No release manifests were provided')
	const [first, ...rest] = entries
	assertValidSemver(first!.version, `${first!.path}.version`)
	const version = first!.version
	for (const entry of rest) {
		assertValidSemver(entry.version, `${entry.path}.version`)
		if (entry.version !== version)
			throw new Error(`${entry.path}.version must remain lockstep at ${version}, received ${entry.version}`)
	}
	return version
}

function assertCalendarDate(date: string): void {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
		throw new Error(`Release date must be YYYY-MM-DD, received ${date}`)
	const parsed = new Date(`${date}T00:00:00Z`)
	const roundTrip = Number.isNaN(parsed.getTime())
		? ''
		: parsed.toISOString()
				.slice(0, 10)
	if (roundTrip !== date)
		throw new Error(`Release date is not a real calendar date: ${date}`)
}

export function cutUnreleasedChangelog(changelog: string, version: string, date: string): string {
	assertValidSemver(version)
	assertCalendarDate(date)
	const marker = '## [Unreleased]'
	const markerIndex = changelog.indexOf(marker)
	if (markerIndex === -1 || changelog.includes(marker, markerIndex + marker.length))
		throw new Error('CHANGELOG.md must contain exactly one ## [Unreleased] heading')
	if (new RegExp(`^## \\[${version.replaceAll('.', String.raw`\.`)}\\] - `, 'm')
		.test(changelog)) {
		throw new Error(`CHANGELOG.md already contains a release heading for ${version}`)
	}

	const headingEnd = markerIndex + marker.length
	const released = `${changelog.slice(0, headingEnd)}\n\n## [${version}] - ${date}${changelog.slice(headingEnd)}`
	const link = `[${version}]: https://github.com/DevilTea/valchecker/releases/tag/v${version}`
	const firstVersionLink = /^\[\d+\.\d+\.\d+(?:-[^\]]+)?\]:/m.exec(released)
	if (firstVersionLink)
		return `${released.slice(0, firstVersionLink.index)}${link}\n${released.slice(firstVersionLink.index)}`
	return `${released.trimEnd()}\n\n${link}\n`
}

export function assertReleaseChangelog(changelog: string, version: string): void {
	assertValidSemver(version)
	const unreleasedIndex = changelog.indexOf('## [Unreleased]')
	if (unreleasedIndex === -1)
		throw new Error('CHANGELOG.md must contain ## [Unreleased]')

	releaseHeadingPattern.lastIndex = 0
	const first = releaseHeadingPattern.exec(changelog)
	if (!first)
		throw new Error('CHANGELOG.md must contain a dated release heading')
	if (first.index <= unreleasedIndex)
		throw new Error('CHANGELOG.md must keep ## [Unreleased] above released versions')
	if (first[1] !== version)
		throw new Error(`The first released CHANGELOG.md version must match workspace version ${version}, received ${first[1]}`)
	assertCalendarDate(first[2]!)

	const link = `[${version}]: https://github.com/DevilTea/valchecker/releases/tag/v${version}`
	if (!changelog.includes(link))
		throw new Error(`CHANGELOG.md must contain ${link}`)
}

export function parseNpmVersions(json: string): string[] {
	const value = JSON.parse(json) as unknown
	if (typeof value === 'string')
		return [value]
	if (Array.isArray(value) && value.every(item => typeof item === 'string'))
		return value
	throw new Error('npm view versions returned an unexpected value')
}

export function publishedArtifactAction(
	packageName: string,
	version: string,
	localIntegrity: string,
	publishedIntegrity: string | null,
): 'publish' | 'skip' {
	if (publishedIntegrity == null)
		return 'publish'
	if (publishedIntegrity === localIntegrity)
		return 'skip'
	throw new Error(`${packageName}@${version} already exists on npm with different artifact integrity`)
}
