import { describe, expect, it } from 'vitest'
import { changelogProblems, requiresChangelog } from './check-changelog'

describe('changelog-required path predicate', () => {
	it.each([
		['packages/valchecker/src/index.ts', true],
		['packages/valchecker/package.json', true],
		['packages/internal/package.json', true],
		['packages/valchecker/README.md', false],
		['packages/valchecker/tsconfig.json', false],
		['docs/index.md', false],
	])('%s requires changelog: %s', (path, expected) => {
		expect(requiresChangelog(path))
			.toBe(expected)
	})

	it('requires a changelog for a public package manifest change', () => {
		expect(changelogProblems(['packages/valchecker/package.json']))
			.toEqual([
				'This pull request changes package source or a public package manifest but not CHANGELOG.md.',
				'Add an entry under the unreleased section, or apply the \'skip-changelog\' label.',
			])
	})

	it('does not require one for README-only or unrelated changes', () => {
		expect(changelogProblems(['packages/valchecker/README.md', 'docs/index.md']))
			.toEqual([])
	})

	it('accepts a changelog alongside a public change', () => {
		expect(changelogProblems(['packages/valchecker/package.json', 'CHANGELOG.md']))
			.toEqual([])
	})
})
