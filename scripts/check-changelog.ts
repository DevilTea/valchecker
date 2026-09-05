import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/** Paths whose package source or published manifest can change public behaviour or contract. */
export function requiresChangelog(path: string): boolean {
	return /^packages\/[^/]+\/src\//.test(path)
		|| /^packages\/[^/]+\/package\.json$/.test(path)
}

export function changelogProblems(changedPaths: readonly string[]): string[] {
	const publicChanges = changedPaths.filter(requiresChangelog)
	if (publicChanges.length === 0 || changedPaths.includes('CHANGELOG.md'))
		return []
	return [
		'This pull request changes package source or a public package manifest but not CHANGELOG.md.',
		'Add an entry under the unreleased section, or apply the \'skip-changelog\' label.',
	]
}

export async function main(): Promise<void> {
	const changedPaths = readFileSync(0, 'utf8')
		.split(/\r?\n/)
		.filter(path => path.length > 0)
	const publicChanges = changedPaths.filter(requiresChangelog)
	if (publicChanges.length === 0) {
		console.log('No package source or public package manifest changed; changelog entry not required.')
		return
	}
	if (changedPaths.includes('CHANGELOG.md')) {
		console.log('Public package source/manifest and CHANGELOG.md both changed.')
		return
	}
	for (const problem of changelogProblems(changedPaths))
		console.error(`::error::${problem}`)
	process.exitCode = 1
}

if (process.argv[1] != null && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
	await main()
