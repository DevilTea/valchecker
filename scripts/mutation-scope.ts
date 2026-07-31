/**
 * Selects what a pull request's mutation run should mutate.
 *
 * The full sweep is the wrong shape for a pull request: it takes tens of minutes and answers
 * "where are this repository's historical blind spots?", which is a question about `main`, not
 * about this diff. The question a pull request needs answered is narrower — **did this change
 * weaken the suite's ability to notice a broken implementation?** — so this runs Stryker over
 * the production files the diff touches.
 *
 * Two rules decide the scope:
 *
 * - a changed production file is mutated, because its own new code may be untested;
 * - a changed *test* file pulls in the production files beside it, because weakening a test is
 *   exactly the regression this gate exists to catch and it leaves no mark on production source.
 *
 * **The limit, stated rather than implied.** This does not compute reverse dependencies. A
 * change to a shared module in `core/` or `shared/` can weaken discrimination in a step that
 * imports it, and nothing here will select that step. Building a safe import graph for a
 * repository whose tests import package barrels is more machinery than the signal is worth,
 * and the scheduled full sweep is what covers it. So: a green PR gate means "this diff did not
 * weaken the files it touched", never "the repository has no blind spots".
 *
 * The scope comes from committed history (`merge-base ... HEAD`), which is what CI measures.
 * Locally that means an uncommitted change selects nothing; commit first, or name the files
 * directly with `npx stryker run --mutate <paths>`.
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import process from 'node:process'

const root = resolve(import.meta.dirname, '..')

function isProductionSource(file: string): boolean {
	return /^packages\/[^/]+\/src\/.+\.ts$/.test(file)
		&& !file.endsWith('.test.ts')
		&& !file.endsWith('.bench.ts')
		&& !file.endsWith('/index.ts')
		&& !file.includes('/test-utils/')
}

function isTestSource(file: string): boolean {
	return /^packages\/[^/]+\/src\/.+\.test\.ts$/.test(file)
}

function git(...args: string[]): string {
	const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
	if (result.status !== 0)
		throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`)
	return result.stdout.trim()
}

function resolveBase(): string {
	const flagIndex = process.argv.indexOf('--base')
	const explicit = flagIndex !== -1 ? process.argv[flagIndex + 1] : process.env.MUTATION_BASE
	return explicit != null && explicit !== '' ? explicit : 'origin/main'
}

function listSiblingProductionFiles(testFile: string): string[] {
	const directory = resolve(root, dirname(testFile))
	if (!existsSync(directory))
		return []
	const listed = git('ls-files', '--', `${relative(root, directory)}/*.ts`)
	return listed.split('\n')
		.filter(file => file !== '' && isProductionSource(file))
}

function main(): void {
	const base = resolveBase()
	const mergeBase = git('merge-base', base, 'HEAD')
	const changed = git('diff', '--name-only', '--diff-filter=d', `${mergeBase}...HEAD`)
		.split('\n')
		.filter(file => file !== '')

	const selected = new Set<string>()
	for (const file of changed) {
		if (isProductionSource(file) && existsSync(resolve(root, file))) {
			selected.add(file)
		}
		else if (isTestSource(file)) {
			listSiblingProductionFiles(file)
				.forEach(sibling => selected.add(sibling))
		}
	}

	if (selected.size === 0) {
		console.log(`No production source in the diff against ${base}. Nothing to mutate.`)
		return
	}

	const files = [...selected].sort((a, b) => a.localeCompare(b))
	console.log(`Mutating ${files.length} file(s) changed against ${base}:`)
	for (const file of files)
		console.log(`  ${file}`)
	console.log('Reverse dependencies are not selected — see the note at the top of this file.')

	const stryker = spawnSync('npx', ['stryker', 'run', '--mutate', files.join(',')], {
		cwd: root,
		stdio: 'inherit',
		env: process.env,
	})
	process.exitCode = stryker.status ?? 1
}

main()
