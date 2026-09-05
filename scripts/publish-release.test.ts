import { describe, expect, it } from 'vitest'
import { publishWithRegistryPreflight } from './release-publication'

const version = '0.0.33'
const packages = [
	{ name: '@valchecker/internal', integrity: 'sha512-internal' },
	{ name: '@valchecker/all-steps', integrity: 'sha512-all-steps' },
	{ name: 'valchecker', integrity: 'sha512-valchecker' },
] as const

describe('publish release registry preflight', () => {
	it('detects a later conflicting artifact before publishing any missing package', async () => {
		const lookups: string[] = []
		const published: string[] = []
		await expect(publishWithRegistryPreflight(
			packages,
			version,
			async (packageName) => {
				lookups.push(packageName)
				return packageName === 'valchecker' ? 'sha512-CONFLICT' : null
			},
			async (packageItem) => {
				published.push(packageItem.name)
			},
		))
			.rejects.toThrow('valchecker@0.0.33 already exists on npm with different artifact integrity')
		expect(lookups)
			.toEqual(packages.map(packageItem => packageItem.name))
		expect(published)
			.toEqual([])
	})

	it('skips identical published artifacts and publishes the missing packages in dependency order', async () => {
		const published: string[] = []
		const skipped: string[] = []
		await publishWithRegistryPreflight(
			packages,
			version,
			async packageName => packageName === '@valchecker/internal' ? 'sha512-internal' : null,
			async (packageItem) => {
				published.push(packageItem.name)
			},
			packageItem => skipped.push(packageItem.name),
		)
		expect(skipped)
			.toEqual(['@valchecker/internal'])
		expect(published)
			.toEqual(['@valchecker/all-steps', 'valchecker'])
	})
})
