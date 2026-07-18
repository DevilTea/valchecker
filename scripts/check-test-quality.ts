import { readdir, readFile } from 'node:fs/promises'
import process from 'node:process'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const packagesRoot = join(root, 'packages')
const failures: string[] = []

const forbiddenTitleTerms = [
	'coverage',
	'fast path',
	'fast-path',
	'triggers chaining',
	'loop length',
] as const

async function visit(directory: string): Promise<void> {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name)
		if (entry.isDirectory()) {
			if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== 'coverage')
				await visit(path)
			continue
		}

		const repositoryPath = relative(root, path).replaceAll('\\', '/')
		if (/\.(?:test|spec)\.[cm]?[jt]sx?\.(?:bak|old|orig)$/.test(entry.name)) {
			failures.push(`${repositoryPath}: stale test backup file`)
			continue
		}
		if (!/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name))
			continue
		if (!['.ts', '.tsx', '.js', '.jsx'].includes(extname(path)))
			continue

		const source = await readFile(path, 'utf8')
		const lines = source.split(/\r?\n/)
		for (let index = 0; index < lines.length; index++) {
			const line = lines[index]!
			const location = `${repositoryPath}:${index + 1}`

			if (/\b(?:describe|it|test)\.(?:only|skip)\s*\(/.test(line))
				failures.push(`${location}: focused or skipped test`)
			if (/\bset(?:Timeout|Interval)\s*\(/.test(line))
				failures.push(`${location}: uncontrolled timer in test`)

			if (/\b(?:describe|it|test)(?:\.each)?\s*\(/.test(line)) {
				const normalized = line.toLowerCase()
				for (const term of forbiddenTitleTerms) {
					if (normalized.includes(term))
						failures.push(`${location}: implementation-driven test title contains "${term}"`)
				}
			}
		}
	}
}

await visit(packagesRoot)

if (failures.length > 0) {
	console.error('Test quality checks failed:')
	for (const failure of failures)
		console.error(`- ${failure}`)
	process.exitCode = 1
}
else {
	console.log('Test quality checks passed.')
}
