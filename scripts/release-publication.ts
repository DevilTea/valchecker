import { publishedArtifactAction } from './release-contract'

export interface PublicationPackage {
	name: string
	integrity: string
}

export async function publishWithRegistryPreflight<Package extends PublicationPackage>(
	packages: readonly Package[],
	version: string,
	publishedIntegrity: (packageName: string, version: string) => Promise<string | null>,
	publish: (packageItem: Package) => Promise<void>,
	skip: (packageItem: Package) => void = () => {},
): Promise<void> {
	const publicationActions: ('publish' | 'skip')[] = []
	for (const packageItem of packages) {
		publicationActions.push(publishedArtifactAction(
			packageItem.name,
			version,
			packageItem.integrity,
			await publishedIntegrity(packageItem.name, version),
		))
	}

	for (let index = 0; index < packages.length; index++) {
		const packageItem = packages[index]!
		const action = publicationActions[index]
		if (!action)
			throw new Error(`Missing registry preflight result for ${packageItem.name}`)
		if (action === 'skip') {
			skip(packageItem)
			continue
		}
		await publish(packageItem)
	}
}
