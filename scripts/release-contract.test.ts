import { describe, expect, it } from 'vitest'
import {
	assertLockstepVersions,
	assertReleaseChangelog,
	cutUnreleasedChangelog,
	npmTagForVersion,
	parseNpmVersions,
	publishedArtifactAction,
	releaseTagForVersion,
} from './release-contract'

describe('release contract', () => {
	it('derives the npm channel and git tag from semver', () => {
		expect(npmTagForVersion('1.2.3'))
			.toBe('latest')
		expect(npmTagForVersion('1.2.3+build.7'))
			.toBe('latest')
		expect(npmTagForVersion('1.2.3-rc.4'))
			.toBe('next')
		expect(releaseTagForVersion('1.2.3-rc.4'))
			.toBe('v1.2.3-rc.4')
		expect(() => npmTagForVersion('1.2.3-beta.1'))
			.toThrow('must end in -rc.N')
	})

	it('requires every release manifest to stay version-lockstep', () => {
		expect(assertLockstepVersions([
			{ path: 'package.json', version: '2.0.0' },
			{ path: 'packages/internal/package.json', version: '2.0.0' },
		]))
			.toBe('2.0.0')
		expect(() => assertLockstepVersions([
			{ path: 'package.json', version: '2.0.0' },
			{ path: 'packages/internal/package.json', version: '2.0.1' },
		]))
			.toThrow('must remain lockstep')
	})

	it('cuts Unreleased into a dated release and keeps a fresh Unreleased section', () => {
		const before = '# Changelog\n\n## [Unreleased]\n\n### Fixed\n\n- one\n\n## [1.0.0] - 2026-01-01\n\n[1.0.0]: old\n'
		const after = cutUnreleasedChangelog(before, '1.0.1', '2026-09-05')
		expect(after)
			.toContain('## [Unreleased]\n\n## [1.0.1] - 2026-09-05\n\n### Fixed')
		expect(after.indexOf('[1.0.1]:'))
			.toBeLessThan(after.indexOf('[1.0.0]:'))
		expect(() => assertReleaseChangelog(after, '1.0.1')).not.toThrow()
	})

	it('rejects a manifest bump whose changelog was not cut', () => {
		const changelog = '# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2026-01-01\n\n[1.0.0]: old\n'
		expect(() => assertReleaseChangelog(changelog, '1.0.1'))
			.toThrow('must match workspace version')
	})

	it('parses npm version inventories without treating malformed output as absence', () => {
		expect(parseNpmVersions('"1.0.0"'))
			.toEqual(['1.0.0'])
		expect(parseNpmVersions('["1.0.0","1.1.0"]'))
			.toEqual(['1.0.0', '1.1.0'])
		expect(() => parseNpmVersions('{}'))
			.toThrow('unexpected value')
	})

	it('skips only an already-published byte-identical release artifact', () => {
		expect(publishedArtifactAction('valchecker', '1.0.0', 'sha512-good', null))
			.toBe('publish')
		expect(publishedArtifactAction('valchecker', '1.0.0', 'sha512-good', 'sha512-good'))
			.toBe('skip')
		expect(() => publishedArtifactAction('valchecker', '1.0.0', 'sha512-good', 'sha512-other'))
			.toThrow('different artifact integrity')
	})
})
